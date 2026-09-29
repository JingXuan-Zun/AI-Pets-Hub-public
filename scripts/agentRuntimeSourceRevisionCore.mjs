import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.cjs', '.js', '.json', '.mjs', '.ts', '.tsx']);
const ROOT_SOURCE_FILES = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
];

function getExtension(fileName) {
  const index = fileName.lastIndexOf('.');
  return index >= 0 ? fileName.slice(index).toLowerCase() : '';
}
function listSourceFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(filePath);
    return SOURCE_EXTENSIONS.has(getExtension(entry.name)) ? [filePath] : [];
  });
}

export function listAgentRuntimeSourceRevisionFiles(rootDir = process.cwd()) {
  return [
    ...ROOT_SOURCE_FILES.map((file) => join(rootDir, file)).filter(existsSync),
    ...listSourceFiles(join(rootDir, 'src')),
    ...listSourceFiles(join(rootDir, 'electron')),
  ].sort((left, right) => (
    relative(rootDir, left).localeCompare(relative(rootDir, right), 'en')
  ));
}

export function createAgentRuntimeSourceRevision(rootDir = process.cwd()) {
  const files = listAgentRuntimeSourceRevisionFiles(rootDir);
  const hash = createHash('sha256');
  for (const filePath of files) {
    const relativePath = relative(rootDir, filePath).replaceAll('\\', '/');
    hash.update(relativePath);
    hash.update('\0');
    hash.update(readFileSync(filePath));
    hash.update('\0');
  }
  return {
    fileCount: files.length,
    revision: `runtime-source-sha256:${hash.digest('hex')}`,
  };
}
