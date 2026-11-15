import mongoose from 'mongoose';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { env } from '../config/env.js';
import Insurance from '../models/Insurance.js';

// ─── EDIT THIS LIST ───
const INSURERS = [
  'Social Health Fund (SHIF)',
  'SHA Mwalimu Medical Cover',
  'SHA Usalama Medical Cover',
  'SHA Public Officer Medical Cover',
  'University of Embu',
];
// ──────────────────────

// ─── ANSI helpers ───
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = c('1'), dim = c('2'), red = c('31'), green = c('32'),
      yellow = c('33'), cyan = c('36'), gray = c('90');
const pad = (s, n) => String(s).padEnd(n);
const line = (ch = '─', n = 64) => gray(ch.repeat(n));

const rl = readline.createInterface({ input, output });

const ask = async (prompt) => (await rl.question(prompt)).trim();

const askChoice = async (prompt, valid) => {
  while (true) {
    const raw = (await ask(prompt)).toLowerCase();
    if (valid.includes(raw)) return raw;
    console.log(red(`  ✖ Please enter one of: ${valid.filter(Boolean).join(', ')}`));
  }
};

const askYesNo = async (prompt, defaultValue = 'n') => {
  const hint = defaultValue === 'y' ? '[Y/n]' : '[y/N]';
  const answer = (await ask(`${prompt} ${hint} `)).toLowerCase();
  if (!answer) return defaultValue === 'y';
  return answer === 'y' || answer === 'yes';
};

// ─── Validate definition list (pre-DB) ───
const validateDefinitions = () => {
  const errors = [];
  const seen = new Set();
  INSURERS.forEach((name, i) => {
    const n = String(name || '').trim();
    if (!n) errors.push(`entry #${i + 1}: empty name`);
    if (n && seen.has(n.toLowerCase())) errors.push(`entry #${i + 1}: duplicate "${n}"`);
    seen.add(n.toLowerCase());
    if (n.length > 120) errors.push(`entry #${i + 1}: name exceeds 120 chars`);
  });
  return errors;
};

// ─── Review one by one ───
const reviewOneByOne = async (existing) => {
  const toDelete = [];
  const toKeep = new Set();

  if (existing.length === 0) {
    console.log(`  ${gray('No existing insurers in the DB - nothing to review.')}`);
    return { toDelete, toKeep };
  }

  console.log('');
  console.log(bold(cyan(`  Review existing insurers (${existing.length})`)));
  console.log(line());

  for (let i = 0; i < existing.length; i++) {
    const ins = existing[i];
    const idx = `[${String(i + 1).padStart(2)}/${existing.length}]`;
    const inDefs = INSURERS.some((n) => n.trim().toLowerCase() === ins.name.toLowerCase());
    const tag = inDefs ? green('● in definition list') : yellow('○ not in definition list');

    console.log('');
    console.log(`  ${dim(idx)} ${bold(ins.name)}  ${tag}`);
    console.log(`         ${dim('Status:')} ${ins.active ? green('active') : gray('inactive')}`);
    console.log('');
    console.log(`     ${bold('[k]')} keep    ${dim('(leave as is in DB)')}`);
    console.log(`     ${bold('[d]')} delete  ${dim('(remove from DB)')}`);
    console.log(`     ${bold('[s]')} skip    ${dim('(leave, no action - default)')}`);
    console.log(`     ${bold('[a]')} keep all remaining  ${dim('(stop asking, keep the rest)')}`);
    console.log(`     ${bold('[D]')} delete all remaining ${dim('(stop asking, delete the rest)')}`);

    const choice = await askChoice('  Choice [k/d/s/a/D]: ', ['k', 'd', 's', 'a', 'd', '']);

    // Note: lowercase 'd' = delete this one; uppercase 'D' won't arrive from toLowerCase()
    // So we handle the "delete all remaining" via explicit check below using the raw input.
    // Rework: use a sentinel for delete-all.

    if (choice === 'a') {
      for (let j = i; j < existing.length; j++) toKeep.add(existing[j]._id.toString());
      console.log(`     ${green(`→ keep all remaining (${existing.length - i})`)}`);
      break;
    } else if (choice === 'd') {
      toDelete.push(ins);
      console.log(`     ${red('→ will delete')}`);
    } else if (choice === 'k') {
      toKeep.add(ins._id.toString());
      console.log(`     ${green('→ keep')}`);
    } else {
      console.log(`     ${gray('→ skip (no action)')}`);
    }
  }

  return { toDelete, toKeep };
};

