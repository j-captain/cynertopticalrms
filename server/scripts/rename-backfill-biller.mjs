import mongoose from 'mongoose';
import Patient from '../models/Patient.js';
import { env } from '../config/env.js';

await mongoose.connect(env.MONGO_URI);
if (mongoose.connection.readyState !== 1) {
  console.error('❌ Could not connect to MongoDB. Check MONGO_URI in .env.');
  process.exit(1);
}
console.log(`✅ Connected to ${mongoose.connection.name}`);

const OLD_NAME = 'system migration (delivered backfill)';
const NEW_NAME = 'Jaspah Optician';

/* ────────────────────────────────────────────────────────────────── */
/* 1. Preview                                                         */
/* ────────────────────────────────────────────────────────────────── */
const targets = await Patient.find(
  { 'billing.billedByName': OLD_NAME },
  { name: 1, billingStatus: 1, 'billing.billedAt': 1, 'billing.total': 1 }
)
  .sort({ 'billing.billedAt': 1, name: 1 })
  .lean();

console.log(`\n═══ Records to rename: ${targets.length} ═══`);
for (const p of targets) {
  const d = p.billing?.billedAt
    ? new Date(p.billing.billedAt).toISOString().slice(0, 10)
    : '-';
  console.log(
    `  ${p.name.padEnd(30)}  ${String(p.billingStatus).padEnd(10)}  ` +
    `billedAt=${d}  total=${p.billing?.total ?? '-'}`
  );
}

if (targets.length === 0) {
  console.log('\n✅ Nothing to rename.');
  await mongoose.disconnect();
  process.exit(0);
}

/* ────────────────────────────────────────────────────────────────── */
/* 2. Apply                                                           */
/* ────────────────────────────────────────────────────────────────── */
console.log('\n── Applying ──');
const result = await Patient.updateMany(
  { 'billing.billedByName': OLD_NAME },
  { $set: { 'billing.billedByName': NEW_NAME } }
);

console.log(`✅ Updated ${result.modifiedCount} record(s).`);

/* ────────────────────────────────────────────────────────────────── */
/* 3. Verify                                                          */
/* ────────────────────────────────────────────────────────────────── */
const verify = await Patient.find(
  { 'billing.billedByName': NEW_NAME },
  { name: 1, billingStatus: 1, 'billing.billedAt': 1, 'billing.total': 1 }
)
  .sort({ 'billing.billedAt': 1, name: 1 })
  .lean();

console.log(`\n═══ Verify - records now with billedByName="${NEW_NAME}": ${verify.length} ═══`);
for (const p of verify) {
  const d = p.billing?.billedAt
    ? new Date(p.billing.billedAt).toISOString().slice(0, 10)
    : '-';
  console.log(
    `  ${p.name.padEnd(30)}  ${String(p.billingStatus).padEnd(10)}  ` +
    `billedAt=${d}  total=${p.billing?.total ?? '-'}`
  );
}

// Also confirm no leftover "system migration (delivered backfill)" rows
const leftover = await Patient.countDocuments({ 'billing.billedByName': OLD_NAME });
console.log(`\nRemaining "${OLD_NAME}" rows: ${leftover}`);
console.log(leftover === 0 ? '✅ Clean.' : '⚠️ Some rows still have the old name.');

await mongoose.disconnect();
console.log('\n✅ Done.');