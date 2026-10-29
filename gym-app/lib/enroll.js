'use strict';

// Registering members on ZKTeco-type machines from the app (ADMS / push protocol).
//
// The machine asks for work at /iclock/getrequest; we answer with commands
// such as "C:12:DATA UPDATE USERINFO PIN=1001	Name=Ali" or "C:13:ENROLL_FP PIN=1001	FID=6".
// It reports each result at /iclock/devicecmd ("ID=13&Return=0&CMD=ENROLL_FP"),
// and uploads new fingerprints, faces and cards in its operation log, which is
// how we learn what each member has registered.

const METHODS = {
  fingerprint: { label: 'Fingerprint', bio: null },
  face: { label: 'Face', bio: 9 }, // visible light face
  'face-nir': { label: 'Near-infrared face', bio: 2 },
  palm: { label: 'Palm', bio: 8 },
  card: { label: 'Card', bio: null },
  pin: { label: 'PIN code', bio: null },
};

// Biometric types in the machine's BIODATA records.
const BIO_TYPES = { 1: 'fingerprint', 2: 'face', 7: 'fingerprint', 8: 'palm', 9: 'face', 10: 'palm' };
const PENDING_MS = 10 * 60 * 1000;

// The machine shows the name on screen; keep it short and plain.
const machineName = (name) => String(name || '').normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/[\t\r\n]/g, ' ').trim().slice(0, 24);

