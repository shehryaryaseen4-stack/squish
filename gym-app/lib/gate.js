'use strict';

// Keeping members whose fee has run out from opening the gate.
//
// The machine opens the turnstile by itself when a face or finger matches, so the
// app has to tell it who may pass:
// - Access-control firmware ("A&C push"): take away the member's door rights
//   (userauthorize) and give them back after payment. The face stays on the machine.
// - Attendance firmware ("T&A push"): there is no "no entry" switch, so the member is
//   taken off the machine and put back after payment, with the face and fingerprints
//   the app saved from the machine's log. Without a saved face the member would have
//   to register again, so they are left alone unless the gym says otherwise.
//
// Commands go out through the same queue as registration (lib/enroll.js), when the
// machine next asks for work. Written from the push protocol as other servers use it;
// the machine's answers are in its log (Settings → machine → Log).

const CHECK_MS = 30 * 1000;
const BLOCKED = new Set(['expired', 'unpaid', 'frozen', 'left']);

function createGate({ db, store, stamp, now, enrollment, summaryOf }) {
  const settings = (dv) => ({ enabled: false, graceDays: 0, withoutBackup: false, ...(dv.gate || {}) });
  const hasBackup = (m) => Object.keys(m.templates || {}).length > 0;
  const hasBiometrics = (m) => Boolean(m.credentials?.face || m.credentials?.palm || m.credentials?.fingers?.length);

  // Should this member be kept out right now?
  function shouldBlock(m, gate) {
    if (m.left) return 'left';
    const s = summaryOf(m);
    if (!BLOCKED.has(s.status)) return null;
    if (s.status === 'expired' && -(s.daysLeft ?? 0) <= gate.graceDays) return null;
    return s.status;
  }

  // What the machine needs to be told to let this member in again.
  function allowCommands(dv, m) {
    if (dv.acMode) return [[`DATA UPDATE userauthorize Pin=${m.memberNo}\tAuthorizeTimezoneId=1\tAuthorizeDoorId=1`, 'gate-open']];
    const cmds = [[enrollment.userLine(m, m.credentials?.card ? `\tCard=${m.credentials.card}` : ''), 'gate-open']];
    for (const line of Object.values(m.templates || {})) cmds.push([restoreLine(line), 'gate-restore']);
    return cmds;
  }

  function blockCommands(dv, m) {
    return dv.acMode
      ? [[`DATA DELETE userauthorize Pin=${m.memberNo}`, 'gate-block']]
      : [[`DATA DELETE USERINFO PIN=${m.memberNo}`, 'gate-block']];
  }

  /**
   * Bring one machine in line with who has paid. Runs when the machine asks for
   * work, at most every 30 seconds, so a member who pays at the desk gets in within
   * half a minute. Returns what changed.
   */
  function check(dv, { force = false } = {}) {
    const gate = settings(dv);
    dv.gateBlocked ||= {};
    const t = now();
    if (!force && dv.gateCheckedAt && t - dv.gateCheckedAt < CHECK_MS) return null;
    dv.gateCheckedAt = t;
    const changes = { blocked: [], opened: [], skipped: [] };
    const members = db().members;
    const blockedNow = dv.gateBlocked;
    for (const m of members) {
      const was = blockedNow[m.id];
      const reason = gate.enabled ? shouldBlock(m, gate) : null;
      if (reason && !was) {
        // Taking someone off an attendance machine loses a face we never saved.
        if (!dv.acMode && hasBiometrics(m) && !hasBackup(m) && !gate.withoutBackup) { changes.skipped.push(m.id); continue; }
        for (const [cmd, kind] of blockCommands(dv, m)) enrollment.queue(dv, cmd, { kind, memberId: m.id });
        blockedNow[m.id] = { at: stamp(), reason, how: dv.acMode ? 'rights' : 'removed' };
        changes.blocked.push(m.id);
      } else if (!reason && was) {
        if (!m.left) for (const [cmd, kind] of allowCommands(dv, m)) enrollment.queue(dv, cmd, { kind, memberId: m.id });
        delete blockedNow[m.id];
        changes.opened.push(m.id);
      } else if (reason && was) {
        was.reason = reason;
      }
    }
    // Members deleted from the app don't need tracking.
    for (const id of Object.keys(blockedNow)) if (!members.some((m) => m.id === id)) delete blockedNow[id];
    dv.gateSkipped = changes.skipped;
    return changes;
  }

  // Ask the machine to send the faces and fingerprints it holds, so the app can put them back later.
  function backup(dv, list) {
    let n = 0;
    for (const m of list) {
      enrollment.queue(dv, `DATA QUERY USERINFO PIN=${m.memberNo}`, { kind: 'backup', memberId: m.id });
      enrollment.queue(dv, `DATA QUERY FINGERTMP PIN=${m.memberNo}`, { kind: 'backup', memberId: m.id });
      enrollment.queue(dv, `DATA QUERY BIODATA Type=9\tPIN=${m.memberNo}`, { kind: 'backup', memberId: m.id });
      n++;
    }
    return n;
  }

  // Is this member kept off the machine (so registration shouldn't put them back)?
  const isRemoved = (dv, m) => dv.gateBlocked?.[m.id]?.how === 'removed';

  function status(dv) {
    const gate = settings(dv);
    const byId = new Map(db().members.map((m) => [m.id, m]));
    const who = (id) => { const m = byId.get(id); return m ? { id, memberNo: m.memberNo, name: m.name } : null; };
    return {
      ...gate,
      mode: dv.acMode ? 'access' : 'attendance',
      blocked: Object.entries(dv.gateBlocked || {}).map(([id, b]) => ({ ...who(id), ...b })).filter((x) => x.name),
      skipped: (dv.gateSkipped || []).map(who).filter(Boolean),
      saved: db().members.filter((m) => !m.left && hasBackup(m)).length,
    };
  }

  return { check, backup, status, isRemoved, settings, hasBackup };
}

// "FP PIN=1001\tFID=6\t…" (from the machine's log) → "DATA UPDATE FINGERTMP PIN=1001\tFID=6\t…".
function restoreLine(line) {
  const head = line.split(/\s/)[0];
  const rest = line.slice(head.length).trim();
  const table = head === 'FP' || head === 'FINGERTMP' ? 'FINGERTMP' : head === 'FACE' ? 'FACE' : 'BIODATA';
  return `DATA UPDATE ${table} ${rest}`;
}

module.exports = { createGate, restoreLine, CHECK_MS };
