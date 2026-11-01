const fs = require('fs');
const path = require('path');

// plugin.json, version 1: what a plugin package declares (docs/plugin-format.md). A folder with
// only a SKILL.md is accepted too and gets a manifest generated from its front matter, so any
// skill written for Claude Code or similar tools installs as it is.

const { ID_PATTERN, MANIFEST_FILE, SKILL_FILE, normalizePluginManifest, readFrontMatter, toId } = require('./pluginManifestRules.cjs');

/** The manifest of a package folder: its plugin.json, or one generated from a bare SKILL.md. */
function readPluginPackage(folder) {
  const manifestPath = path.join(folder, MANIFEST_FILE);
  if (fs.existsSync(manifestPath)) {
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^﻿/u, ''));
    } catch (error) {
      return { error: `plugin.json 读不懂：${error.message}` };
    }
    const result = normalizePluginManifest(raw);
    if (result.manifest?.kind === 'skill' && !fs.existsSync(path.join(folder, result.manifest.skill.file))) {
      return { error: `找不到技能说明文件 ${result.manifest.skill.file}。` };
    }
    return result;
  }
  const skillPath = path.join(folder, SKILL_FILE);
  if (!fs.existsSync(skillPath)) return { error: '这个文件夹里没有 plugin.json，也没有 SKILL.md。' };
  const front = readFrontMatter(fs.readFileSync(skillPath, 'utf8'));
  const id = toId(front.name || path.basename(folder));
  return normalizePluginManifest({
    description: front.description || `${front.title || id} 技能`,
    id: ID_PATTERN.test(id) ? id : `skill-${Date.now().toString(36)}`,
    kind: 'skill',
    name: front.title || front.name || id,
    skill: { file: SKILL_FILE },
  });
}

module.exports = { MANIFEST_FILE, SKILL_FILE, normalizePluginManifest, readFrontMatter, readPluginPackage };
