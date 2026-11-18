// Runs every scripts/*-smoke.* file and reports which ones fail.
//
// Usage:
//   node scripts/run-smokes.mjs                    all smokes; fails only on NEW failures
//   node scripts/run-smokes.mjs --filter mcp       only files whose name contains "mcp"
//   node scripts/run-smokes.mjs --strict           known failures count as failures too
//   node scripts/run-smokes.mjs --update-baseline  rewrite the known-failures list from this run
//
// scripts/smoke-known-failures.json lists smokes that already failed when the list was last
// written. They still run; one that passes again is reported so it can be taken off the list.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsDir, '..');
const baselinePath = path.join(scriptsDir, 'smoke-known-failures.json');
const SMOKE_FILE = /-smoke\.(?:ts|cts|cjs|mjs)$/u;
const TIMEOUT_MS = 90_000;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const filterIndex = args.indexOf('--filter');
const filter = filterIndex >= 0 ? (args[filterIndex + 1] ?? '') : '';
const concurrency = Math.max(2, Math.min(8, os.cpus().length - 2));

const files = fs.readdirSync(scriptsDir)
  .filter((name) => SMOKE_FILE.test(name) && (!filter || name.includes(filter)))
  .sort();

function readBaseline() {
  try {
    const parsed = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    return new Set(Array.isArray(parsed.knownFailures) ? parsed.knownFailures : []);
  } catch {
    return new Set();
  }
}

function runOne(name) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    // A smoke that has to run inside Electron comes with <name>-runner.cjs, which starts Electron
    // for it (electron-credential-storage); plain node cannot run the smoke file itself.
    const runner = name.replace(/-smoke\.cjs$/u, '-runner.cjs');
    const entry = runner !== name && fs.existsSync(path.join(scriptsDir, runner)) ? runner : name;
    const isTypeScript = /\.c?ts$/u.test(entry);
    const child = spawn(
      process.execPath,
      // The second import teaches Node the non-code imports Vite handles (see harness/vite-asset-hooks.mjs).
      [...(isTypeScript ? ['--import', 'tsx', '--import', './scripts/harness/register-vite-asset-hooks.mjs'] : []), path.join('scripts', entry)],
      { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );
    let output = '';
    const keep = (chunk) => { output = (output + chunk).slice(-4000); };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, TIMEOUT_MS);
    child.on('error', (error) => { keep(String(error)); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ name, ok: code === 0 && !timedOut, output, seconds: (Date.now() - startedAt) / 1000, timedOut });
    });
  });
}

const results = [];
let next = 0;
async function worker() {
  while (next < files.length) {
    const name = files[next];
    next += 1;
    results.push(await runOne(name));
    if (results.length % 50 === 0) console.log(`  ${results.length} / ${files.length}`);
  }
}

const startedAt = Date.now();
console.log(`Running ${files.length} smokes, ${concurrency} at a time...`);
await Promise.all(Array.from({ length: concurrency }, worker));

const failed = results.filter((result) => !result.ok).map((result) => result.name).sort();
const baseline = readBaseline();
const strict = flag('--strict');
const newFailures = failed.filter((name) => strict || !baseline.has(name));
const knownFailures = failed.filter((name) => !strict && baseline.has(name));
const fixed = [...baseline].filter((name) => files.includes(name) && !failed.includes(name)).sort();

if (flag('--update-baseline') && !filter) {
  fs.writeFileSync(baselinePath, `${JSON.stringify({
    note: 'Smokes that already failed when this list was written. Fix or delete them; do not add new ones to hide a regression.',
    updatedAt: new Date().toISOString().slice(0, 10),
    knownFailures: failed,
  }, null, 2)}\n`);
  console.log(`Baseline written: ${failed.length} known failures.`);
}

const firstLines = (text) => text.trim().split(/\r?\n/u).filter((line) => /error|assert|expected|cannot|not found/iu.test(line)).slice(0, 2).join(' | ').slice(0, 300);
for (const name of newFailures) {
  const result = results.find((entry) => entry.name === name);
  console.log(`\nFAIL ${name}${result.timedOut ? ' (timed out)' : ''}\n  ${firstLines(result.output) || result.output.trim().split(/\r?\n/u).slice(-2).join(' | ').slice(0, 300)}`);
}
if (fixed.length) console.log(`\nPassing again (take off the known-failures list):\n  ${fixed.join('\n  ')}`);

console.log(`\n${results.length - failed.length} passed, ${newFailures.length} new failures, ${knownFailures.length} known failures, ${Math.round((Date.now() - startedAt) / 1000)}s`);
process.exit(newFailures.length && !flag('--update-baseline') ? 1 : 0);
