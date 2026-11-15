import mongoose from 'mongoose';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import User from '../models/User.js';
import { env } from '../config/env.js';

const rl = readline.createInterface({ input, output });

await mongoose.connect(env.MONGO_URI);

/* ────────────────────────────────────────────────────────────────── */
/* Step 1 - Report current state                                      */
/* ────────────────────────────────────────────────────────────────── */
const total = await User.countDocuments();
const active = await User.countDocuments({ isActive: true });
const missing = await User.countDocuments({ isActive: { $exists: false } });
const inactive = await User.countDocuments({ isActive: false });

console.log('\n═══ Current state ═══');
console.log(`Total users:   ${total}`);
console.log(`Active:        ${active}`);
console.log(`Inactive:      ${inactive}`);
console.log(`Missing field: ${missing}  ← these are pre-migration accounts`);

/* ────────────────────────────────────────────────────────────────── */
/* Step 2 - List everyone                                             */
/* ────────────────────────────────────────────────────────────────── */
const users = await User.find()
  .select('name email role isActive createdAt')
  .sort({ createdAt: 1 })
  .lean();

console.log('\n═══ All users ═══');
console.log('');
for (const u of users) {
  const status =
    u.isActive === true ? '✅ active'
    : u.isActive === false ? '⛔ inactive'
    : '❓ missing';
  console.log(
    `  ${String(u.role).padEnd(6)}  ${status.padEnd(12)}  ${u.email.padEnd(40)}  ${u.name}`
  );
}

/* ────────────────────────────────────────────────────────────────── */
/* Step 3 - Ask who to activate                                       */
/* ────────────────────────────────────────────────────────────────── */
console.log('\n═══ Activation ═══');
console.log('Enter the emails to activate, one per line.');
console.log('Press ENTER on an empty line when done.');
console.log('Type "ALL" alone to activate every user.');
console.log('');

const inputEmails = [];
if (!process.argv.includes('--yes')) {
  while (true) {
    const answer = (await rl.question('> ')).trim();
    if (!answer) break;
    if (answer.toUpperCase() === 'ALL') {
      inputEmails.push('__ALL__');
      break;
    }
    inputEmails.push(answer.toLowerCase());
  }
}

if (inputEmails.length === 0) {
  console.log('\nNo emails entered. Nothing changed.');
  await rl.close();
  await mongoose.disconnect();
  process.exit(0);
}

/* ────────────────────────────────────────────────────────────────── */
/* Step 4 - Resolve the target set                                    */
/* ────────────────────────────────────────────────────────────────── */
const activateAll = inputEmails.includes('__ALL__');
const wanted = inputEmails.filter((e) => e !== '__ALL__');

let targets;
if (activateAll) {
  targets = users;
} else {
  // Match each typed email against the real user list
  const missingEmails = [];
  targets = [];
  for (const email of wanted) {
    const match = users.find((u) => u.email === email);
    if (match) targets.push(match);
    else missingEmails.push(email);
  }
  if (missingEmails.length) {
    console.log(`\n❌ These emails were not found in the DB: ${missingEmails.join(', ')}`);
    console.log('   No changes made.');
    await rl.close();
    await mongoose.disconnect();
    process.exit(1);
  }
}

/* ────────────────────────────────────────────────────────────────── */
/* Step 5 - Confirm                                                   */
/* ────────────────────────────────────────────────────────────────── */
console.log('\n═══ Will activate ═══');
targets.forEach((u) => {
  const role = u.role === 'admin' ? 'admin' : 'staff';
  console.log(`  • ${u.email.padEnd(40)}  ${role.padEnd(6)}  ${u.name}`);
});

if (!process.argv.includes('--yes')) {
  const confirm = (await rl.question('\nProceed? (y/N) ')).trim().toLowerCase();
  if (confirm !== 'y' && confirm !== 'yes') {
    console.log('\nAborted. Nothing changed.');
    await rl.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

/* ────────────────────────────────────────────────────────────────── */
/* Step 6 - Apply                                                     */
/* ────────────────────────────────────────────────────────────────── */
const ids = targets.map((u) => u._id);
const result = await User.updateMany(
  { _id: { $in: ids } },
  {
    $set: { isActive: true },
    $unset: { activationToken: '', activationTokenExpires: '' },
  }
);

console.log(`\n✅ Activated ${result.modifiedCount} user(s).`);

/* ────────────────────────────────────────────────────────────────── */
/* Step 7 - Final state                                               */
/* ────────────────────────────────────────────────────────────────── */
const finalActive = await User.countDocuments({ isActive: true });
const finalInactive = await User.countDocuments({ isActive: { $ne: true } });
console.log(`\nFinal: ${finalActive} active, ${finalInactive} inactive.`);

await rl.close();
await mongoose.disconnect();