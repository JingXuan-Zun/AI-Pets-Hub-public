#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const template = path.join(root, 'scripts', 'git-hooks', 'pre-push');
const gitPath = execFileSync('git', ['-C', root, 'rev-parse', '--git-path', 'hooks/pre-push'], {
  encoding: 'utf8',
  windowsHide: true,
}).trim();
const destination = path.resolve(root, gitPath);
const marker = 'AI-PETS-HUB-PRIVACY-HOOK';

if (existsSync(destination) && !readFileSync(destination, 'utf8').includes(marker)) {
  throw new Error('An existing pre-push hook was found. Merge the privacy check into it manually.');
}

mkdirSync(path.dirname(destination), { recursive: true });
copyFileSync(template, destination);
chmodSync(destination, 0o755);
console.log('Local privacy pre-push hook installed.');
