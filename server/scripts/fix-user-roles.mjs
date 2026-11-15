import mongoose from 'mongoose';
import User from '../models/User.js';
import { env } from '../config/env.js';

await mongoose.connect(env.MONGO_URI);

console.log('── Current state ──');
const total = await User.countDocuments();
const admins = await User.countDocuments({ role: 'admin' });
const staff = await User.countDocuments({ role: 'staff' });
console.log(`Total: ${total}   Admins: ${admins}   Staff: ${staff}\n`);

const adminList = await User.find({ role: 'admin' })
  .select('name email createdAt')
  .lean();

console.log('Users currently marked admin:');
adminList.forEach((u) => {
  const created = u.createdAt ? u.createdAt.toISOString().slice(0, 10) : '?';
  console.log(`  ${u.email.padEnd(36)} ${u.name.padEnd(24)} (created ${created})`);
});

/* ────────────────────────────────────────────────────────────────── */
/* EDIT THIS - emails that should REMAIN admin.                      */
/* Everyone else currently admin will be demoted to staff.           */
/*                                                                   */
/* You MUST include your own email here or you'll lock yourself      */
/* out of admin features.                                            */
/* ────────────────────────────────────────────────────────────────── */
const KEEP_ADMIN = [
  // 'your.email@cynert.com',
  // 'owner@cynert.com',
];

if (KEEP_ADMIN.length === 0) {
  console.log('\n⚠️  KEEP_ADMIN is empty - no changes made.');
  console.log('   Edit the script to add emails that should stay admin, then re-run.');
  await mongoose.disconnect();
  process.exit(0);
}

const keep = KEEP_ADMIN.map((e) => e.toLowerCase().trim());

// Safety: confirm every email in KEEP_ADMIN actually exists
const existing = await User.find({ email: { $in: keep } }).select('email').lean();
const existingEmails = existing.map((u) => u.email);
const missing = keep.filter((e) => !existingEmails.includes(e));
if (missing.length) {
  console.log(`\n❌ These emails in KEEP_ADMIN do not exist in the DB: ${missing.join(', ')}`);
  console.log('   Fix the array and re-run. No changes made.');
  await mongoose.disconnect();
  process.exit(1);
}

const result = await User.updateMany(
  { role: 'admin', email: { $nin: keep } },
  { $set: { role: 'staff' } }
);

console.log(`\n✅ Demoted ${result.modifiedCount} user(s) to staff.`);
console.log(`   Remaining admins (${keep.length}): ${keep.join(', ')}`);
console.log(`   New totals: ${await User.countDocuments({ role: 'admin' })} admin, ${await User.countDocuments({ role: 'staff' })} staff.`);

await mongoose.disconnect();