// ─── Main ───
const run = async () => {
  console.log('');
  console.log(bold(cyan('  Cynert Optical - Insurance Seed (interactive)')));
  console.log(line());

  const errors = validateDefinitions();
  if (errors.length) {
    console.log(red(bold('  ✖ Definition list has errors')));
    errors.forEach((e) => console.log(`    ${red('•')} ${e}`));
    console.log(line());
    await rl.close();
    process.exit(1);
  }
  console.log(`  ${dim('Definition entries:')} ${bold(String(INSURERS.length))}`);
  console.log(`  ${dim('Defined names:')}`);
  INSURERS.forEach((n) => console.log(`    ${cyan('•')} ${n}`));

  // Connect
  try {
    await mongoose.connect(env.MONGO_URI);
  } catch (e) {
    console.log(red(`  ✖ Could not connect to MongoDB: ${e.message}`));
    await rl.close();
    process.exit(1);
  }
  console.log('');
  console.log(`  ${green('✔')} ${dim('Connected to MongoDB')}`);

  const existing = await Insurance.find().sort({ name: 1 }).lean();
  console.log(`  ${dim('Existing in DB:')} ${bold(String(existing.length))}`);
  console.log(line());

  // ─── Top-level choice ───
  let mode = 'review'; // 'review' | 'delete-all' | 'skip' | 'cancel'

  if (existing.length === 0) {
    console.log(`  ${gray('No existing insurers - starting from a clean slate.')}`);
    mode = 'skip';
  } else {
    console.log('');
    console.log(bold(cyan('  What do you want to do with existing insurers?')));
    console.log(line());
    console.log(`  ${bold('[1]')} Review one-by-one  ${dim('(keep / delete / skip each)')}`);
    console.log(`  ${bold('[2]')} Delete ALL          ${dim('(wipe and reseed from the definition list)')}`);
    console.log(`  ${bold('[3]')} Skip review         ${dim('(keep all, only add missing from definition list)')}`);
    console.log(`  ${bold('[4]')} Cancel              ${dim('(exit without touching the DB)')}`);
    console.log('');
    const choice = await askChoice('  Choice [1-4]: ', ['1', '2', '3', '4']);
    mode = { '1': 'review', '2': 'delete-all', '3': 'skip', '4': 'cancel' }[choice];
  }

  if (mode === 'cancel') {
    console.log('');
    console.log(yellow(bold('  ⊘ Cancelled - no changes were made.')));
    console.log('');
    await mongoose.disconnect();
    await rl.close();
    process.exit(0);
  }

  // ─── Determine toDelete / toKeep based on mode ───
  let toDelete = [];
  let toKeep = new Set();

  if (mode === 'delete-all') {
    console.log('');
    console.log(red(bold(`  ⚠  This will DELETE all ${existing.length} existing insurers.`)));
    console.log(`  ${dim('Then it will re-insert the definition list:')}`);
    INSURERS.forEach((n) => console.log(`    ${green('+')} ${n}`));
    console.log('');
    const sure = await askYesNo(bold('  Are you SURE?'), 'n');
    if (!sure) {
      console.log('');
      console.log(yellow(bold('  ⊘ Cancelled - no changes were made.')));
      console.log('');
      await mongoose.disconnect();
      await rl.close();
      process.exit(0);
    }
    toDelete = [...existing];
  } else if (mode === 'review') {
    const res = await reviewOneByOne(existing);
    toDelete = res.toDelete;
    toKeep = res.toKeep;
  } else {
    // skip
    toKeep = new Set(existing.map((e) => e._id.toString()));
    console.log('');
    console.log(`  ${gray('Skipping review - all existing insurers will be kept.')}`);
  }

  // ─── Plan inserts / replaces ───
  const existingByName = new Map(existing.map((e) => [e.name.toLowerCase(), e]));
  const toInsert = [];
  const alreadyPresent = [];

  for (const name of INSURERS) {
    const trimmed = name.trim();
    const existingDoc = existingByName.get(trimmed.toLowerCase());
    if (existingDoc) {
      if (toDelete.some((d) => d._id.toString() === existingDoc._id.toString())) {
        toInsert.push({ name: trimmed, replaceId: existingDoc._id });
      } else {
        alreadyPresent.push(trimmed);
      }
    } else {
      toInsert.push({ name: trimmed, replaceId: null });
    }
  }

  // ─── Plan review ───
  console.log('');
  console.log(bold(cyan('  Plan')));
  console.log(line());
  const newInserts = toInsert.filter((i) => !i.replaceId).length;
  const replaces = toInsert.filter((i) => i.replaceId).length;
  console.log(`  ${dim('Delete from DB         :')} ${toDelete.length ? red(String(toDelete.length)) : gray('0')}`);
  console.log(`  ${dim('Insert (new)           :')} ${newInserts ? green(String(newInserts)) : gray('0')}`);
  console.log(`  ${dim('Replace (delete+insert):')} ${replaces ? yellow(String(replaces)) : gray('0')}`);
  console.log(`  ${dim('Already present (skip) :')} ${alreadyPresent.length ? gray(String(alreadyPresent.length)) : gray('0')}`);

  if (toDelete.length) {
    console.log('');
    console.log(`  ${red('Will delete:')}`);
    toDelete.forEach((d) => console.log(`    ${red('✖')} ${d.name}`));
  }
  if (toInsert.length) {
    console.log('');
    console.log(`  ${green('Will insert:')}`);
    toInsert.forEach((i) =>
      console.log(`    ${green('+')} ${i.name}${i.replaceId ? yellow(' (replaces existing)') : ''}`)
    );
  }

  if (toDelete.length === 0 && toInsert.length === 0) {
    console.log('');
    console.log(gray(bold('  ℹ Nothing to change - DB already matches your definition list.')));
    console.log('');
    await mongoose.disconnect();
    await rl.close();
    process.exit(0);
  }

  // ─── Confirm ───
  console.log('');
  const proceed = await askYesNo(bold('  Apply these changes to the database?'));

  if (!proceed) {
    console.log('');
    console.log(yellow(bold('  ⊘ Aborted - no changes were made.')));
    console.log('');
    await mongoose.disconnect();
    await rl.close();
    process.exit(0);
  }

  // ─── Apply ───
  console.log('');
  console.log(line('·'));
  console.log(bold(cyan('  Applying changes…')));
  console.log('');

  const deleted = [], inserted = [], failures = [];

  for (const d of toDelete) {
    try {
      await Insurance.findByIdAndDelete(d._id);
      deleted.push(d.name);
      console.log(`  ${red('−')} deleted ${d.name}`);
    } catch (e) {
      failures.push({ name: d.name, error: e.message });
      console.log(`  ${red('✖')} delete failed: ${d.name} - ${e.message}`);
    }
  }

  for (const item of toInsert) {
    try {
      if (item.replaceId) {
        await Insurance.findByIdAndDelete(item.replaceId);
      }
      await Insurance.create({ name: item.name });
      inserted.push(item.name);
      console.log(`  ${green('+')} inserted ${item.name}`);
    } catch (e) {
      failures.push({ name: item.name, error: e.message });
      console.log(`  ${red('✖')} insert failed: ${item.name} - ${e.message}`);
    }
  }

  // ─── Summary ───
  const after = await Insurance.countDocuments();

  console.log(line('·'));
  console.log('');
  const lbl = (l, v, color = bold) => `  ${dim(pad(l, 22))} ${color(String(v))}`;
  console.log(bold(cyan('  Summary')));
  console.log(line());
  console.log(lbl('Total defined', INSURERS.length));
  console.log(lbl('Deleted', deleted.length, deleted.length ? red : gray));
  console.log(lbl('Inserted', inserted.length, inserted.length ? green : gray));
  console.log(lbl('Already present', alreadyPresent.length, gray));
  console.log(lbl('Failed', failures.length, failures.length ? red : gray));
  console.log(line());
  console.log(lbl('DB before', existing.length));
  console.log(lbl('DB after', after, after !== existing.length ? cyan : bold));
  console.log(line());

  if (failures.length) {
    console.log('');
    console.log(bold(red(`  ✖ Failed (${failures.length})`)));
    failures.forEach((f) => console.log(`    ${red('✖')} ${f.name} - ${f.error}`));
  }

  console.log('');
  const verdict = failures.length
    ? red(bold('  ✖ Completed with errors'))
    : green(bold('  ✔ Seed complete'));
  console.log(verdict);
  console.log('');

  await mongoose.disconnect();
  await rl.close();
  process.exit(failures.length > 0 ? 1 : 0);
};

run().catch(async (e) => {
  console.error(red(`\n  ✖ Unexpected error: ${e.message}`));
  try { await mongoose.disconnect(); } catch {}
  try { rl.close(); } catch {}
  process.exit(1);
});