import mongoose from 'mongoose';
import Patient from '../models/Patient.js';
import { env } from '../config/env.js';

/* ────────────────────────────────────────────────────────────────── */
/* Pricing                                                            */
/* ────────────────────────────────────────────────────────────────── */
const FRAME = 540;
const FITTING = 150;
const CASE_AMOUNT = 160;
const FARGO = 580;
const MAX_PER_DAY = 5;

const LENS_PRICING = [
  { match: /progressive/i,                          lenses: 1810, label: 'Progressive' },
  { match: /bifocal/i,                              lenses: 1200, label: 'Bifocal' },
  { match: /single\s*vision.*glass/i,               lenses: 580,  label: 'Single Vision (Glass)' },
  { match: /hi-?index/i,                            lenses: 580,  label: 'Hi-Index' },
  { match: /single\s*vision.*plastic/i,             lenses: 580,  label: 'Single Vision (Plastic)' },
];

const pickLensPrice = (lensType = '') => {
  for (const rule of LENS_PRICING) {
    if (rule.match.test(lensType)) return { lenses: rule.lenses, label: rule.label };
  }
  return null;
};

/* ────────────────────────────────────────────────────────────────── */
/* Date helpers - EAT (UTC+3)                                        */
/* ────────────────────────────────────────────────────────────────── */
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

const dayKeyEAT = (d) => {
  const eat = new Date(new Date(d).getTime() + EAT_OFFSET_MS);
  return eat.toISOString().slice(0, 10);
};

const dayStartEAT = (d) => {
  const eat = new Date(new Date(d).getTime() + EAT_OFFSET_MS);
  eat.setUTCHours(0, 0, 0, 0);
  return new Date(eat.getTime() - EAT_OFFSET_MS);
};

const addDays = (d, n) => new Date(new Date(d).getTime() + n * 24 * 60 * 60 * 1000);

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
/* 1. Find targets                                                    */
/* ────────────────────────────────────────────────────────────────── */
const targets = await Patient.find(
  {
    billingStatus: 'delivered',
    $or: [
      { billing: { $exists: false } },
      { billing: null },
      { 'billing.total': { $exists: false } },
      { 'billing.total': null },
    ],
  },
  { name: 1, lensType: 1, submissionDate: 1, deliveredAt: 1, createdAt: 1 }
)
  .sort({ submissionDate: 1, _id: 1 })
  .lean();

console.log(`\n═══ Delivered orders with no bill: ${targets.length} ═══`);
if (targets.length === 0) {
  console.log('\n✅ Nothing to backfill.');
  await mongoose.disconnect();
  process.exit(0);
}

/* ────────────────────────────────────────────────────────────────── */
/* 2. Days that ALREADY have a fargo charge                           */
/* ────────────────────────────────────────────────────────────────── */
const existingWithFargo = await Patient.find(
  { 'billing.fargo': { $gt: 0 }, 'billing.billedAt': { $ne: null } },
  { 'billing.billedAt': 1, name: 1 }
).lean();
const takenDays = new Set(
  existingWithFargo.map((p) => dayKeyEAT(p.billing.billedAt))
);
console.log(
  `\nDays already carrying a fargo charge: ` +
  (takenDays.size ? [...takenDays].sort().join(', ') : '(none)')
);

/* ────────────────────────────────────────────────────────────────── */
/* 3. Build batches of up to MAX_PER_DAY, in submissionDate order     */
/* ────────────────────────────────────────────────────────────────── */
const priced = targets
  .map((p) => {
    const price = pickLensPrice(p.lensType);
    const rawDate = p.submissionDate || p.deliveredAt || p.createdAt;
    const submitted = rawDate ? new Date(rawDate) : null;
    return { patient: p, price, submitted };
  })
  .filter((e) => {
    if (!e.price) { console.log(`  ⚠︎ skip ${e.patient.name} - no lens pricing for "${e.patient.lensType || ''}"`); return false; }
    if (!e.submitted || isNaN(e.submitted.getTime())) { console.log(`  ⚠︎ skip ${e.patient.name} - no valid submission date`); return false; }
    return true;
  });

console.log(`\n${priced.length} records eligible for backfill.`);

// Chunk into groups of MAX_PER_DAY
const batches = [];
for (let i = 0; i < priced.length; i += MAX_PER_DAY) {
  batches.push(priced.slice(i, i + MAX_PER_DAY));
}

/* ────────────────────────────────────────────────────────────────── */
/* 4. Assign a delivery date per batch                                */
/*                                                                   */
/* Each batch's date must be:                                        */
/*   ≥ latest submissionDate in the batch  (can't deliver before order)*/
/*   ≤ today                                                 */
/*   > previous batch's date  (chronological order)          */
/*   and NOT collide with a day that already has a fargo charge      */
/*                                                                   */
/* We spread the batches evenly across the available span so each    */
/* gets a distinct day, and shift within ±a few days if needed to    */
/* avoid the "taken" days.                                           */
/* ────────────────────────────────────────────────────────────────── */
const today = new Date();

// First pass: floor + preferred date (even spread)
const floorDates = batches.map(
  (b) => new Date(Math.max(...b.map((e) => e.submitted.getTime())))
);
const lastFloor = floorDates[floorDates.length - 1];
const spanDays = Math.max(
  batches.length,
  Math.floor((today.getTime() - floorDates[0].getTime()) / (24 * 60 * 60 * 1000))
);
const step = Math.max(1, Math.floor(spanDays / batches.length));

