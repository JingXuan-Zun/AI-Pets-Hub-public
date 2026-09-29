#!/usr/bin/env node

// Audits files that Git could publish. Match values are deliberately never printed.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const rootIndex = args.indexOf('--root');
const root = path.resolve(rootIndex < 0 ? process.cwd() : args[rootIndex + 1] ?? '');
const includeUntracked = args.includes('--include-untracked');
const strict = args.includes('--strict');
const showHints = args.includes('--hints');
const maxListIndex = args.indexOf('--max-list');
const maxList = maxListIndex < 0 ? 100 : Math.max(0, Number(args[maxListIndex + 1] ?? 0));
const maxBytes = 8 * 1024 * 1024;
const baselinePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public-privacy-baseline.json');
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));

function git(parameters, encoding = 'utf8') {
  const result = spawnSync('git', ['-C', root, ...parameters], {
    encoding,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`Git command failed: ${parameters[0]} ${parameters[1] ?? ''}`);
  }
  return result.stdout;
}

function gitPaths(parameters) {
  return git(parameters, 'buffer')
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((name) => name.replaceAll('\\', '/'));
}

const tracked = new Set(gitPaths(['ls-files', '-z']));
const paths = new Set(tracked);
if (includeUntracked) {
  for (const name of gitPaths(['ls-files', '--others', '--exclude-standard', '-z'])) {
    paths.add(name);
  }
}

const findings = new Map();
const hints = [];
const totals = { textFiles: 0, binaryFiles: 0, oversizedFiles: 0 };

function add(name, category) {
  if (!findings.has(name)) findings.set(name, new Set());
  findings.get(name).add(category);
}

