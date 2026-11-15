import mongoose from 'mongoose';
import Patient from '../models/Patient.js';
import { env } from '../config/env.js';

// Connect
await mongoose.connect(env.MONGO_URI);
if (mongoose.connection.readyState !== 1) {
  console.error('❌ Could not connect to MongoDB. Check MONGO_URI in .env.');
  process.exit(1);
}
console.log(`✅ Connected to ${mongoose.connection.name}`);

/* ────────────────────────────────────────────────────────────────── */
/* 1. Preview current state                                           */
/* ────────────────────────────────────────────────────────────────── */
console.log('\n═══ Current state ═══');
const total = await Patient.countDocuments();
const placed = await Patient.countDocuments({ orderPlaced: true });
const delivered = await Patient.countDocuments({ orderDelivered: true });
const missingField = await Patient.countDocuments({
  orderPlaced: true,
  billingStatus: { $exists: false },
});
console.log(`Total patients:           ${total}`);
console.log(`orderPlaced: true:        ${placed}`);
console.log(`orderDelivered: true:     ${delivered}`);
console.log(`Missing billingStatus:    ${missingField}  ← will be fixed by this script`);

/* ────────────────────────────────────────────────────────────────── */
/* 2. List the affected records so you can see exactly what changes   */
/* ────────────────────────────────────────────────────────────────── */
const affected = await Patient.find(
  {
    orderPlaced: true,
    billingStatus: { $exists: false },
  },
  { name: 1, systemNumber: 1, orderPlaced: 1, orderDelivered: 1, submissionDate: 1 }
).lean();

if (affected.length === 0) {
  console.log('\n✅ Nothing to migrate. All placed orders already have billingStatus.');
  await mongoose.disconnect();
  process.exit(0);
}

console.log('\n═══ Records that will be backfilled ═══');
for (const p of affected) {
  console.log(
    `  ${p.name.padEnd(32)}  ${String(p.systemNumber).padEnd(12)}  ` +
    `delivered=${p.orderDelivered ? 'Y' : 'N'}`
  );
}

/* ────────────────────────────────────────────────────────────────── */
/* 3. Apply - two passes, order matters                               */
/* ────────────────────────────────────────────────────────────────── */

// Pass 1 - every placed order that's still missing billingStatus
// becomes 'pending_billing'.
const r1 = await Patient.updateMany(
  {
    orderPlaced: true,
    billingStatus: { $exists: false },
  },
  { $set: { billingStatus: 'pending_billing' } }
);
console.log(`\n✅ Pass 1: backfilled ${r1.modifiedCount} → pending_billing`);

// Pass 2 - any already-delivered order becomes 'delivered' (overrides
// pass 1 for those specific records, so they land in the correct
// terminal state).
const r2 = await Patient.updateMany(
  {
    orderDelivered: true,
    billingStatus: { $ne: 'delivered' },
  },
  { $set: { billingStatus: 'delivered' } }
);
console.log(`✅ Pass 2: marked ${r2.modifiedCount} → delivered`);

/* ────────────────────────────────────────────────────────────────── */
/* 4. Confirm the result                                              */
/* ────────────────────────────────────────────────────────────────── */
console.log('\n═══ Final state ═══');
const byStatus = await Patient.aggregate([
  { $match: { billingStatus: { $exists: true } } },
  { $group: { _id: '$billingStatus', count: { $sum: 1 } } },
  { $sort: { _id: 1 } },
]);
for (const b of byStatus) {
  console.log(`  ${String(b._id).padEnd(20)} ${b.count}`);
}

// Show the two specific orders you mentioned, if they exist
const names = ['Gorge Oseko Mose', 'Harrison Mbindu Musingi'];
const findTargets = await Patient.find(
  { name: { $in: names } },
  { name: 1, systemNumber: 1, orderPlaced: 1, orderDelivered: 1, billingStatus: 1 }
).lean();
if (findTargets.length) {
  console.log('\n═══ Your two test orders ═══');
  for (const p of findTargets) {
    console.log(`  ${p.name.padEnd(28)} → ${p.billingStatus}`);
  }
}

await mongoose.disconnect();
console.log('\n✅ Done.');