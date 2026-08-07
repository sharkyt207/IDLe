/**
 * Browser test runner (GDD chapter 9: "testbar").
 *
 *   npm test              # every suite
 *   npm test -- ch7 ch8   # only these
 *
 * Boots the dev server, runs each suite against it in a real Chromium, and
 * fails the run if any suite throws or logs a console error. Each suite prints
 * a labelled line per check, so a diff between two runs is readable.
 *
 * These are deliberately end-to-end rather than unit tests: the game is one
 * simulation plus a DOM, and the questions worth asking ("does a levelled
 * machine actually produce more", "does the save survive a reload") only have
 * answers when the whole thing is running.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const PORT = Number(process.env.SCRAP_PORT ?? 5174);
const BASE = `http://localhost:${PORT}/`;

const only = process.argv.slice(2);
const suites = readdirSync(here)
  .filter((f) => f.endsWith('.mjs') && f !== 'run.mjs')
  .map((f) => f.replace('.mjs', ''))
  .filter((name) => only.length === 0 || only.includes(name))
  .sort();

if (suites.length === 0) {
  console.error('Keine Test-Suite gefunden.');
  process.exit(1);
}

/** Starts the dev server and resolves once it answers. */
async function startServer() {
  const server = spawn('npm', ['run', 'dev', '--', '--port', String(PORT)], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', () => undefined);
  server.stderr.on('data', () => undefined);

  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      const res = await fetch(BASE);
      if (res.ok) return server;
    } catch {
      /* not up yet */
    }
  }
  server.kill();
  throw new Error(`Dev-Server auf ${BASE} nicht erreichbar`);
}

function runSuite(name) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [resolve(here, `${name}.mjs`)], {
      cwd: root,
      env: { ...process.env, SCRAP_URL: BASE },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => resolveRun({ code, out, err }));
  });
}

const server = await startServer();
let failed = 0;

try {
  for (const name of suites) {
    const started = Date.now();
    const { code, out, err } = await runSuite(name);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    // A suite reports its own findings; the runner only judges pass/fail.
    const errorLine = out.split('\n').find((line) => line.startsWith('ERRORS:'));
    const clean = code === 0 && errorLine?.includes('none');

    console.log(`\n${clean ? '✅' : '❌'} ${name}  (${seconds}s)`);
    for (const line of out.trimEnd().split('\n')) if (line) console.log(`   ${line}`);
    if (!clean) {
      failed++;
      if (err.trim()) console.log(err.trimEnd());
    }
  }
} finally {
  server.kill();
}

console.log(`\n${suites.length - failed}/${suites.length} Suites bestanden.`);
process.exit(failed > 0 ? 1 : 0);