function addHint(name, category, contents, index, matchedValue = '') {
  if (!showHints || hints.length >= 30) return;
  const lineNumber = contents.slice(0, index).split('\n').length;
  const lines = contents.split(/\r?\n/);
  const mask = (line) => line
    .replace(emailPattern, '<email>')
    .replace(phonePattern, '<phone>')
    .replace(providerSecretPattern, '<credential>')
    .replace(bearerPattern, 'Bearer <credential>')
    .replace(/["'`][^"'`\r\n]*["'`]/g, '<quoted text>')
    .replace(/\d{3,}/g, '<number>')
    .replace(/[^\x20-\x7e]+/g, '<non-ASCII text>')
    .trim()
    .slice(0, 100);
  const context = lines.slice(Math.max(0, lineNumber - 2), lineNumber + 1).map(mask).join(' | ');
  const anchor = lines.slice(Math.max(0, lineNumber - 30), lineNumber - 1)
    .reverse()
    .find((line) => /^\s*(?:const|let|var|function|it\(|test\()\b/.test(line));
  const marker = /(?:test|fake|mock|fixture|example|dummy|sample|placeholder|not[-_]?real)/i.test(matchedValue)
    ? ' [contains a test marker]'
    : '';
  const urlMarker = /https?:\/\//i.test(lines[lineNumber - 1] ?? '') ? ' [inside a URL line]' : '';
  hints.push(`${name}:${lineNumber} ${category}${marker}${urlMarker}${anchor ? ` [near ${mask(anchor)}]` : ''}: ${context}`);
}

const excludedPath = [
  [/^reports\//i, 'report data'],
  [/^docs\/diagnostics\//i, 'diagnostic data'],
  [/^docs\/项目档案\.md$/i, 'internal project notes'],
  [/^\.env(?!\.example$)/i, 'environment or credential file'],
  [/^\.desktop-pet-mcp\.json$/i, 'local MCP configuration'],
  [/^local-models\//i, 'local model'],
  [/^(?:2d模型|d1|config-assets|neural-persona|react-example|AI Desktop Pet(?: Local Test)?)\//i, 'runtime character or configuration data'],
  [/^public\/models-3d\/(?!README\.md$|pet-[12]\/\.gitkeep$)/i, 'character or animation asset'],
  [/^src\/assets\/pet-[12]\//i, 'private character sprite'],
  [/^src\/assets\/pet-character-26\.png$/i, 'private character illustration'],
  [/(?:^|\/)(?:chat-history|conversation-history|transcripts?|user-data|memory-data)(?:\/|$)/i, 'user conversation data'],
  [/(?:^|\/)(?:desktop-pet-(?:chat-history|config)[^/]*|mcp-history[^/]*|[^/]+\.record)\.json$/i, 'runtime user configuration or history'],
  [/^(?:\.desktop-test-profile|\.collaborator-test-profile|\.desktop-test-runtime|\.desktop-probe-runtime|\.collaborator-test-runtime|\.tmp-harness-ready|\.local-backups|tmp)\//i, 'local runtime or test profile'],
  [/\.(?:pem|p12|pfx|key|sqlite3?|db|db3)$/i, 'private key or runtime database'],
];

const emailPattern = /(?<![\w.+-])[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}(?![\w.-])/g;
const phonePattern = /(?<![A-Za-z0-9])(?:\+?86[\s-]?)?1[3-9]\d{9}(?![A-Za-z0-9])/g;
const providerSecretPattern = /\b(?:sk-(?:proj-|live-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AIza[0-9A-Za-z_-]{30,}|AKIA[0-9A-Z]{16})\b/g;
const assignedSecretPattern = /(?:api[_-]?key|client[_-]?secret|access[_-]?token|password)\s*[:=]\s*['"`]\s*[A-Za-z0-9._/+~=-]{24,}\s*['"`]/gi;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/-]{24,}\b/g;

// Compare candidate files with this computer's app profile without ever logging the values.
// The profile may not exist on CI or collaborators' fresh machines.
const localPrivate = { roleNames: new Set(), roleTexts: new Set(), credentials: new Set(), chatTexts: new Set() };
function readLocalJson(filename) {
  if (!existsSync(filename)) return null;
  try {
    return JSON.parse(readFileSync(filename, 'utf8'));
  } catch {
    return null;
  }
}
function collectCredentials(value) {
  if (Array.isArray(value)) {
    for (const item of value) collectCredentials(item);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string'
        && item.trim().length >= 12
        && /(?:api.?key|secret|token|password|authorization|credential)/i.test(key)) {
        localPrivate.credentials.add(item.trim());
      } else {
        collectCredentials(item);
      }
    }
  }
}
function addRoleName(value) {
  if (typeof value === 'string' && value.trim().length >= 2) localPrivate.roleNames.add(value.trim());
}
function collectRoleTexts(value) {
  if (Array.isArray(value)) {
    for (const item of value) collectRoleTexts(item);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string'
        && item.trim().length >= 40
        && item.trim().length <= 4000
        && /(?:prompt|personality|description|background|bio|story|relationship|memory|normalizedContent|retrievalSummary|quote|influenceSummary)/i.test(key)) {
        localPrivate.roleTexts.add(item.trim());
      } else {
        collectRoleTexts(item);
      }
    }
  }
}
const appData = process.env.APPDATA;
collectCredentials(readLocalJson(path.join(root, '.desktop-pet-mcp.json')));
const localEnvPath = path.join(root, '.env.local');
if (existsSync(localEnvPath)) {
  for (const line of readFileSync(localEnvPath, 'utf8').split(/\r?\n/)) {
    const entry = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!entry) continue;
    const value = entry[2].trim().replace(/^["']|["']$/g, '');
    if (value.length >= 12 && /(?:api.?key|secret|token|password|authorization|credential)/i.test(entry[1])) {
      localPrivate.credentials.add(value);
    }
  }
}
if (appData) {
  for (const directory of ['react-example', 'AI Desktop Pet']) {
    const profileRoot = path.join(appData, directory);
    const persisted = readLocalJson(path.join(profileRoot, 'desktop-pet-config.v1.json'));
    const config = persisted?.config ?? persisted;
    if (config && typeof config === 'object') {
      collectCredentials(config);
      collectRoleTexts(config);
      addRoleName(config.personality?.name);
      for (const pet of config.companionPets ?? []) addRoleName(pet?.personality?.name);
      for (const relation of config.directedRelationshipRepository?.candidates ?? []) {
        addRoleName(relation?.sourceRoleName);
        addRoleName(relation?.targetRoleName);
      }
    }
    const chat = readLocalJson(path.join(profileRoot, 'desktop-pet-chat-history.v1.json'));
    for (const message of chat?.messages ?? []) {
      if (typeof message?.text === 'string' && message.text.trim().length >= 24) {
        localPrivate.chatTexts.add(message.text.trim());
      }
    }
    const personaDirectory = path.join(profileRoot, 'neural-persona');
    if (existsSync(personaDirectory)) {
      for (const filename of readdirSync(personaDirectory)) {
        if (filename.endsWith('.record.json')) {
          collectRoleTexts(readLocalJson(path.join(personaDirectory, filename)));
        }
      }
    }
  }
}

function isPlaceholderEmail(value) {
  const domain = value.slice(value.lastIndexOf('@') + 1).toLowerCase();
  return /^(?:example\.(?:com|org|net|invalid)|users\.noreply\.github\.com|noreply\.github\.com)$/.test(domain);
}

function isDependencyMetadataEmail(contents, email) {
  try {
    const packages = JSON.parse(contents).packages ?? {};
    return Object.entries(packages).some(([name, metadata]) =>
      name.startsWith('node_modules/') && JSON.stringify(metadata).includes(email));
  } catch {
    return false;
  }
}

for (const name of [...paths].sort()) {
  for (const [pattern, category] of excludedPath) {
    if (pattern.test(name)) add(name, category);
  }

  const filename = path.join(root, ...name.split('/'));
  if (!existsSync(filename)) continue;
  const stat = lstatSync(filename);
  if (stat.isSymbolicLink()) {
    add(name, 'symbolic link requires review');
    continue;
  }
  if (!stat.isFile()) continue;
  if (stat.size > maxBytes) {
    totals.oversizedFiles++;
    add(name, 'file exceeds content scan limit');
    continue;
  }

  const bytes = readFileSync(filename);
  const approvedBinaryHash = baseline.allowedBinarySha256?.[name];
  if (approvedBinaryHash && createHash('sha256').update(bytes).digest('hex') !== approvedBinaryHash) {
    add(name, 'public placeholder image changed; private character art review required');
  }
  if (bytes.includes(0)) {
    totals.binaryFiles++;
    continue;
  }
  totals.textFiles++;
  const contents = bytes.toString('utf8');
  const approvedTextHash = baseline.approvedTextSha256?.[name];
  if (approvedTextHash && createHash('sha256').update(contents.replaceAll('\r\n', '\n')).digest('hex') !== approvedTextHash) {
    add(name, 'sanitized character sample changed; private name review required');
  }
  for (const value of localPrivate.roleNames) {
    if (contents.includes(`"${value}"`) || contents.includes(`'${value}'`) || contents.includes(`\`${value}\``)) {
      add(name, 'local private character name');
      break;
    }
  }
  for (const value of localPrivate.credentials) {
    if (contents.includes(value)) {
      add(name, 'local credential value');
      break;
    }
  }
  for (const value of localPrivate.chatTexts) {
    if (contents.includes(value)) {
      add(name, 'local conversation text');
      break;
    }
  }
  for (const value of localPrivate.roleTexts) {
    if (contents.includes(value)) {
      add(name, 'local private character setting');
      break;
    }
  }

  for (const email of contents.matchAll(emailPattern)) {
    if (!isPlaceholderEmail(email[0])) {
      if (name === 'package-lock.json' && isDependencyMetadataEmail(contents, email[0])) continue;
      const category = name === 'package-lock.json' ? 'email in dependency metadata' : 'email address';
      add(name, category);
      addHint(name, category, contents, email.index, email[0]);
      break;
    }
  }
  const phone = phonePattern.exec(contents);
  if (phone) {
    add(name, 'possible Chinese mobile number');
    addHint(name, 'possible Chinese mobile number', contents, phone.index, phone[0]);
  }
  phonePattern.lastIndex = 0;
  const providerCredential = providerSecretPattern.exec(contents);
  const assignedCredential = providerCredential ? null : assignedSecretPattern.exec(contents);
  const bearerCredential = providerCredential || assignedCredential ? null : bearerPattern.exec(contents);
  const privateKey = providerCredential || assignedCredential || bearerCredential ? null : /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.exec(contents);
  const credential = providerCredential ?? assignedCredential ?? bearerCredential ?? privateKey;
  if (credential) {
    add(name, 'possible credential or private key');
    const kind = providerCredential ? 'provider token format' : assignedCredential ? 'credential-like assignment' : bearerCredential ? 'Bearer token format' : 'private key header';
    addHint(name, `possible credential or private key (${kind})`, contents, credential.index, credential[0]);
  }
  providerSecretPattern.lastIndex = 0;
  assignedSecretPattern.lastIndex = 0;
  bearerPattern.lastIndex = 0;

  const looksLikeChatData = /\.(?:jsonl|json|csv)$/i.test(name)
    && /["']role["']\s*:\s*["']user["']/i.test(contents)
    && /["']role["']\s*:\s*["'](?:model|assistant)["']/i.test(contents)
    && /["']text["']\s*:/i.test(contents)
    && (/["']messages["']\s*:\s*\[/i.test(contents) || /\.jsonl$/i.test(name));
  if (looksLikeChatData) {
    add(name, 'possible conversation transcript');
  }
}

const historyEmails = new Set(
  git(['log', 'HEAD', '--format=%ae%n%ce'])
    .split(/\r?\n/)
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.includes('@') && !isPlaceholderEmail(value)),
);
if (historyEmails.size > 0) add('[current branch history]', `${historyEmails.size} distinct non-noreply commit email(s)`);
const ancestry = spawnSync('git', ['-C', root, 'merge-base', '--is-ancestor', baseline.sourceCommit, 'HEAD'], {
  windowsHide: true,
});
if (ancestry.status !== 0) add('[current branch history]', 'branch is not based on the reviewed public snapshot');

const ordered = [...findings].map(([name, categories]) => ({ name, categories: [...categories].sort() }));
const existingSamples = [];
const actionable = [];
for (const item of ordered) {
  const expected = baseline.sha256[item.name];
  const filename = path.join(root, ...item.name.split('/'));
  const actual = expected && existsSync(filename)
    ? createHash('sha256').update(readFileSync(filename, 'utf8').replaceAll('\r\n', '\n')).digest('hex')
    : null;
  (actual === expected ? existingSamples : actionable).push(item);
}
const categoryCounts = new Map();
for (const item of actionable) {
  for (const category of item.categories) {
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }
}
console.log(`Scanned ${tracked.size} tracked paths${includeUntracked ? ` and ${paths.size - tracked.size} untracked paths` : ''}.`);
console.log(`Content: ${totals.textFiles} text files, ${totals.binaryFiles} binary files, ${totals.oversizedFiles} oversized files.`);
console.log(`Review required: ${actionable.length} path or history finding(s). Match values are hidden.`);
console.log(`Unchanged samples from the existing public snapshot: ${existingSamples.length} file(s).`);
for (const [category, count] of [...categoryCounts].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${category}: ${count}`);
}
for (const item of actionable.slice(0, maxList)) {
  console.log(`- ${item.name}: ${item.categories.join(', ')}`);
}
if (actionable.length > maxList) console.log(`- ... ${actionable.length - maxList} further finding(s) omitted`);
if (showHints && hints.length > 0) {
  console.log('Masked line hints:');
  for (const hint of hints) console.log(`  ${hint}`);
}
if (strict && actionable.length > 0) process.exitCode = 1;
