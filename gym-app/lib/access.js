'use strict';

// What the owner can allow each staff login to do. The owner always has
// everything, and only the owner manages staff logins and the owner PIN.
const PERMISSIONS = [
  { id: 'checkin', group: 'Front desk', label: 'Check members in and out', hint: 'Front desk, kiosk and the entry screen' },
  { id: 'checkin.override', group: 'Front desk', label: 'Let in members whose fee has run out' },
  { id: 'members.view', group: 'Members', label: 'See members and their profiles' },
  { id: 'members.add', group: 'Members', label: 'Add new members' },
  { id: 'members.edit', group: 'Members', label: 'Edit members', hint: 'Details, photo, freeze, PIN, workout plan, left the gym' },
  { id: 'members.delete', group: 'Members', label: 'Delete members for good' },
  { id: 'fees.collect', group: 'Fees', label: 'Take fees', hint: 'New receipts and part payments' },
  { id: 'fees.view', group: 'Fees', label: 'See fees and collections' },
  { id: 'fees.delete', group: 'Fees', label: 'Delete fee receipts' },
  { id: 'attendance', group: 'Attendance', label: 'See the register and attendance', hint: 'And fix check-in times' },
  { id: 'classes', group: 'Attendance', label: 'Class bookings' },
  { id: 'leads', group: 'Other', label: 'Enquiries' },
  { id: 'expenses', group: 'Money', label: 'Expenses', hint: 'See and add rent, salaries and bills' },
  { id: 'reports', group: 'Money', label: 'Reports and income', hint: 'Monthly income, profit and the money on the dashboard' },
  { id: 'machines', group: 'Settings', label: 'Fingerprint and face machines' },
  { id: 'settings', group: 'Settings', label: 'Gym settings', hint: 'Name, plans and prices, timetable, trainers' },
];
const PERM_IDS = PERMISSIONS.map((p) => p.id);

const PRESETS = [
  { id: 'checkin', label: 'Check-in only', perms: ['checkin'] },
  { id: 'desk', label: 'Front desk', perms: ['checkin', 'members.view', 'members.add', 'members.edit', 'fees.collect', 'fees.view', 'attendance', 'classes', 'leads'] },
  { id: 'manager', label: 'Manager (everything)', perms: PERM_IDS },
];

// Gyms set up before staff logins had one shared front desk PIN: it becomes
// a "Front desk" login with the same rights as before.
function migrateAccess(db) {
  const admin = db.admin || (db.admin = { sessions: [] });
  admin.sessions ||= [];
  if (admin.users) return false;
  admin.users = [];
  if (admin.staffPin) {
    admin.users.push({ id: 'usr-desk', name: 'Front desk', pin: admin.staffPin, perms: PRESETS[1].perms, active: true });
    for (const s of admin.sessions) if (s.role === 'staff') s.userId = 'usr-desk';
    delete admin.staffPin;
  }
  return true;
}

module.exports = { PERMISSIONS, PERM_IDS, PRESETS, migrateAccess };
