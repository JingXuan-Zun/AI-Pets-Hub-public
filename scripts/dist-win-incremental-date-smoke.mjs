import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const latestInfoPath = path.join(projectRoot, 'release', 'LATEST_BUILD.txt');
const latestInfo = new Map();

// Checks the output of `npm run dist:win` (the incremental build). With no build on this machine,
// or when the latest build was a full one (dist:win:fresh writes no incremental_generated_at),
// there is nothing to check.
const latestInfoText = await readFile(latestInfoPath, 'utf8').catch(() => null);
if (latestInfoText === null || !/^incremental_generated_at=/mu.test(latestInfoText)) {
  console.log('dist-win incremental date smoke skipped: the latest build is not an incremental one');
  process.exit(0);
}

for (const line of latestInfoText.split(/\r?\n/u)) {
  const separatorIndex = line.indexOf('=');
  if (separatorIndex > 0) {
    latestInfo.set(line.slice(0, separatorIndex), line.slice(separatorIndex + 1));
  }
}

const latestBuild = latestInfo.get('latest_build');
const generatedAtText = latestInfo.get('incremental_generated_at');
assert.ok(latestBuild, 'LATEST_BUILD.txt must contain latest_build.');
assert.ok(generatedAtText, 'LATEST_BUILD.txt must contain incremental_generated_at.');

const launcherPath = path.join(latestBuild, 'win-unpacked', 'AI Desktop Pet.exe');
const launcherStat = await stat(launcherPath);
const generatedAt = new Date(generatedAtText);
const timestampToleranceMs = 2_000;

assert.ok(
  launcherStat.mtimeMs >= generatedAt.getTime() - timestampToleranceMs,
  [
    'Packaged launcher timestamp is older than the latest incremental package.',
    `Launcher: ${launcherStat.mtime.toISOString()}`,
    `Incremental package: ${generatedAt.toISOString()}`,
  ].join('\n'),
);

console.log('PASS: packaged launcher date matches the latest incremental package.');
