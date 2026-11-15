// server/scripts/seedLensTypes.js
// Run from server/:  node scripts/seedLensTypes.js

import mongoose from 'mongoose';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { env } from '../config/env.js';
import LensType from '../models/LensType.js';

// ─── EDIT THIS LIST ───
const LENSES = [
  { name: 'Single Vision Plastic Photo', price: 4000 },
  { name: 'Bifocal Glass Photo', price: 10000 },
  { name: 'Progressive Photo MAR', price: 12000 },
];
// ──────────────────────

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = c('1'), dim = c('2'), red = c('31'), green = c('32'),
      yellow = c('33'), cyan = c('36'), gray = c('90');
const pad = (s, n) => String(s).padEnd(n);
const line = (ch = '─', n = 64) => gray(ch.repeat(n));

const rl = readline.createInterface({ input, output });
const ask = async (p) => (await rl.question(p)).trim();
const askYesNo = async (p, def = 'n') => {
  const raw = (await ask(`${p} ${def === 'y' ? '[Y/n]' : '[y/N]'} `)).toLowerCase();
  if (!raw) return def === 'y';
  return raw === 'y' || raw === 'yes';
};
const askChoice = async (p, valid) => {
  while (true) {
    const raw = (await ask(p)).toLowerCase();
    if (valid.includes(raw)) return raw;
    console.log(red(`  ✖ Enter one of: ${valid.filter(Boolean).join(', ')}`));
  }
};

const validate = () => {
  const errors = [];
  const seen = new Set();
  LENSES.forEach((l, i) => {
    const name = String(l.name || '').trim();
    if (!name) errors.push(`entry #${i + 1}: empty name`);
    if (name && seen.has(name.toLowerCase())) errors.push(`entry #${i + 1}: duplicate "${name}"`);
    seen.add(name.toLowerCase());
    if (typeof l.price !== 'number' || l.price < 0) errors.push(`entry #${i + 1}: invalid price`);
  });
  return errors;
};

const run = async () => {
  console.log('');
  console.log(bold(cyan('  Cynert Optical - Lens Types Seed')));
  console.log(line());

  const errors = validate();
  if (errors.length) {
    console.log(red(bold('  ✖ Validation failed')));
    errors.forEach((e) => console.log(`    ${red('•')} ${e}`));
    await rl.close();
    process.exit(1);
  }
  console.log(`  ${dim('Definition entries:')} ${bold(String(LENSES.length))}`);
  LENSES.forEach((l) => console.log(`    ${cyan('•')} ${l.name} - KES ${l.price.toLocaleString()}`));

  await mongoose.connect(env.MONGO_URI);
  console.log('');
  console.log(`  ${green('✔')} ${dim('Connected to MongoDB')}`);

  const existing = await LensType.find().sort({ name: 1 }).lean();
  console.log(`  ${dim('Existing in DB:')} ${bold(String(existing.length))}`);
  console.log(line());

  // Choose mode
  let mode = 'skip';
  if (existing.length > 0) {
    console.log('');
    console.log(bold(cyan('  What to do with existing lens types?')));
    console.log(`  ${bold('[1]')} Review one-by-one`);
    console.log(`  ${bold('[2]')} Delete ALL and reseed`);
    console.log(`  ${bold('[3]')} Skip review - keep existing, only add missing`);
    console.log(`  ${bold('[4]')} Cancel`);
    const choice = await askChoice('  Choice [1-4]: ', ['1', '2', '3', '4']);
    mode = { 1: 'review', 2: 'delete-all', 3: 'skip', 4: 'cancel' }[choice];
  }

  if (mode === 'cancel') {
    console.log(yellow(bold('  ⊘ Cancelled.')));
    await mongoose.disconnect();
    await rl.close();
    return;
  }

  let toDelete = [];
  if (mode === 'delete-all') {
    const sure = await askYesNo(red(`  Delete all ${existing.length} existing lens type(s)?`), 'n');
    if (!sure) {
      console.log(yellow(bold('  ⊘ Cancelled.')));
      await mongoose.disconnect();
      await rl.close();
      return;
    }
    toDelete = [...existing];
  } else if (mode === 'review') {
    for (let i = 0; i < existing.length; i++) {
      const l = existing[i];
      const inDefs = LENSES.some((d) => d.name.toLowerCase() === l.name.toLowerCase());
      const tag = inDefs ? green('● in list') : yellow('○ not in list');
      console.log('');
      console.log(`  [${i + 1}/${existing.length}] ${bold(l.name)} - KES ${l.price.toLocaleString()} ${tag}`);
      const ch = await askChoice('  [k]eep / [d]elete / [s]kip: ', ['k', 'd', 's', '']);
      if (ch === 'd') toDelete.push(l);
    }
  }

  // Plan
  const toInsert = LENSES.filter(
    (l) => !existing.some((e) => e.name.toLowerCase() === l.name.toLowerCase())
  );
  const toUpdate = LENSES.filter((l) => {
    const e = existing.find((x) => x.name.toLowerCase() === l.name.toLowerCase());
    return e && e.price !== l.price;
  });

  console.log('');
  console.log(bold(cyan('  Plan')));
  console.log(line());
  console.log(`  ${dim('Delete:')} ${toDelete.length ? red(toDelete.length) : gray(0)}`);
  console.log(`  ${dim('Insert:')} ${toInsert.length ? green(toInsert.length) : gray(0)}`);
  console.log(`  ${dim('Update price:')} ${toUpdate.length ? yellow(toUpdate.length) : gray(0)}`);

  if (toDelete.length === 0 && toInsert.length === 0 && toUpdate.length === 0) {
    console.log(gray(bold('  ℹ Nothing to change.')));
    await mongoose.disconnect();
    await rl.close();
    return;
  }

  const proceed = await askYesNo(bold('  Apply changes?'));
  if (!proceed) {
    console.log(yellow(bold('  ⊘ Aborted.')));
    await mongoose.disconnect();
    await rl.close();
    return;
  }

  for (const d of toDelete) {
    await LensType.findByIdAndDelete(d._id);
    console.log(`  ${red('−')} deleted ${d.name}`);
  }
  for (const l of LENSES) {
    const existingDoc = existing.find((e) => e.name.toLowerCase() === l.name.toLowerCase());
    if (existingDoc && toDelete.some((d) => d._id.toString() === existingDoc._id.toString())) {
      await LensType.create(l);
      console.log(`  ${green('+')} inserted ${l.name} (replaced) - KES ${l.price.toLocaleString()}`);
      continue;
    }
    if (!existingDoc) {
      await LensType.create(l);
      console.log(`  ${green('+')} inserted ${l.name} - KES ${l.price.toLocaleString()}`);
    } else if (existingDoc.price !== l.price) {
      await LensType.updateOne({ _id: existingDoc._id }, { price: l.price });
      console.log(`  ${yellow('~')} updated ${l.name}: ${existingDoc.price} → ${l.price}`);
    }
  }

  const after = await LensType.countDocuments();
  console.log('');
  console.log(line());
  console.log(`  ${dim('Before:')} ${existing.length}   ${dim('After:')} ${after}`);
  console.log(green(bold('  ✔ Seed complete')));
  console.log('');

  await mongoose.disconnect();
  await rl.close();
};

run().catch(async (e) => {
  console.error(red(`\n  ✖ ${e.message}`));
  try { await mongoose.disconnect(); } catch {}
  try { rl.close(); } catch {}
  process.exit(1);
});