import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runPlatformCapability } from '../src/platform-capabilities/platformCapabilityRegistry';
import type { PetConfig } from '../src/types';
import { normalizeAllowedCommands } from '../src/dev-agent/devAgentSettings';
import { buildDevAgentPrompt } from '../src/dev-agent/devAgentCapability';
import { agentSessionKey, normalizeWorkTaskSettings } from '../src/work-tasks/workTaskSettings';

// Hand-offs under the same progress card continue one Claude Code session.
const require = createRequire(import.meta.url);

// Main process, with a stand-in for claude.exe: it answers by the arguments it gets.
const calls: string[][] = [];
const childProcess = require('node:child_process') as { spawn: unknown };
childProcess.spawn = (_exe: string, args: string[]) => {
  calls.push(args);
  const child = Object.assign(new EventEmitter(), { kill: () => undefined, stderr: new EventEmitter(), stdout: new EventEmitter() });
  const resume = args.includes('--resume') ? args[args.indexOf('--resume') + 1] : '';
  setImmediate(() => {
    const out = resume.startsWith('dead')
      ? `No conversation found with session ID: ${resume}`
      : JSON.stringify({ is_error: false, result: resume ? 'continued' : 'fresh', session_id: resume || 'aaaaaaaa-0000-4000-8000-000000000001' });
    child.stdout.emit('data', out);
    child.emit('close', 0);
  });
  return child;
};
const { createDevAgentService } = require('../electron/devAgentService.cjs') as {
  createDevAgentService: () => { runTask: (request: object) => Promise<Record<string, unknown>> };
};
const service = createDevAgentService();
const home = mkdtempSync(path.join(tmpdir(), 'devagent-resume-'));
const exe = path.join(home, 'claude.exe');
writeFileSync(exe, '');
const base = { executablePath: exe, prompt: '改一下', workspacePath: home };

const fresh = await service.runTask(base);
assert.deepEqual([fresh.ok, fresh.sessionId, fresh.resumed, calls[0].includes('--resume')], [true, 'aaaaaaaa-0000-4000-8000-000000000001', false, false]);
const continued = await service.runTask({ ...base, resumeSessionId: 'cccccccc-0000-4000-8000-000000000002' });
assert.deepEqual([continued.result, continued.resumed, continued.sessionId], ['continued', true, 'cccccccc-0000-4000-8000-000000000002']);
calls.length = 0;
const lost = await service.runTask({ ...base, resumeSessionId: 'deadbeef-0000-4000-8000-000000000003' });
assert.deepEqual([lost.ok, lost.resumeLost, lost.result, calls.length], [true, true, 'fresh', 2], 'a missing session falls back to a fresh one');
calls.length = 0;
await service.runTask({ ...base, resumeSessionId: 'not a session; rm -rf' });
assert.equal(calls[0].includes('--resume'), false, 'odd session ids are ignored');

// Allowed check commands become --allowedTools rules; anything that could chain commands is dropped.
const { allowedCommandArgs } = require('../electron/devAgentService.cjs') as { allowedCommandArgs: (commands: unknown) => string[] };
assert.deepEqual(allowedCommandArgs(['npm test', 'npx tsc --noEmit', 'rm -rf / && echo', 'a | b', '$(evil)']), ['--allowedTools', 'Bash(npm test:*)', 'PowerShell(npm test:*)', 'Bash(npx tsc --noEmit:*)', 'PowerShell(npx tsc --noEmit:*)']);
assert.deepEqual(allowedCommandArgs(undefined), []);
calls.length = 0;
await service.runTask({ ...base, allowedCommands: ['npm test'] });
assert.deepEqual(calls[0].slice(calls[0].indexOf('--allowedTools')), ['--allowedTools', 'Bash(npm test:*)', 'PowerShell(npm test:*)']);
assert.deepEqual(normalizeAllowedCommands('npm test；npx tsc --noEmit;npm test; echo a > b'), ['npm test', 'npx tsc --noEmit'], 'settings keep plain, distinct commands');

// Capability: the session is kept on the open progress card and reused next time.
const runs: Array<Record<string, unknown>> = [];
let nextSession = 'eeeeeeee-0000-4000-8000-000000000004';
(globalThis as { window?: unknown }).window = {
  desktopPetShell: {
    devAgent: {
      run: async (request: Record<string, unknown>) => {
        runs.push(request);
        return { ok: true, result: '改好了', resumed: Boolean(request.resumeSessionId), sessionId: request.resumeSessionId ?? nextSession };
      },
    },
  },
};
const card = { agentSessions: {}, decided: [], goal: '', id: 'task-1', next: '', progress: '', project: '桌宠', startedAt: 1, title: '翻滚', updatedAt: 1 };
const configRef = {
  current: {
    settings: {
      devAgent: { enabled: true, workspaces: [{ name: '桌宠', path: 'D:\\pet' }] },
      devAgentApiKey: '',
      workTasks: { activeTask: card, decisions: [], recentTasks: [] },
    },
  } as unknown as PetConfig,
};
const context = { configRef, onUpdateConfig: (next: PetConfig) => { configRef.current = next; } };
const key = agentSessionKey('claude-account', 'D:\\pet');

await runPlatformCapability(context, { args: { task: '第一步' }, capability: 'dev.delegate' });
assert.equal(runs[0].resumeSessionId, undefined, 'a new card starts a new session');
assert.equal(normalizeWorkTaskSettings(configRef.current.settings.workTasks).activeTask?.agentSessions[key], nextSession, 'remembered on the card');
const second = await runPlatformCapability(context, { args: { task: '第二步' }, capability: 'dev.delegate' });
assert.equal(runs[1].resumeSessionId, nextSession, 'the next hand-off continues it');
assert.match(second.text, /接着这张进度卡上次的会话/u, 'the character is told it continued');
nextSession = 'ffffffff-0000-4000-8000-000000000005';
await runPlatformCapability(context, { args: { fresh: true, task: '换个思路' }, capability: 'dev.delegate' });
assert.equal(runs[2].resumeSessionId, undefined, '“重新来” starts over');
assert.equal(normalizeWorkTaskSettings(configRef.current.settings.workTasks).activeTask?.agentSessions[key], nextSession, 'and the new session replaces the old one');

// Old progress cards (saved before sessions existed) load fine.
assert.deepEqual(normalizeWorkTaskSettings({ activeTask: { title: '旧卡' } }).activeTask?.agentSessions, {});

// The prompt tells the assistant which checks it may run.
assert.match(buildDevAgentPrompt('改一下', undefined, ['npm test']), /可以运行这些命令检查自己的改动：npm test/u);
assert.doesNotMatch(buildDevAgentPrompt('改一下', undefined, []), /检查命令/u);

console.log('dev agent resume smoke ok');
