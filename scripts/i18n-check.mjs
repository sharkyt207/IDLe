/**
 * Localization report (GDD chapter 9).
 *
 *   npm run i18n
 *
 * Lists, per locale, how many interface keys are still missing, and flags keys
 * whose placeholders do not match the German source - a translation that drops
 * a `{amount}` produces a label with a hole in it, which type checking cannot
 * catch because both sides are strings.
 *
 * Also scans the UI for German string literals that never went through `t()`,
 * so a newly added screen cannot quietly reintroduce hardcoded text.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Pulls `'key': 'value'` pairs out of a locale file without importing it. */
function readLocale(file) {
  const source = readFileSync(join(root, 'src/locales', file), 'utf8');
  const ui = source.slice(source.indexOf('ui: {'));
  const entries = {};
  const pattern = /^\s{4}'([^']+)':\s*(?:'((?:[^'\\]|\\.)*)'|\n?\s*'((?:[^'\\]|\\.)*)')/gm;
  let match;
  while ((match = pattern.exec(ui))) entries[match[1]] = match[2] ?? match[3] ?? '';
  return entries;
}

const de = readLocale('de.ts');
const en = readLocale('en.ts');
const total = Object.keys(de).length;

console.log(`\n=== Lokalisierung ===\n`);
console.log(`Quelle (de): ${total} Schlüssel\n`);

const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

let problems = 0;
for (const [id, table] of [
  ['en', en],
  ['fr', {}],
  ['es', {}],
  ['it', {}],
  ['pl', {}],
  ['tr', {}],
  ['ja', {}],
]) {
  const missing = Object.keys(de).filter((key) => table[key] === undefined);
  const mismatched = Object.keys(de).filter(
    (key) => table[key] !== undefined && placeholders(de[key]) !== placeholders(table[key]),
  );
  const done = total - missing.length;
  const bar = '█'.repeat(Math.round((done / total) * 20)).padEnd(20, '░');
  console.log(`  ${id}  ${bar}  ${done}/${total}`);
  for (const key of mismatched) {
    problems++;
    console.log(`      ⚠ Platzhalter weichen ab: ${key}`);
  }
}

// --- hardcoded UI strings ---------------------------------------------------
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** Umlauts or a German-looking word are a good enough smell test. */
const GERMAN = /'[^']*(?:[äöüÄÖÜß]|\b(?:und|oder|nicht|kein|keine|wird|noch|mehr|Stufe|Geld|Lager)\b)[^']*'/;
const IGNORE = /\/\/|\* |t\(|tc\(|console\.|log\./;

const suspects = [];
for (const file of walk(join(root, 'src/ui'))) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (IGNORE.test(line)) return;
    const hit = GERMAN.exec(line);
    if (hit) suspects.push(`${file.replace(root + '/', '')}:${index + 1}  ${hit[0].slice(0, 60)}`);
  });
}

console.log(`\nNicht übersetzte Zeichenketten in src/ui: ${suspects.length}`);
for (const line of suspects.slice(0, 25)) console.log(`  ${line}`);
if (suspects.length > 25) console.log(`  … und ${suspects.length - 25} weitere`);

console.log('');
process.exitCode = problems > 0 ? 1 : 0;