function createEnroll({ db, store, stamp, now = () => Date.now() }) {
  const api = {};
  const zkDevices = () => db().devices.filter((dv) => dv.protocol === 'zk' && dv.approved);

  function queue(device, cmd, meta = {}) {
    const d = db();
    // The same command still waiting (e.g. the user added a moment ago) is sent once.
    const waiting = (device.commands || []).find((x) => x.status === 'pending' && x.cmd === cmd);
    if (waiting) return waiting;
    d.cmdSeq = (d.cmdSeq || 0) + 1;
    device.commands ||= [];
    const c = { id: d.cmdSeq, cmd, status: 'pending', createdAt: stamp(), ...meta };
    device.commands.push(c);
    // Keep the list short: drop old finished commands first.
    if (device.commands.length > 3000) device.commands = device.commands.filter((x) => x.status === 'pending' || x.status === 'sent').slice(-3000);
    return c;
  }

  const userLine = (m, extra = '') => `DATA UPDATE USERINFO PIN=${m.memberNo}\tName=${machineName(m.name)}\tPri=0${extra}`;
  // Access-control firmware keeps users in "user" and door rights in "userauthorize".
  const accessLines = (m, blocked) => [
    `DATA UPDATE user CardNo=${m.credentials?.card || ''}\tPin=${m.memberNo}\tPassword=\tGroup=0\tStartTime=0\tEndTime=0\tName=${machineName(m.name)}\tPrivilege=0`,
    ...(blocked ? [] : [`DATA UPDATE userauthorize Pin=${m.memberNo}\tAuthorizeTimezoneId=1\tAuthorizeDoorId=1`]),
  ];
  // Set by the gate: members it keeps off a machine, or whose door rights it took away.
  api.gateState = () => null;

  function putUser(dv, m) {
    const gate = api.gateState(dv, m);
    if (gate === 'removed') return;
    if (dv.acMode) for (const line of accessLines(m, gate === 'rights')) queue(dv, line, { kind: 'user', memberId: m.id });
    else queue(dv, userLine(m), { kind: 'user', memberId: m.id });
  }

  // Put a member (or everyone) on every machine, so their ID is ready for a finger or face.
  function syncMember(m) {
    for (const dv of zkDevices()) putUser(dv, m);
  }
  function syncAll(device) {
    for (const m of db().members.filter((x) => !x.left)) putUser(device, m);
  }
  function removeMember(m) {
    for (const dv of zkDevices()) queue(dv, dv.acMode ? `DATA DELETE user Pin=${m.memberNo}` : `DATA DELETE USERINFO PIN=${m.memberNo}`, { kind: 'delete', memberId: m.id });
  }

  function enroll(member, device, { method, finger = 6, card = '', pin = '' }) {
    const how = METHODS[method];
    if (!how) throw new Error('Choose fingerprint, face, palm, card or PIN');
    if (method === 'card') {
      const no = String(card).replace(/\D/g, '');
      if (!no) throw new Error('Enter or scan the card number');
      return [queue(device, userLine(member, `\tCard=${no}`), { kind: 'card', memberId: member.id, value: no })];
    }
    if (method === 'pin') {
      if (!/^\d{4,8}$/.test(String(pin))) throw new Error('The PIN must be 4 to 8 digits');
      return [queue(device, userLine(member, `\tPasswd=${pin}`), { kind: 'pin', memberId: member.id })];
    }
    const user = queue(device, userLine(member), { kind: 'user', memberId: member.id });
    const fid = Math.max(0, Math.min(9, Number(finger) || 0));
    const cmd = method === 'fingerprint'
      ? `ENROLL_FP PIN=${member.memberNo}\tFID=${fid}\tRETRY=3\tOVERWRITE=1`
      : `ENROLL_BIO TYPE=${how.bio}\tPIN=${member.memberNo}\tRETRY=3\tOVERWRITE=1`;
    return [user, queue(device, cmd, { kind: 'enroll', method, memberId: member.id, ...(method === 'fingerprint' ? { finger: fid } : {}) })];
  }

  // GET /iclock/getrequest: hand the machine its waiting commands.
  function nextCommands(device) {
    const t = now();
    const out = [];
    for (const c of device.commands || []) {
      if (c.status === 'sent' && t - Date.parse(c.sentAt) > PENDING_MS) { c.status = 'failed'; c.error = 'The machine did not answer'; }
      if (c.status !== 'pending' || out.length >= 20) continue;
      c.status = 'sent';
      c.sentAt = stamp();
      out.push(`C:${c.id}:${c.cmd}`);
    }
    return out.length ? out.join('\n') : 'OK';
  }

  // POST /iclock/devicecmd: "ID=13&Return=0&CMD=ENROLL_FP", one per line.
  function results(device, text) {
    for (const line of String(text || '').split(/\r?\n/).filter(Boolean)) {
      const q = new URLSearchParams(line.trim());
      const id = Number(q.get('ID'));
      const c = (device.commands || []).find((x) => x.id === id);
      if (!c) continue;
      const code = Number(q.get('Return'));
      c.code = code;
      c.doneAt = stamp();
      c.status = code >= 0 ? 'ok' : 'failed';
      if (c.status === 'failed') c.error = errorText(c, code);
      if (c.status === 'ok' && (c.kind === 'card' || c.kind === 'pin')) mark(c.memberId, c.kind, c.value);
      if (c.status === 'ok' && c.kind === 'enroll') mark(c.memberId, c.method === 'face-nir' ? 'face' : c.method, null, c.finger);
    }
  }

  function errorText(c, code) {
    if (c.kind === 'enroll') {
      if (code === -1 || code === -1002) return 'This machine can’t start registration from the app. Register on the machine itself.';
      if (code === -1004 || code === 2) return 'Time ran out before the finger or face was scanned. Try again.';
      return `The machine could not save it (code ${code}). Try again, or register on the machine itself.`;
    }
    return `The machine refused it (code ${code}).`;
  }

  function mark(memberId, kind, value, extra) {
    const m = db().members.find((x) => x.id === memberId);
    if (!m) return;
    const c = { ...(m.credentials || {}) };
    if (kind === 'fingerprint') c.fingers = [...new Set([...(c.fingers || []), extra ?? 0])].sort();
    else if (kind === 'card') c.card = value;
    else c[kind] = true;
    c.updatedAt = stamp();
    m.credentials = c;
  }

  // Operation log uploads: "FP PIN=1001	FID=6	…", "BIODATA Pin=1001	…	Type=9", "USER PIN=1001	…	Card=123".
  function operlog(text) {
    const byNo = new Map(db().members.map((m) => [String(m.memberNo), m]));
    let changed = 0;
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.trim();
      const head = line.split(/\s/)[0];
      if (!['FP', 'FACE', 'BIODATA', 'USER', 'USERINFO', 'FINGERTMP'].includes(head)) continue;
      const fields = Object.fromEntries(line.slice(head.length).trim().split('\t').map((p) => { const i = p.indexOf('='); return [p.slice(0, i).trim().toLowerCase(), p.slice(i + 1).trim()]; }));
      const m = byNo.get(String(fields.pin || '').trim());
      if (!m) continue;
      // Keep the face and fingerprint templates, so a member taken off the machine can be put back.
      if ((fields.tmp || '').length > 10) {
        const key = head === 'BIODATA' ? `bio:${fields.type}:${fields.no || 0}:${fields.index || 0}` : head === 'FACE' ? `face:${fields.fid || 0}` : `fp:${fields.fid || 0}`;
        m.templates = { ...(m.templates || {}), [key]: line.slice(0, 60000) };
      }
      if (head === 'FP' || head === 'FINGERTMP') mark(m.id, 'fingerprint', null, Number(fields.fid) || 0);
      else if (head === 'FACE') mark(m.id, 'face');
      else if (head === 'BIODATA') {
        const kind = BIO_TYPES[Number(fields.type)];
        if (kind === 'fingerprint') mark(m.id, 'fingerprint', null, Number(fields.no) || 0);
        else if (kind) mark(m.id, kind);
      } else {
        if (fields.card && fields.card !== '0' && fields.card !== '[0000000000]') mark(m.id, 'card', fields.card.replace(/\D/g, '') || fields.card);
        if (fields.passwd) mark(m.id, 'pin');
      }
      changed++;
    }
    return changed;
  }

  function status(member) {
    const list = [];
    for (const dv of db().devices) {
      for (const c of dv.commands || []) if (c.memberId === member.id && c.kind !== 'user') list.push({ ...c, deviceId: dv.id, deviceName: dv.name });
    }
    return { credentials: member.credentials || {}, commands: list.sort((a, b) => b.id - a.id).slice(0, 10) };
  }

  return Object.assign(api, { METHODS, queue, userLine, syncMember, syncAll, removeMember, enroll, nextCommands, results, operlog, status, zkDevices });
}

module.exports = { createEnroll, METHODS, machineName };
