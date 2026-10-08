import assert from 'node:assert/strict';
import { runAgentLoop, type AgentLoopDependencies } from '../src/agent/loop/agentLoop';
import { buildElementMarks, type LoopOcrLine } from '../src/agent/loop/elementMarks';
import { type LoopWindow } from '../src/agent/loop/observationTiers';
import { type PetConfig } from '../src/types';

// Offline WeGame → 英雄联盟 replay: login window replaced by the main window, League page, client launch.
const box = (x: number, y: number, width: number, height: number) => ({ height, width, x, y });
const login: LoopWindow = { box: box(685, 385, 1191, 670), hwnd: 101, pid: 1, processName: 'wegame', title: 'WeGame' };
const main: LoopWindow = { box: box(288, 132, 1984, 1116), hwnd: 202, pid: 2, processName: 'browser', title: 'WeGame' };
const league: LoopWindow = { box: box(500, 200, 1600, 900), hwnd: 303, pid: 3, processName: 'LeagueClientUx', title: 'League of Legends' };
const line = (text: string, x: number, y: number): LoopOcrLine => ({ height: 24, text, width: 120, x, y });
const screens: Record<string, LoopOcrLine[]> = {
  'league-page': [line('英雄联盟', 300, 400), line('启动', 1900, 1150)],
  login: [line('10000001', 1220, 800), line('快捷安全登录', 1220, 852)],
  store: [line('商店', 300, 200), line('英雄联盟', 300, 400)],
};
let state: 'none' | 'login' | 'store' | 'league-page' | 'launched' = 'none';
const windowsFor = () => (state === 'none' ? [] : state === 'login' ? [login] : state === 'launched' ? [main, league] : [main]);

const approvals: string[] = [];
const executed: string[] = [];
const dependencies: Partial<AgentLoopDependencies> = {
  callModel: async (prompt) => {
    const current = /当前窗口：(.+)/u.exec(prompt)?.[1] ?? '';
    const id = (label: string) => new RegExp(`\\[(\\d+)\\] \\S+ "${label}"`, 'u').exec(prompt)?.[1];
    if (!current.includes('hwnd=') && !/WeGame｜/u.test(prompt)) return '{"action":"launch_app","name":"WeGame"}';
    if (prompt.includes('League of Legends｜')) return '{"action":"done","summary":"League of Legends 窗口已出现"}';
    if (id('快捷安全登录')) return `{"thought":"账号已填好","action":"click","element":${id('快捷安全登录')}}`;
    if (id('启动')) return `{"action":"click","element":${id('启动')}}`;
    if (id('英雄联盟')) return `{"action":"click","args":{"element":"${id('英雄联盟')}"}}`;
    return '{"action":"observe","window":"WeGame"}';
  },
  execute: async (action, context) => {
    executed.push(action.action);
    if (action.action === 'launch_app') {
      state = 'login';
      return { detail: '已启动', focusWindow: login, ok: true };
    }
    const label = 'element' in action ? context.elements.find((element) => element.id === action.element)?.label : '';
    if (label === '快捷安全登录') state = 'store';
    else if (label === '英雄联盟') state = 'league-page';
    else if (label === '启动') state = 'launched';
    return { detail: `点击「${label}」`, ok: true };
  },
  look: async (observation) => ({ answer: 'n/a', elements: observation.elements }),
  observeElements: async (window) => ({
    captureStatus: 'ok',
    capturedAt: Date.now(),
    durationMs: 1,
    elements: buildElementMarks({ ocrLines: window.hwnd === 101 ? screens.login : screens[state === 'league-page' || state === 'launched' ? 'league-page' : 'store'], windowBox: window.box }),
    observationId: `obs-${state}`,
    ocrStatus: 'ok',
    uiaCount: 0,
    window,
  }),
  observeWindows: async () => ({ active: windowsFor()[0] ?? null, windows: windowsFor() }),
  sleep: async () => undefined,
};

