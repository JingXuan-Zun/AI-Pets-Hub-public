import assert from 'node:assert/strict';
import { readModuleProjectFile } from './projectModuleSource.mjs';
import path from 'node:path';

export const projectRoot = process.cwd();

export function projectPath(relativePath: string) {
  return path.join(projectRoot, relativePath);
}

export function readProjectFile(relativePath: string) {
  return readModuleProjectFile(relativePath);
}

export function readProjectSources<T extends Record<string, string>>(
  sources: T,
): { [K in keyof T]: string } {
  return Object.fromEntries(
    Object.entries(sources).map(([key, relativePath]) => [
      key,
      readProjectFile(relativePath),
    ]),
  ) as { [K in keyof T]: string };
}

export function assertSourceMatches(source: string, pattern: RegExp, message?: string) {
  assert.match(source, pattern, message);
}

export function assertSourceDoesNotMatch(source: string, pattern: RegExp, message?: string) {
  assert.doesNotMatch(source, pattern, message);
}

export function assertSourceExportsFunction(source: string, functionName: string, message?: string) {
  assertSourceMatches(
    source,
    new RegExp(`export function ${functionName}`, 'u'),
    message,
  );
}
