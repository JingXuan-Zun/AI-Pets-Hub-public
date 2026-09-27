import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const latestInfoPath = path.join(projectRoot, 'release', 'LATEST_BUILD.txt');
const latestInfo = new Map();

for (const line of (await readFile(latestInfoPath, 'utf8')).split(/\r?\n/u)) {
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
