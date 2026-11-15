// server/scripts/seedICD11.js

import mongoose from 'mongoose';
import { env } from '../config/env.js';
import ICD11Code from '../models/ICD11Code.js';

// ─── DIAGNOSIS LIST ───
const CODES = [
  { code: '9D90', description: 'Mild distance vision impairment' },
  { code: '9D91', description: 'Moderate distance vision impairment' },
  { code: '9D92', description: 'Severe distance vision impairment' },
  { code: '9D93', description: 'Blindness' },
  { code: '9B76', description: 'Myopia' },
  { code: '9D45', description: 'Photophobia' },
  { code: '9C61', description: 'Hypermetropia' },
  { code: '9C62', description: 'Astigmatism' },
  { code: '9D00.1', description: 'Hyperopia' },
  { code: '9D00.3', description: 'Presbyopia' },
  { code: 'SK6A', description: 'Drye Eye Syndrome' },
  { code: '9C64', description: 'Anisometropia' },
  { code: '9B70', description: 'Glaucoma' },
  { code: '9B71', description: 'Cataract' },
  { code: '9A10', description: 'Conjunctivitis' },
  { code: '9A06.1', description: 'Dry Eye Syndrome' },
  { code: '9B10', description: 'Keratitis' },
  { code: '9B20', description: 'Corneal ulcer' },
  { code: '9C10', description: 'Retinal detachment' },
  { code: '9C20', description: 'Diabetic retinopathy' },
  { code: '9C30', description: 'Age-related macular degeneration' },
  { code: '9C40', description: 'Amblyopia' },
  { code: '9C50', description: 'Strabismus' },
];
// ──────────────────────

// ─── Tiny ANSI helpers (Windows 10+ supports these in modern terminals) ───
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold   = c('1');
const dim    = c('2');
const red    = c('31');
const green  = c('32');
const yellow = c('33');
const blue   = c('34');
const magenta= c('35');
const cyan   = c('36');
const gray   = c('90');

const pad = (s, n) => String(s).padEnd(n);
const line = (ch = '─', n = 60) => gray(ch.repeat(n));

// ─── Validate the local definition list before touching the DB ───
const validateDefinitions = () => {
  const errors = [];
  const seen = new Set();
  CODES.forEach((entry, i) => {
    const where = `entry #${i + 1}`;
    if (!entry || typeof entry !== 'object') {
      errors.push(`${where}: not an object`);
      return;
    }
    const code = String(entry.code || '').trim().toUpperCase();
    const desc = String(entry.description || '').trim();
    if (!code) errors.push(`${where}: missing 'code'`);
    if (!desc) errors.push(`${where}: missing 'description'`);
    if (code && seen.has(code)) errors.push(`${where}: duplicate code "${code}"`);
    if (code) seen.add(code);
    if (code.length > 20) errors.push(`${where}: code "${code}" exceeds 20 chars`);
    if (desc.length > 200) errors.push(`${where}: description exceeds 200 chars`);
  });
  return errors;
};

const run = async () => {
  console.log('');
  console.log(bold(cyan('  Cynert Optical - ICD-11 Codes Seed')));
  console.log(line());

  // 1. Validate definitions
  const validationErrors = validateDefinitions();
  if (validationErrors.length) {
    console.log(red(bold('  ✖ Validation failed - nothing was written to the database')));
    validationErrors.forEach((e) => console.log(`    ${red('•')} ${e}`));
    console.log(line());
    process.exit(1);
  }
  console.log(`  ${dim('Definition entries:')} ${bold(String(CODES.length))}`);
  console.log('');

  // 2. Connect
  try {
    await mongoose.connect(env.MONGO_URI);
  } catch (e) {
    console.log(red(`  ✖ Could not connect to MongoDB: ${e.message}`));
    console.log(line());
    process.exit(1);
  }
  console.log(`  ${green('✔')} ${dim('Connected to MongoDB')}`);
  console.log('');

  const before = await ICD11Code.countDocuments();
  console.log(`  ${dim('Existing codes in DB before seed:')} ${bold(String(before))}`);
  console.log('');
  console.log(line('·'));

  // 3. Upsert
  const inserted = [];
  const updated = [];
  const unchanged = [];
  const failures = [];

  for (const entry of CODES) {
    const code = entry.code.trim().toUpperCase();
    const description = entry.description.trim();

    try {
      const existing = await ICD11Code.findOne({ code });
      if (!existing) {
        await ICD11Code.create({ code, description });
        inserted.push({ code, description });
        console.log(`  ${green('+')} ${bold(pad(code, 6))} ${dim('→')} ${description}`);
      } else if (existing.description !== description) {
        const oldDesc = existing.description;
        existing.description = description;
        await existing.save();
        updated.push({ code, from: oldDesc, to: description });
        console.log(`  ${yellow('~')} ${bold(pad(code, 6))} ${dim('→')} ${dim(oldDesc)} ${dim('→')} ${description}`);
      } else {
        unchanged.push({ code, description });
        console.log(`  ${gray('·')} ${gray(pad(code, 6))} ${gray('(unchanged)')}`);
      }
    } catch (e) {
      failures.push({ code, error: e.message });
      console.log(`  ${red('✖')} ${bold(pad(code, 6))} ${red(e.message)}`);
    }
  }

  const after = await ICD11Code.countDocuments();

  // 4. Final summary box
  console.log(line('·'));
  console.log('');
  const label = (lbl, val, color = bold) =>
    `  ${dim(pad(lbl, 22))} ${color(String(val))}`;

  console.log(bold(cyan('  Summary')));
  console.log(line());
  console.log(label('Total defined', CODES.length));
  console.log(label('Inserted (new)', inserted.length, inserted.length ? green : gray));
  console.log(label('Updated (changed)', updated.length, updated.length ? yellow : gray));
  console.log(label('Skipped (unchanged)', unchanged.length, gray));
  console.log(label('Failed', failures.length, failures.length ? red : gray));
  console.log(line());
  console.log(label('DB before', before));
  console.log(label('DB after', after, after > before ? green : bold));
  console.log(label('Net change', `${after - before >= 0 ? '+' : ''}${after - before}`, after - before > 0 ? green : gray));
  console.log(line());

  if (inserted.length) {
    console.log('');
    console.log(bold(green(`  ✔ Inserted (${inserted.length})`)));
    inserted.forEach((i) => console.log(`    ${green('+')} ${pad(i.code, 6)} ${i.description}`));
  }
  if (updated.length) {
    console.log('');
    console.log(bold(yellow(`  ~ Updated (${updated.length})`)));
    updated.forEach((u) => console.log(`    ${yellow('~')} ${pad(u.code, 6)} ${dim(u.from)} → ${u.to}`));
  }
  if (failures.length) {
    console.log('');
    console.log(bold(red(`  ✖ Failed (${failures.length})`)));
    failures.forEach((f) => console.log(`    ${red('✖')} ${pad(f.code, 6)} ${f.error}`));
  }

  console.log('');
  const verdict =
    failures.length > 0
      ? red(bold('  ✖ Completed with errors'))
      : inserted.length + updated.length === 0
      ? gray(bold('  ℹ Nothing to change - DB already up to date'))
      : green(bold('  ✔ Seed complete'));
  console.log(verdict);
  console.log('');

  await mongoose.disconnect();
  process.exit(failures.length > 0 ? 1 : 0);
};

run().catch(async (e) => {
  console.error(red(`\n  ✖ Unexpected error: ${e.message}`));
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});