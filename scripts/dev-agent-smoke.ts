import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildDevAgentPrompt } from '../src/dev-agent/devAgentCapability';
import { DEV_AGENT_COMPATIBLE_PRESETS, resolveCompatibleBlocker, resolveDevAgentLaunch } from '../src/dev-agent/devAgentProviders';
import { normalizeDevAgentSettings, resolveDevAgentWorkspace } from '../src/dev-agent/devAgentSettings';
import { getPlatformCapability, runPlatformCapability } from '../src/platform-capabilities/platformCapabilityRegistry';
import type { PetConfig } from '../src/types';

const require = createRequire(import.meta.url);
const { createDevAgentService, parseClaudeJson, resolveClaudeExecutable } = require('../electron/devAgentService.cjs') as {
  createDevAgentService: () => { runTask: (request: object) => Promise<{ ok: boolean; error?: string }> };
  parseClaudeJson: (stdout: string) => Record<string, unknown> | null;
  resolveClaudeExecutable: (customPath?: string, env?: Record<string, string>) => string | null;
};

// Settings: off by default; workspaces need a name and a path; picked by name.
const settings = normalizeDevAgentSettings({
  enabled: true,
  timeoutMinutes: 999,
  workspaces: [{ name: '动作游戏', path: 'D:\\ue5\\CombatLab' }, { name: '', path: 'x' }, { name: '桌宠', path: 'D:\\pet' }],
});
assert.equal(normalizeDevAgentSettings(undefined).enabled, false);
assert.equal(settings.timeoutMinutes, 60, 'a task waits at most an hour');
assert.deepEqual(settings.workspaces.map((item) => item.name), ['动作游戏', '桌宠']);
assert.equal(resolveDevAgentWorkspace(settings, '游戏')?.name, '动作游戏');
assert.equal(resolveDevAgentWorkspace(settings, '')?.name, '动作游戏', 'no name: the first project');
assert.equal(resolveDevAgentWorkspace(settings, '网站'), null);

// The capability asks first, and refuses cleanly when switched off.
assert.equal(getPlatformCapability('dev.delegate')?.risk, 'change', 'every task is confirmed first');
const off = await runPlatformCapability(
  { configRef: { current: { settings: { devAgent: { enabled: false } } } as unknown as PetConfig }, onUpdateConfig: () => undefined },
  { args: { task: '改一下' }, capability: 'dev.delegate' },
);
assert.equal(off.ok, false);
assert.match(off.text, /没有开启/u);

// The prompt carries the open task card and the settled decisions.
const prompt = buildDevAgentPrompt('把翻滚无敌改成 0.3 秒', {
  activeTask: { decided: [], goal: '手感像龙之谷', next: '', progress: '', project: '动作游戏', title: '翻滚' },
  decisions: [{ project: '动作游戏', text: '连续最多滚 2 次' }],
});
assert.match(prompt, /^把翻滚无敌改成 0\.3 秒/u);
assert.match(prompt, /任务：翻滚[\s\S]*连续最多滚 2 次/u);
assert.match(prompt, /改了哪些文件/u);
assert.doesNotMatch(buildDevAgentPrompt('只做这件事', undefined), /背景/u, 'no card, no background');

// Main process: reading Claude Code's JSON, finding the executable, refusing bad requests.
assert.deepEqual(parseClaudeJson('noise\n{"is_error":false,"result":"done"}'), { is_error: false, result: 'done' });
assert.equal(parseClaudeJson('not json'), null);
const fakeHome = mkdtempSync(path.join(tmpdir(), 'devagent-'));
const fakeExe = path.join(fakeHome, 'claude.exe');
writeFileSync(fakeExe, '');
assert.equal(resolveClaudeExecutable(fakeExe, {}), fakeExe, 'a path set in settings wins');
assert.equal(resolveClaudeExecutable('', { LOCALAPPDATA: fakeHome, PATH: '', USERPROFILE: fakeHome }), null, 'nothing installed: null');
const service = createDevAgentService();
assert.match((await service.runTask({ prompt: '', workspacePath: fakeHome })).error ?? '', /需要任务内容/u);
assert.match((await service.runTask({ prompt: 'x', workspacePath: path.join(fakeHome, 'missing') })).error ?? '', /项目文件夹不存在/u);

// Providers: the Claude account passes a model flag; a compatible endpoint (DeepSeek) is
// configured through environment variables, with the preset filling empty fields.
const account = normalizeDevAgentSettings({ claudeModel: 'opus', provider: 'claude-account' });
assert.deepEqual(resolveDevAgentLaunch(account, ''), { env: undefined, model: 'opus' });
assert.equal(normalizeDevAgentSettings({ claudeModel: 'gpt' }).claudeModel, '', 'unknown model falls back to the account default');
const deepseek = normalizeDevAgentSettings({ provider: 'compatible' });
assert.equal(deepseek.compatiblePreset, 'deepseek', 'DeepSeek is the default compatible provider');
assert.equal(resolveCompatibleBlocker(deepseek, ''), '还没填 API Key。');
const launch = resolveDevAgentLaunch(deepseek, ' sk-test ');
assert.equal(launch.model, undefined);
assert.deepEqual(launch.env, {
  ANTHROPIC_AUTH_TOKEN: 'sk-test',
  ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
  ANTHROPIC_DEFAULT_HAIKU_MODEL: 'deepseek-flash',
  ANTHROPIC_DEFAULT_OPUS_MODEL: 'deepseek-flash[1m]',
  ANTHROPIC_DEFAULT_SONNET_MODEL: 'deepseek-flash[1m]',
  ANTHROPIC_MODEL: 'deepseek-flash[1m]',
  CLAUDE_CODE_SUBAGENT_MODEL: 'deepseek-flash',
});
assert.equal(resolveDevAgentLaunch(normalizeDevAgentSettings({ compatibleModel: 'deepseek-v4-pro[1m]', provider: 'compatible' }), 'k').env?.ANTHROPIC_MODEL, 'deepseek-v4-pro[1m]');
const custom = normalizeDevAgentSettings({ compatiblePreset: 'custom', provider: 'compatible' });
assert.equal(resolveCompatibleBlocker(custom, 'k'), '还没填接口地址。', 'a custom provider needs its own address');
assert.equal(normalizeDevAgentSettings({ compatibleBaseUrl: 'ftp://x' }).compatibleBaseUrl, '', 'only http(s) addresses');

// The settings page may only open known key pages; the key is a secret like the others.
const { KEY_PAGE_URLS } = require('../electron/devAgentService.cjs') as { KEY_PAGE_URLS: Set<string> };
for (const item of DEV_AGENT_COMPATIBLE_PRESETS.filter((entry) => entry.keyPageUrl)) {
  assert.ok(KEY_PAGE_URLS.has(item.keyPageUrl), `${item.label} key page is allowed`);
}
const credentialsSource = readFileSync(new URL('../electron/configCredentials.cjs', import.meta.url), 'utf8');
assert.ok(credentialsSource.includes("'devAgentApiKey'"), 'the dev assistant key is encrypted on disk');
const backupSource = readFileSync(new URL('../src/privateDataBackup.ts', import.meta.url), 'utf8');
assert.ok(backupSource.slice(backupSource.indexOf('SECRET_SETTING_KEYS'), backupSource.indexOf('] as const')).includes("'devAgentApiKey'"), 'and left out of backups');

console.log('dev agent smoke ok');
