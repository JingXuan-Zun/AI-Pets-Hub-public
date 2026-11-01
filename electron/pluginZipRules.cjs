const { unzipSync, zipSync } = require('fflate');
const { MANIFEST_FILE, SKILL_FILE, normalizePluginManifest, readFrontMatter, toId, ID_PATTERN } = require('./pluginManifestRules.cjs');

// A plugin zip checked in memory, the same way in the plugin market Worker (uploads) and the app:
// one package folder (plugin.json or SKILL.md) anywhere in the zip, no unsafe paths, size limits.
// The result is re-packed with only that folder, so what reviewers approve is what users install.

const MAX_ZIP_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 2000;
const SKIPPED_PARTS = new Set(['.git', 'node_modules', '__pycache__', '.venv', '__MACOSX']);

function safeEntry(name) {
  if (name.startsWith('/') || name.includes('\\') || /^[a-z]:/iu.test(name)) return false;
  const parts = name.split('/');
  return !parts.some((part) => part === '..' || SKIPPED_PARTS.has(part));
}

function decodeText(bytes) {
  return new TextDecoder('utf-8').decode(bytes).replace(/^﻿/u, '');
}

/** { manifest, files: { 'relative/path': bytes }, zip } or { error } (plain-language). */
function readPluginZip(bytes) {
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength) return { error: '没有收到插件文件。' };
  if (bytes.byteLength > MAX_ZIP_BYTES) return { error: '插件压缩包超过 10 MB。' };
  let entries;
  try {
    entries = unzipSync(bytes);
  } catch {
    return { error: '这不是一个能打开的 zip 压缩包。' };
  }
  const names = Object.keys(entries).filter((name) => !name.endsWith('/') && safeEntry(name));
  if (names.length > MAX_FILES) return { error: `压缩包里文件太多（${names.length} 个）。` };
  const roots = [...new Set(names
    .filter((name) => name.split('/').pop() === MANIFEST_FILE || name.split('/').pop() === SKILL_FILE)
    .map((name) => name.slice(0, name.length - name.split('/').pop().length)))];
  // A folder with both plugin.json and SKILL.md is one package; nested SKILL.md files under a
  // plugin.json folder belong to it.
  const packageRoots = roots.filter((root) => !roots.some((other) => other !== root && root.startsWith(other)));
  if (!packageRoots.length) return { error: '压缩包里没有 plugin.json 或 SKILL.md。' };
  if (packageRoots.length > 1) return { error: `压缩包里有 ${packageRoots.length} 个插件，一次只能上传一个。` };
  const root = packageRoots[0];
  const files = Object.fromEntries(names.filter((name) => name.startsWith(root)).map((name) => [name.slice(root.length), entries[name]]));

  let result;
  if (files[MANIFEST_FILE]) {
    try {
      result = normalizePluginManifest(JSON.parse(decodeText(files[MANIFEST_FILE])));
    } catch (error) {
      return { error: `plugin.json 读不懂：${error.message}` };
    }
    if (result.manifest?.kind === 'skill' && !files[result.manifest.skill.file]) return { error: `找不到技能说明文件 ${result.manifest.skill.file}。` };
  } else {
    const front = readFrontMatter(decodeText(files[SKILL_FILE]));
    const id = toId(front.name || root.split('/').filter(Boolean).pop() || '');
    if (!ID_PATTERN.test(id)) return { error: 'SKILL.md 开头需要 name（英文、数字和横线），作为插件 id。' };
    result = normalizePluginManifest({ description: front.description || `${front.title || id} 技能`, id, kind: 'skill', name: front.title || front.name || id, skill: { file: SKILL_FILE } });
    if (result.manifest) files[MANIFEST_FILE] = new TextEncoder().encode(`${JSON.stringify(result.manifest, null, 2)}\n`);
  }
  if (!result.manifest) return { error: result.error };
  return { files, manifest: result.manifest, zip: zipSync(files, { level: 6 }) };
}

module.exports = { MAX_ZIP_BYTES, readPluginZip };
