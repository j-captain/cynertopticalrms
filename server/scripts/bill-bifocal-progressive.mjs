import mongoose from 'mongoose';
import Patient from '../models/Patient.js';
import { env } from '../config/env.js';

/* ────────────────────────────────────────────────────────────────── */
/* Pricing table                                                      */
/* ────────────────────────────────────────────────────────────────── */
const FRAME = 540;
const FITTING = 150;
const CASE_AMOUNT = 160;
const FARGO = 580;

const LENS_PRICING = [
  { match: /bifocal/i, lenses: 1200, label: 'Bifocal' },
  { match: /progressive/i, lenses: 1810, label: 'Progressive' },
];

const pickLensPrice = (lensType = '') => {
  for (const rule of LENS_PRICING) {
    if (rule.match.test(lensType)) {
      return {
        lenses: rule.lenses,
        total: rule.lenses + FRAME + FITTING + CASE_AMOUNT + FARGO,
        label: rule.label,
      };
    }
  }
  return null;
};

/* ────────────────────────────────────────────────────────────────── */
/* Date helper - submission + 1 day                                   */
/* ────────────────────────────────────────────────────────────────── */
const dayAfter = (d) => {
  if (!d) return new Date();
  const date = new Date(d);
  if (isNaN(date.getTime())) return new Date();
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next;
};

/* ────────────────────────────────────────────────────────────────── */
/* Connect                                                            */
/* ────────────────────────────────────────────────────────────────── */
await mongoose.connect(env.MONGO_URI);
if (mongoose.connection.readyState !== 1) {
  console.error('❌ Could not connect to MongoDB. Check MONGO_URI in .env.');
  process.exit(1);
}
console.log(`✅ Connected to ${mongoose.connection.name}`);

/* ────────────────────────────────────────────────────────────────── */
/* 1. Preview                                                         */
/* ────────────────────────────────────────────────────────────────── */
const pending = await Patient.find(
  { billingStatus: 'pending_billing' },
  { name: 1, lensType: 1, submissionDate: 1, billingStatus: 1 }
).lean();

console.log(`\n═══ Pending orders: ${pending.length} ═══`);

const toBill = [];
const skipped = [];

for (const p of pending) {
  const price = pickLensPrice(p.lensType);
  if (price) {
    toBill.push({ ...p, price });
  } else {
    skipped.push(p);
  }
}

console.log(`\n── Will be billed (${toBill.length}) ──`);
for (const p of toBill) {
  const billedAt = dayAfter(p.submissionDate);
  console.log(
    `  ${p.name.padEnd(32)}  ${String(p.price.label).padEnd(12)}  ` +
    `lenses=${p.price.lenses}  total=${p.price.total}  ` +
    `submitted=${p.submissionDate ? new Date(p.submissionDate).toISOString().slice(0, 10) : '-'}  ` +
    `billedAt=${billedAt.toISOString().slice(0, 10)}`
  );
}

if (skipped.length) {
  console.log(`\n── Skipped - not Bifocal/Progressive (${skipped.length}) ──`);
  for (const p of skipped) {
    console.log(`  ${p.name.padEnd(32)}  lens="${p.lensType || '(empty)'}"`);
  }
}

if (toBill.length === 0) {
  console.log('\n✅ Nothing to bill. Exiting.');
  await mongoose.disconnect();
  process.exit(0);
}

/* ────────────────────────────────────────────────────────────────── */
/* 2. Apply                                                           */
/* ────────────────────────────────────────────────────────────────── */
console.log('\n── Applying ──');

let updated = 0;
for (const p of toBill) {
  const billedAt = dayAfter(p.submissionDate);

  const result = await Patient.updateOne(
    { _id: p._id, billingStatus: 'pending_billing' },
    {
      $set: {
        billingStatus: 'billed',
        billing: {
          lenses: p.price.lenses,
          frame: FRAME,
          fitting: FITTING,
          caseAmount: CASE_AMOUNT,
          fargo: FARGO,
          total: p.price.total,
          billedBy: null,
          billedByName: 'system migration',
          billedAt,                       // ← submission + 1 day
        },
      },
    }
  );
  if (result.modifiedCount === 1) updated++;
  console.log(
    `  ${p.name.padEnd(32)}  → billed (total=${p.price.total})  ` +
    `billedAt=${billedAt.toISOString().slice(0, 10)}  ${result.modifiedCount ? '✓' : '⨯'}`
  );
}

console.log(`\n✅ Updated ${updated} / ${toBill.length} record(s).`);

/* ────────────────────────────────────────────────────────────────── */
/* 3. Final state                                                     */
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

const updatedNames = toBill.map((p) => p.name);
const verify = await Patient.find(
  { name: { $in: updatedNames } },
  { name: 1, lensType: 1, billingStatus: 1, 'billing.total': 1, 'billing.lenses': 1, 'billing.billedAt': 1 }
).lean();
if (verify.length) {
  console.log('\n═══ Verify - records touched by this run ═══');
  for (const p of verify) {
    const ba = p.billing?.billedAt
      ? new Date(p.billing.billedAt).toISOString().slice(0, 10)
      : '-';
    console.log(
      `  ${p.name.padEnd(32)}  status=${String(p.billingStatus).padEnd(10)}  ` +
      `lenses=${p.billing?.lenses ?? '-'}  total=${p.billing?.total ?? '-'}  billedAt=${ba}`
    );
  }
}

await mongoose.disconnect();
console.log('\n✅ Done.');