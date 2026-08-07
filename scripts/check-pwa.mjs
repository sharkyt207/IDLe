/**
 * Installability check for the production build.
 *
 *   npm run pwa            # build already done? it is rebuilt anyway
 *
 * Serves `dist/` twice - once at the domain root, once under `/IDLe/` - and
 * runs `tests/pwa.mjs` against both. The second one is the shape GitHub Pages
 * actually deploys, and a relative base plus a service worker scope is exactly
 * where installable apps break on a project path.
 */
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(root, 'dist');
const PORT = Number(process.env.SCRAP_PORT ?? 4173);

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/ fehlt - erst `npm run build` ausführen.');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
};

/** Static server for one mount prefix, e.g. '/' or '/IDLe/'. */
function serve(prefix) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(prefix)) {
      res.writeHead(404).end('not found');
      return;
    }
    let rel = url.pathname.slice(prefix.length);
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = join(DIST, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      // A service worker under a project path must be allowed to claim it.
      'service-worker-allowed': prefix,
      'cache-control': 'no-cache',
    });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(PORT, () => ok(server)));
}

function runSuite(url) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [join(root, 'tests', 'pwa.mjs')], {
      cwd: root,
      env: { ...process.env, SCRAP_URL: url },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => done({ code, out, err }));
  });
}

let failed = 0;
for (const prefix of ['/', '/IDLe/']) {
  const server = await serve(prefix);
  const url = `http://localhost:${PORT}${prefix}`;
  const { code, out, err } = await runSuite(url);
  const errorLine = out.split('\n').find((line) => line.startsWith('ERRORS:'));
  const clean = code === 0 && errorLine?.includes('none');

  console.log(`\n${clean ? '✅' : '❌'} ${url}`);
  for (const line of out.trimEnd().split('\n')) if (line) console.log(`   ${line}`);
  if (!clean) {
    failed++;
    if (err.trim()) console.log(err.trimEnd());
  }
  await new Promise((ok) => server.close(ok));
}

console.log(`\n${2 - failed}/2 Bereitstellungen bestanden.`);
process.exit(failed > 0 ? 1 : 0);
