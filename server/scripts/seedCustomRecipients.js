// server/scripts/seedCustomRecipients.js
import mongoose from 'mongoose';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { env } from '../config/env.js';
import CustomRecipient from '../models/CustomRecipient.js';

// ─── MAIL RECIPIENTS LIST ───
const RECIPIENTS = [
  { name: 'Cynert Claims Mail', email: 'claims@cynerthospitalandrehab.org', label: 'Cynert Mail' },
  { name: 'MJK Captain', email: 'jkarranja@gmail.com', label: 'Captain Mail' },
  { name: 'Finance', email: 'cynerthospital@gmail.com', label: 'Cynert Finance' },
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
    console.log(red(`  ✖ Enter one of: ${valid.join(', ')}`));
  }
};

const validateDefinitions = () => {
  const errors = [];
  const seen = new Set();
  RECIPIENTS.forEach((r, i) => {
    const email = (r.email || '').trim().toLowerCase();
    if (!r.name || !r.name.trim()) errors.push(`entry #${i + 1}: missing name`);
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) errors.push(`entry #${i + 1}: invalid email`);
    if (email && seen.has(email)) errors.push(`entry #${i + 1}: duplicate email "${email}"`);
    seen.add(email);
  });
  return errors;
};

const run = async () => {
  console.log('');
  console.log(bold(cyan('  Cynert Optical - Custom Recipients Seed')));
  console.log(line());

  const errors = validateDefinitions();
  if (errors.length) {
    console.log(red(bold('  ✖ Validation failed')));
    errors.forEach((e) => console.log(`    ${red('•')} ${e}`));
    await rl.close();
    process.exit(1);
  }
  console.log(`  ${dim('Definition entries:')} ${bold(String(RECIPIENTS.length))}`);

  await mongoose.connect(env.MONGO_URI);
  console.log(`  ${green('✔')} ${dim('Connected to MongoDB')}`);

  const existing = await CustomRecipient.find().sort({ name: 1 }).lean();
  console.log(`  ${dim('Existing in DB:')} ${bold(String(existing.length))}`);
  console.log(line());

  let mode = 'skip';
  if (existing.length > 0) {
    console.log('');
    console.log(bold(cyan('  What to do with existing recipients?')));
    console.log(`  ${bold('[1]')} Review one-by-one`);
    console.log(`  ${bold('[2]')} Delete ALL and reseed`);
    console.log(`  ${bold('[3]')} Skip review`);
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
    const sure = await askYesNo(red(`  Delete all ${existing.length} existing recipient(s)?`), 'n');
    if (!sure) {
      console.log(yellow(bold('  ⊘ Cancelled.')));
      await mongoose.disconnect();
      await rl.close();
      return;
    }
    toDelete = [...existing];
  } else if (mode === 'review') {
    for (let i = 0; i < existing.length; i++) {
      const r = existing[i];
      console.log('');
      console.log(`  [${i + 1}/${existing.length}] ${bold(r.name)} <${r.email}>`);
      const ch = await askChoice('  [k]eep / [d]elete / [s]kip: ', ['k', 'd', 's', '']);
      if (ch === 'd') toDelete.push(r);
    }
  }

  // Plan
  const toInsert = RECIPIENTS.filter(
    (r) => !existing.some((e) => e.email.toLowerCase() === r.email.toLowerCase())
  );

  console.log('');
  console.log(bold(cyan('  Plan')));
  console.log(line());
  console.log(`  ${dim('Delete:')} ${toDelete.length ? red(toDelete.length) : gray(0)}`);
  console.log(`  ${dim('Insert:')} ${toInsert.length ? green(toInsert.length) : gray(0)}`);

  if (toDelete.length === 0 && toInsert.length === 0) {
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
    await CustomRecipient.findByIdAndDelete(d._id);
    console.log(`  ${red('−')} deleted ${d.email}`);
  }
  for (const r of toInsert) {
    try {
      await CustomRecipient.create(r);
      console.log(`  ${green('+')} inserted ${r.email}`);
    } catch (e) {
      console.log(`  ${red('✖')} failed ${r.email}: ${e.message}`);
    }
  }

  const after = await CustomRecipient.countDocuments();
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