const result = await runAgentLoop({
  dependencies,
  goal: '打开 WeGame，点击「快捷安全登录」，登录后启动里面的英雄联盟。',
  requestApproval: async (request) => { approvals.push(request.kind); return true; },
  settings: {} as PetConfig['settings'],
});
assert.equal(result.status, 'done', JSON.stringify(result.steps, null, 1));
assert.deepEqual(executed, ['launch_app', 'click', 'click', 'click'], 'launch, login, 英雄联盟, 启动 — no extra reads or retries');
assert.deepEqual(approvals, ['task-scope'], 'one approval for the whole task');
assert.ok(result.steps.some((step) => step.result.includes('新窗口')), 'verification notices the replaced/new windows');
assert.equal(result.metrics.visionCalls, 0, 'OCR marks were enough: no vision call');
assert.ok(result.metrics.modelCalls <= 6);

// Typing asks every time; a declined step is reported back to the model.
const typed: string[] = [];
const typeResult = await runAgentLoop({
  dependencies: {
    ...dependencies,
    callModel: async (prompt) => (prompt.includes('用户拒绝了这一步') ? '{"action":"ask_user","question":"需要输入什么？"}' : '{"action":"type_text","text":"hello"}'),
    execute: async (action) => { typed.push(action.action); return { detail: 'typed', ok: true }; },
  },
  goal: '输入 hello',
  requestApproval: async (request) => { typed.push(request.kind); return request.kind === 'task-scope'; },
  settings: {} as PetConfig['settings'],
});
assert.deepEqual(typed, ['action'], 'type_text needs its own approval and is not executed when declined');
assert.equal(typeResult.status, 'needs-user');

// Repeating the same no-op click triggers the "change approach" note.
let calls = 0;
state = 'store';
const stuck = await runAgentLoop({
  budget: { maxSteps: 4 },
  dependencies: {
    ...dependencies,
    callModel: async (prompt) => {
      calls += 1;
      if (prompt.includes('必须换方法')) return '{"action":"ask_user","question":"点不动"}';
      return calls === 1 ? '{"action":"observe","window":"WeGame"}' : '{"action":"click","element":1}';
    },
    execute: async () => ({ detail: '点击', ok: true }),
  },
  goal: '点击商店',
  requestApproval: async () => true,
  settings: {} as PetConfig['settings'],
});
assert.equal(stuck.status, 'needs-user', 'two clicks without change force a different approach');

// A launcher already started in this task is not relaunched (it hides to the tray after
// starting a game); `look` with no current window falls back to the whole screen.
state = 'none';
const launches: string[] = [];
let looked = '';
let step = 0;
const relaunch = await runAgentLoop({
  dependencies: {
    ...dependencies,
    callModel: async (prompt) => {
      step += 1;
      if (step === 1 || step === 2) return '{"action":"launch_app","name":"WeGame"}';
      if (step === 3) return prompt.includes('没有重复启动') ? '{"action":"look","question":"屏幕上有什么？"}' : '{"action":"done","summary":"x"}';
      return '{"action":"done","summary":"看过屏幕"}';
    },
    execute: async (action) => { launches.push(action.action); return { detail: '已请求启动', ok: true }; },
    look: async (observation) => { looked = observation.window.title; return { answer: '屏幕', elements: observation.elements }; },
    observeScreen: async () => ({ captureStatus: 'ok', capturedAt: 0, durationMs: 0, elements: [], observationId: 'screen', ocrStatus: 'ok', uiaCount: 0, window: { box: box(0, 0, 2560, 1440), hwnd: 0, pid: null, processName: 'screen', title: '整个屏幕' } }),
  },
  goal: '打开 WeGame',
  requestApproval: async () => true,
  settings: {} as PetConfig['settings'],
});
assert.deepEqual(launches, ['launch_app'], 'second launch of the same app is not executed');
assert.equal(looked, '整个屏幕', 'look without a window uses the whole screen');
assert.equal(relaunch.status, 'done');

console.log('agent loop offline smoke ok');
