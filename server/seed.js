'use strict';

const db = require('./store/db');
const users = require('./services/userService');
const groups = require('./services/groupService');
const { SERVER } = require('./config/policies');

const DEFAULT_PASSWORD = 'Comsats@123';

async function main() {
  const force = process.argv.includes('--force');

  if (db.collection('users').length > 0 && !force) {
    console.log('The database already contains users, so nothing was changed.');
    console.log('To wipe it and load the demo data again, run:');
    console.log('  npm run seed -- --force');
    return;
  }

  if (force) {
    db.reset();
    console.log('Existing data wiped.');
  }

  const make = (loginId, name, role, department) =>
    users.createUser({
      loginId,
      name,
      role,
      department,
      password: DEFAULT_PASSWORD,
    });

  /* ---------------- Users ---------------- */

  const itAdmin = await make('admin.it', 'IT Administrator', 'admin', 'Administration');
  const examCell = await make('exam.cell', 'Exam Cell Office', 'admin', 'Administration');

  const drAhmed = await make('dr.ahmed', 'Dr. Ahmed Raza', 'faculty', 'Computer Science');
  const drSana = await make('dr.sana', 'Dr. Sana Malik', 'faculty', 'Computer Science');
  const drBilal = await make('dr.bilal', 'Dr. Bilal Hussain', 'faculty', 'Management Sciences');

  const muaaz = await make('FA22-BCS-045', 'Muaaz Tasawar', 'student', 'Computer Science');
  const ayesha = await make('FA22-BCS-012', 'Ayesha Khan', 'student', 'Computer Science');
  const hamza = await make('FA22-BCS-078', 'Hamza Ali', 'student', 'Computer Science');
  const fatima = await make('FA22-BEE-031', 'Fatima Noor', 'student', 'Electrical and Computer Engineering');
  const usman = await make('SP23-BBA-019', 'Usman Raza', 'student', 'Management Sciences');

  /* ---------------- Groups ---------------- */

  const bcs7a = groups.createGroup(itAdmin, {
    name: 'BCS-7A',
    type: 'class',
    postPolicy: 'everyone',
    description: 'Class group for BCS Semester 7, Section A.',
    memberIds: [drAhmed.id, drSana.id, muaaz.id, ayesha.id, hamza.id],
  });

  const pdc = groups.createGroup(drAhmed, {
    name: 'CSC334 Parallel and Distributed Computing',
    type: 'course',
    postPolicy: 'everyone',
    description: 'Course discussion for PDC. Lab assignments are posted here.',
    memberIds: [muaaz.id, ayesha.id, hamza.id],
  });

  const csAnnouncements = groups.createGroup(itAdmin, {
    name: 'CS Department Announcements',
    type: 'department',
    postPolicy: 'faculty_only',
    description: 'Official department announcements. Students can read only.',
    memberIds: [drAhmed.id, drSana.id, muaaz.id, ayesha.id, hamza.id],
  });

  const examNotices = groups.createGroup(examCell, {
    name: 'Exam Cell Notices',
    type: 'office',
    postPolicy: 'admin_only',
    description: 'Datesheets and exam notices. Only the Exam Cell can post.',
    memberIds: [
      itAdmin.id, drAhmed.id, drSana.id, drBilal.id,
      muaaz.id, ayesha.id, hamza.id, fatima.id, usman.id,
    ],
  });

  // Created by a student, which exercises the student creation rules
  const acm = groups.createGroup(muaaz, {
    name: 'ACM Student Chapter',
    type: 'society',
    postPolicy: 'everyone',
    description: 'COMSATS ACM student society.',
    memberIds: [ayesha.id, hamza.id, fatima.id],
  });

  const venturify = groups.createGroup(muaaz, {
    name: 'Venturify FYP Team',
    type: 'fyp',
    postPolicy: 'everyone',
    description: 'Final year project team. Supervisor: Dr. Sana Malik.',
    memberIds: [ayesha.id, drSana.id],
  });

  // Hamza can read the ACM group but not post, which demonstrates muting
  groups.setMuted(muaaz, acm.id, hamza.id, true);

  /* ---------------- A few starting messages ---------------- */

  groups.postMessage(examCell, examNotices.id, 'Mid-term datesheet will be uploaded on the portal by Friday.');
  groups.postMessage(drAhmed, csAnnouncements.id, 'The department seminar on cloud computing is on Monday at 11:00 AM.');
  groups.postMessage(drAhmed, pdc.id, 'Lab Assignment 1 (Socket.IO) has been posted. Please read the brief carefully.');
  groups.postMessage(ayesha, pdc.id, 'Sir, is the demo required in the lab or can we show it online?');
  groups.postMessage(muaaz, venturify.id, 'Sprint planning meeting tomorrow after the 2 PM class.');
  groups.postMessage(drSana, bcs7a.id, 'Please submit your FYP proposals by next week.');

  db.flush();

  /* ---------------- Summary ---------------- */

  console.log('');
  console.log('Seed complete.');
  console.log('  Database file : ' + SERVER.DB_FILE);
  console.log('  Users         : ' + users.listUsers({ includeInactive: true }).length);
  console.log('  Groups        : ' + groups.listAllGroups().length);
  console.log('  Password for every demo account: ' + DEFAULT_PASSWORD);
  console.log('');
  console.log('Demo logins:');
  users.listUsers().forEach((u) => {
    console.log('  ' + u.loginId.padEnd(14) + u.role.padEnd(9) + u.name);
  });
  console.log('');
}

main().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});