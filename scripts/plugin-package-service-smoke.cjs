// Plugin packages: install from a folder (plugin.json or a bare SKILL.md), replace keeping the
// previous version, install from a zip (GitHub layout), refuse bad manifests, uninstall.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { zipSync, strToU8 } = require('fflate');
const { createPluginPackageService, parseGitHubUrl } = require('../electron/pluginPackageService.cjs');
const { normalizePluginManifest } = require('../electron/pluginPackageManifest.cjs');

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-packages-'));
const trashed = [];
const service = createPluginPackageService({ userDataPath: path.join(base, 'userData'), trashItem: async (folder) => { trashed.push(folder); fs.rmSync(folder, { recursive: true }); } });
const write = (file, content) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };

(async () => {
  // A skill folder written for other tools: only SKILL.md.
  write(path.join(base, 'src/drawing/SKILL.md'), '---\nname: drawing-teacher\ndescription: 当绘画老师\n---\n# 绘画老师\n正文');
  const skill = await service.installFromFolder(path.join(base, 'src/drawing'));
  assert.equal(skill.ok, true, skill.error);
  assert.deepEqual([skill.manifest.id, skill.manifest.kind, skill.manifest.name, skill.manifest.permissions], ['drawing-teacher', 'skill', '绘画老师', ['read-instructions']]);
  assert.ok(fs.existsSync(path.join(service.pluginsRoot, 'drawing-teacher', 'plugin.json')), 'generated manifest is stored');
  assert.match(service.readSkillText('drawing-teacher'), /正文/u);

  // An MCP plugin with its own manifest; reinstalling keeps the previous version.
  const mcpManifest = { id: 'weather-tool', kind: 'mcp', name: '天气工具', description: '查天气', version: '1.0.0', mcp: { command: 'node', args: ['server.js'] }, permissions: ['network', 'bogus'] };
  write(path.join(base, 'src/weather/plugin.json'), JSON.stringify(mcpManifest));
  write(path.join(base, 'src/weather/server.js'), '// v1');
  write(path.join(base, 'src/weather/node_modules/big/index.js'), 'skipped');
  assert.equal((await service.installFromFolder(path.join(base, 'src/weather'))).ok, true);
  assert.equal(fs.existsSync(path.join(service.pluginsRoot, 'weather-tool', 'node_modules')), false, 'node_modules is not copied');
  write(path.join(base, 'src/weather/plugin.json'), JSON.stringify({ ...mcpManifest, version: '1.1.0' }));
  const update = await service.installFromFolder(path.join(base, 'src/weather'));
  assert.equal(update.replaced, true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(service.pluginsRoot, '.previous', 'weather-tool', 'plugin.json'), 'utf8')).version, '1.0.0');
  assert.deepEqual(service.list().map((item) => `${item.id}@${item.version}`).sort(), ['drawing-teacher@0.1.0', 'weather-tool@1.1.0']);
  assert.deepEqual(service.list().find((item) => item.id === 'weather-tool').permissions, ['network'], 'unknown permissions dropped');

  // Zip in GitHub layout ("repo-main/…"), with a sub folder and a zip-slip entry.
  const zip = zipSync({
    'repo-main/README.md': strToU8('readme'),
    'repo-main/skills/a/SKILL.md': strToU8('---\nname: skill-a\ndescription: A\n---\n# A'),
    'repo-main/skills/b/SKILL.md': strToU8('---\nname: skill-b\ndescription: B\n---\n# B'),
    '../evil.txt': strToU8('x'),
  });
  assert.match((await service.installFromZipBytes(zip)).error, /有 2 个插件/u, 'several plugins need a folder link');
  assert.equal((await service.installFromZipBytes(zip, 'skills/b')).manifest.id, 'skill-b');
  assert.equal(fs.existsSync(path.join(base, 'userData', 'evil.txt')), false, 'no writes outside the staging folder');

  // Bad manifests are explained.
  assert.match(normalizePluginManifest({ id: 'Bad Id', kind: 'skill', name: 'x', description: 'y' }).error, /id/u);
  assert.match(normalizePluginManifest({ id: 'ok-id', kind: 'native', name: 'x', description: 'y' }).error, /不支持的插件类型/u);
  assert.match(normalizePluginManifest({ id: 'ok-id', kind: 'mcp', name: 'x', description: 'y' }).error, /mcp\.command/u);

  assert.deepEqual(parseGitHubUrl('https://github.com/me/pets-plugins/tree/main/plugins/weather'), { subPath: 'plugins/weather', zipUrl: 'https://codeload.github.com/me/pets-plugins/zip/main' });
  assert.deepEqual(parseGitHubUrl('https://github.com/me/repo.git'), { subPath: '', zipUrl: 'https://codeload.github.com/me/repo/zip/HEAD' });
  assert.equal(parseGitHubUrl('https://example.com/a/b'), null);
  const offline = createPluginPackageService({ userDataPath: path.join(base, 'u2'), trashItem: async () => {}, fetchImpl: async () => { throw new Error('ENOTFOUND'); } });
  assert.match((await offline.installFromGitHub('https://github.com/me/repo')).error, /连不上 GitHub/u);

  assert.equal((await service.uninstall('drawing-teacher')).ok, true);
  assert.equal((await service.uninstall('../userData')).ok, false, 'only plugin folders can be removed');
  assert.deepEqual(service.list().map((item) => item.id).sort(), ['skill-b', 'weather-tool']);

  fs.rmSync(base, { recursive: true, force: true });
  console.log('plugin package service smoke passed');
})().catch((error) => { console.error(error); process.exit(1); });