const assigned = [];
let prevDate = null;
for (let i = 0; i < batches.length; i++) {
  const floor = floorDates[i];
  // Preferenced date: floor + i*step, capped at today
  let candidate = addDays(floor, i * step);
  if (candidate > today) candidate = today;
  if (candidate < floor) candidate = floor;
  if (prevDate && candidate <= prevDate) candidate = addDays(prevDate, 1);

  // Shift to avoid days that already have fargo, without going below floor
  let shifted = candidate;
  let tries = 0;
  while (takenDays.has(dayKeyEAT(shifted)) && tries < 30) {
    shifted = addDays(shifted, -1);
    if (shifted < floor) {
      shifted = addDays(candidate, tries + 1);
      if (shifted > today) { shifted = floor; break; }
    }
    tries++;
  }

  const dayKey = dayKeyEAT(shifted);
  const fargo = takenDays.has(dayKey) ? 0 : FARGO;
  if (fargo > 0) takenDays.add(dayKey);

  assigned.push({ batch: batches[i], deliveryDate: shifted, dayKey, fargo });
  prevDate = shifted;
}

/* ────────────────────────────────────────────────────────────────── */
/* 5. Preview                                                         */
/* ────────────────────────────────────────────────────────────────── */
console.log(`\n═══ Delivery batches (${assigned.length}) ═══`);
let grandTotal = 0;
for (let i = 0; i < assigned.length; i++) {
  const a = assigned[i];
  console.log(`\n  Batch ${i + 1} - delivery date ${a.dayKey}`);
  for (let j = 0; j < a.batch.length; j++) {
    const e = a.batch[j];
    const fargo = j === 0 ? a.fargo : 0;
    const total = e.price.lenses + FRAME + FITTING + CASE_AMOUNT + fargo;
    grandTotal += total;
    console.log(
      `    ${e.patient.name.padEnd(30)}  ` +
      `submitted=${dayKeyEAT(e.submitted)}  ` +
      `${e.price.label.padEnd(24)}  ` +
      `lenses=${e.price.lenses}  fargo=${fargo}  TOTAL=${total}`
    );
  }
}
console.log(`\n  ────────────────────────────────────────────────────────────────`);
console.log(`  Grand total across all backfilled bills: KES ${grandTotal.toLocaleString()}`);
const totalFargo = assigned.filter((a) => a.fargo > 0).length * FARGO;
console.log(`  Fargos charged: ${totalFargo / FARGO} × ${FARGO} = KES ${totalFargo.toLocaleString()}`);

/* ────────────────────────────────────────────────────────────────── */
/* 6. Apply                                                           */
/* ────────────────────────────────────────────────────────────────── */
console.log('\n── Applying ──');
let updated = 0;
for (const a of assigned) {
  for (let j = 0; j < a.batch.length; j++) {
    const e = a.batch[j];
    const fargo = j === 0 ? a.fargo : 0;
    const total = e.price.lenses + FRAME + FITTING + CASE_AMOUNT + fargo;

    const result = await Patient.updateOne(
      {
        _id: e.patient._id,
        billingStatus: 'delivered',
        $or: [
          { billing: { $exists: false } },
          { billing: null },
          { 'billing.total': { $exists: false } },
          { 'billing.total': null },
        ],
      },
      {
        $set: {
          billing: {
            lenses: e.price.lenses,
            frame: FRAME,
            fitting: FITTING,
            caseAmount: CASE_AMOUNT,
            fargo,
            total,
            billedBy: null,
            billedByName: 'system migration (delivered backfill)',
            billedAt: a.deliveryDate,
          },
        },
      }
    );
    if (result.modifiedCount === 1) {
      updated++;
      console.log(
        `  ✓ ${e.patient.name.padEnd(30)}  ${a.dayKey}  total=${total}  fargo=${fargo}`
      );
    } else {
      console.log(`  ⨯ ${e.patient.name.padEnd(30)}  (not modified - state changed)`);
    }
  }
}
console.log(`\n✅ Updated ${updated} / ${priced.length} record(s).`);

/* ────────────────────────────────────────────────────────────────── */
/* 7. Verify - grouped by delivery day                                */
/* ────────────────────────────────────────────────────────────────── */
console.log('\n═══ Verify (grouped by delivery day) ═══');
const verify = await Patient.find(
  { _id: { $in: priced.map((e) => e.patient._id) } },
  {
    name: 1,
    billingStatus: 1,
    'billing.lenses': 1,
    'billing.fargo': 1,
    'billing.total': 1,
    'billing.billedAt': 1,
  }
)
  .sort({ 'billing.billedAt': 1, name: 1 })
  .lean();

const byDay = new Map();
for (const p of verify) {
  if (!p.billing?.billedAt) continue;
  const k = dayKeyEAT(p.billing.billedAt);
  if (!byDay.has(k)) byDay.set(k, []);
  byDay.get(k).push(p);
}
let verifyFargo = 0;
for (const [day, list] of [...byDay.entries()].sort()) {
  const dayFargo = list.reduce((s, p) => s + (p.billing?.fargo || 0), 0);
  verifyFargo += dayFargo;
  console.log(`\n  ${day}  (${list.length} bill${list.length === 1 ? '' : 's'}, fargo=KES ${dayFargo})`);
  for (const p of list) {
    console.log(
      `    ${p.name.padEnd(30)}  ` +
      `lenses=${p.billing?.lenses ?? '-'}  ` +
      `fargo=${p.billing?.fargo ?? '-'}  ` +
      `total=${p.billing?.total ?? '-'}`
    );
  }
}
console.log(`\n  Total fargo across all backfilled bills: KES ${verifyFargo.toLocaleString()}`);

await mongoose.disconnect();
console.log('\n✅ Done.');