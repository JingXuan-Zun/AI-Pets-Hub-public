import assert from 'node:assert/strict';
import { createConversationDesktopSession, type DesktopToolDependencies } from '../src/agent/conversation/conversationDesktopTools';
import { listConversationToolDefinitions, runConversationToolCalls, type ConversationToolRuntime } from '../src/agent/conversation/conversationTools';
import { streamConversationWithTools } from '../src/agent/conversation/conversationToolStream';
import { createConversationToolSink, type ConversationToolTurn } from '../src/agent/conversation/conversationToolTypes';
import { DEFAULT_LIFE_COMPANION_SETTINGS } from '../src/life-companion/lifeCompanionSettings';
import { readOpenAITextStream } from '../src/services/openAITextStream';
import { getAgentRuntimeWorldController } from '../src/runtime-world/agentRuntimeWorldBridge';
import type { PetConfig } from '../src/types';

let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases++; };

function sse(events: unknown[]) {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('') + 'data: [DONE]\n\n';
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}
async function collect(stream: AsyncIterable<unknown>) {
  let text = '';
  for await (const chunk of stream) text += String(chunk);
  return text;
}

// 1. Streamed tool calls are reassembled across deltas, and a tool-only reply is not an error.
const sink = createConversationToolSink();
const text = await collect(readOpenAITextStream(sse([
  { choices: [{ delta: { content: '我看看～' } }] },
  { choices: [{ delta: { tool_calls: [{ function: { arguments: '{"ci', name: 'get_weather' }, id: 'call_a', index: 0 }] } }] },
  { choices: [{ delta: { tool_calls: [{ function: { arguments: 'ty":"杭州"}' }, index: 0 }] } }] },
  { choices: [{ delta: { tool_calls: [{ function: { arguments: '{}', name: 'list_windows' }, id: 'call_b', index: 1 }] }, finish_reason: 'tool_calls' }] },
]), sink));
check(text, '我看看～', 'text still streams');
check(sink.toolCalls, [
  { arguments: '{"city":"杭州"}', id: 'call_a', name: 'get_weather' },
  { arguments: '{}', id: 'call_b', name: 'list_windows' },
], 'tool calls reassembled in order');
const toolOnlySink = createConversationToolSink();
check(await collect(readOpenAITextStream(sse([
  { choices: [{ delta: { tool_calls: [{ function: { arguments: '{}', name: 'pets' }, id: 'x', index: 0 }] }, finish_reason: 'tool_calls' }] },
]), toolOnlySink)), '', 'tool-only reply yields no text');
check(toolOnlySink.toolCalls.length, 1, 'tool-only reply keeps its call');
await assert.rejects(collect(readOpenAITextStream(sse([{ choices: [{ delta: {}, finish_reason: 'stop' }] }]))), /未返回回复正文/u);
cases++;

// 2. Tool definitions: valid names, stable order, desktop tool only when available.
let config = {
  autoMovementEnabled: true, companionPets: [], currentAction: 'IDLE', modelType: '2d', modelUrl: '',
  personality: { name: '小桃' }, pointerLookEnabled: true, position: { x: 0, y: 0 }, scale: 1, stats: {},
  settings: { lifeCompanion: { ...DEFAULT_LIFE_COMPANION_SETTINGS }, sharedUserMemory: [] },
} as unknown as PetConfig;
const approvals: string[] = [];
let approve = true;
const runtime: ConversationToolRuntime = {
  configRef: { get current() { return config; } } as { current: PetConfig },
  onUpdateConfig: (next) => { config = next; },
  petId: 'primary',
  requestApproval: async ({ title }) => { approvals.push(title); return approve; },
};
const names = listConversationToolDefinitions(runtime).map((tool) => tool.function.name);
check(names.every((name) => /^[a-zA-Z0-9_-]{1,64}$/u.test(name)), true, 'tool names are valid');
check(names.includes('cap_life_companion__quiet_hours') && names.includes('memory') && names.includes('files'), true, 'capabilities, memory and files are tools');
check(names.includes('desktop_task') || names.includes('read_window'), false, 'no desktop tools without a desktop session (the coarse desktop_task tool is gone)');

// 3. The loop: round 1 calls a read tool and a change tool, round 2 answers; approval text is plain language.
const turns: ConversationToolTurn[] = [];
const rounds = [
  { calls: [
    { arguments: '{}', id: 'c1', name: 'cap_pets__list' },
    { arguments: '{"start":"22:00","end":"07:00"}', id: 'c2', name: 'cap_life_companion__quiet_hours' },
  ], text: '好呀，我来设置～' },
  { calls: [], text: '设好啦，晚上十点到早上七点我不打扰你。' },
];
const reply = await collect(streamConversationWithTools({
  requestRound: async (turn) => {
    turns.push(turn);
    const round = rounds[turns.length - 1];
    turn.sink.toolCalls = round.calls;
    return (async function* () { yield round.text; })();
  },
  runtime,
}));
check(reply, '好呀，我来设置～\n\n设好啦，晚上十点到早上七点我不打扰你。', 'rounds join into one reply');
check(approvals, ['把安静时段设为 22:00–07:00'], 'only the change asked, in plain language');
check([config.settings.lifeCompanion.quietHoursStart, config.settings.lifeCompanion.quietHoursEnd], ['22:00', '07:00'], 'change applied');
const second = turns[1].extraMessages as Array<{ content?: string; role: string; tool_call_id?: string }>;
check(second.map((message) => message.role), ['assistant', 'tool', 'tool'], 'assistant call message then both results');
assert.match(String(second[1].content), /小桃：已启用/u);
check(turns[0].tools === turns[1].tools || JSON.stringify(turns[0].tools) === JSON.stringify(turns[1].tools), true, 'same tool list every round (cacheable)');

// 4. A declined change is reported back, not executed.
approve = false;
const declinedTurns: ConversationToolTurn[] = [];
await collect(streamConversationWithTools({
  requestRound: async (turn) => {
    declinedTurns.push(turn);
    if (declinedTurns.length === 1) turn.sink.toolCalls = [{ arguments: '{"enabled":false}', id: 'd1', name: 'cap_life_companion__quiet_hours' }];
    return (async function* () { yield declinedTurns.length === 1 ? '' : '好，那就不改。'; })();
  },
  runtime,
}));
check(config.settings.lifeCompanion.quietHoursEnabled, true, 'declined change not applied');
assert.match(String((declinedTurns[1].extraMessages[1] as { content: string }).content), /没有同意/u);
cases++;

// 5. Runaway loops stop at the round limit.
let calls = 0;
const runaway = await collect(streamConversationWithTools({
  maxRounds: 3,
  requestRound: async (turn) => {
    calls += 1;
    turn.sink.toolCalls = [{ arguments: '{}', id: `r${calls}`, name: 'cap_pets__list' }];
    return (async function* () { yield ''; })();
  },
  runtime,
}));
check(calls, 3, 'stops after max rounds');
assert.match(runaway, /步骤太多/u);
cases++;

// 6. Desktop tools: read a window, act on ids or points, one scope approval, typing asked each time.
const notepad = { box: { height: 600, width: 800, x: 100, y: 100 }, hwnd: 42, pid: 7, processName: 'notepad', title: '无标题 - 记事本' };
const explorer = { box: { height: 500, width: 700, x: 1000, y: 100 }, hwnd: 43, pid: 8, processName: 'explorer', title: '下载' };
type FakeWindow = typeof notepad;
const elementsOf = (window: FakeWindow, labels: string[]) => labels.map((label, index) => ({
  box: { height: 20, width: 60, x: window.box.x + 10, y: window.box.y + 30 * (index + 1) },
  center: { x: window.box.x + 40, y: window.box.y + 30 * (index + 1) + 10 },
  enabled: true, id: index + 1, label, role: '按钮', source: 'uia' as const,
}));
let readCount = 0;
const inputs: Array<Record<string, unknown>> = [];
const executed: string[] = [];
const desktopApprovals: string[] = [];
const fakeDesktop = (labelsFor: (window: FakeWindow) => string[]): DesktopToolDependencies => ({
  executeLoop: async (action) => { executed.push(action.action); return { detail: `${action.action} ok`, ok: true }; },
  focusWindow: async () => undefined,
  input: async (request) => { inputs.push(request); return null; },
  look: null,
  openUrl: async () => null,
  observeElements: async (window) => {
    readCount += 1;
    return {
      captureStatus: 'ok', capturedAt: 0, durationMs: 1, elements: elementsOf(window as FakeWindow, labelsFor(window as FakeWindow)),
      observationId: `o${readCount}`, ocrStatus: 'ok', uiaCount: 3, window,
    };
  },
  observeScreen: async () => { throw new Error('not used'); },
  observeWindows: async () => ({ active: notepad, windows: [notepad, explorer] }),
  sleep: async () => undefined,
});
const desktopRuntime: ConversationToolRuntime = {
  ...runtime,
  desktop: createConversationDesktopSession({
    dependencies: fakeDesktop((window) => (window.hwnd === 42 ? ['文件', '编辑', readCount > 1 ? '已保存' : '保存'] : ['报告.docx', '回收站'])),
    goal: '帮我在记事本里保存',
    requestApproval: async ({ title }) => { desktopApprovals.push(title); return true; },
    settings: config.settings,
  }),
};
const desktopNames = listConversationToolDefinitions(desktopRuntime).map((tool) => tool.function.name);
check(['list_windows', 'read_window', 'click', 'type_text', 'press_keys', 'scroll', 'drag', 'wait'].every((name) => desktopNames.includes(name)), true, 'desktop tools offered');
check(desktopNames.includes('look') || desktopNames.includes('desktop_task'), false, 'no look without vision, no coarse desktop task');
const call = (name: string, args: Record<string, unknown>, id = name) => ({ arguments: JSON.stringify(args), id, name });
const [read] = await runConversationToolCalls(desktopRuntime, [call('read_window', { window: '记事本' })]);
assert.match(read.content, /\[3\] 按钮 "保存"/u);
check(desktopApprovals.length, 0, 'reading needs no approval');
const [click] = await runConversationToolCalls(desktopRuntime, [call('click', { target: '3' })]);
check([executed, desktopApprovals], [['click'], ['让我操作你的电脑']], 'first click asks once for the task scope');
assert.match(click.content, /变化：窗口内容变化/u);
assert.match(click.content, /已保存/u);
check(Boolean(click.compact) && !click.compact?.includes('[1]'), true, 'click result has a compact form without the list');
await runConversationToolCalls(desktopRuntime, [call('click', { button: 'double', target: '1' }), call('press_keys', { keys: '^s' })]);
check(desktopApprovals.length, 1, 'later clicks and keys run inside the scope');
check(executed, ['click', 'double_click', 'press_keys'], 'sequential calls keep their order');
await runConversationToolCalls(desktopRuntime, [call('type_text', { target: '1', text: '你好' })]);
check(desktopApprovals.length, 2, 'typing is confirmed every time');
await runConversationToolCalls(desktopRuntime, [call('read_window', { window: '下载' }), call('drag', { from: '1', to: '300,400' })]);
check([inputs[0]?.action, inputs[0]?.fromX, inputs[0]?.toX, inputs[0]?.toY], ['drag', 1040, 300, 400], 'drag from an element to a point');
check('expectedForegroundHwnd' in inputs[0], false, 'cross-window drag has no foreground guard');
await runConversationToolCalls(desktopRuntime, [call('drag', { from: '1', to: '2' })]);
check(desktopApprovals.length, 3, 'dragging into the recycle bin is confirmed');
await runConversationToolCalls(desktopRuntime, [call('scroll', { amount: 3, direction: 'down' })]);
check([inputs.at(-1)?.action, inputs.at(-1)?.notches, inputs.at(-1)?.x], ['scroll', -3, 1350], 'scroll at the window center');
const [bad] = await runConversationToolCalls(desktopRuntime, [call('click', { target: '99' })]);
assert.match(bad.content, /没有编号 \[99\]/u);
cases += 3;

// 6b. A context menu in front gets the click directly, without refocusing (which would close it).
const menu = { box: null, hwnd: 99, pid: 7, processName: 'notepad', title: '主机弹出窗口' };
let menuOpen = false;
const menuInputs: Array<Record<string, unknown>> = [];
const menuExecuted: string[] = [];
const menuRuntime: ConversationToolRuntime = {
  ...runtime,
  desktop: createConversationDesktopSession({
    dependencies: {
      ...fakeDesktop(() => ['文件', '重命名']),
      executeLoop: async (action) => { menuExecuted.push(action.action); if (action.action === 'right_click') menuOpen = true; return { detail: 'ok', ok: true }; },
      input: async (request) => { menuInputs.push(request); return null; },
      observeWindows: async () => ({ active: menuOpen ? menu : notepad, windows: menuOpen ? [notepad, menu] : [notepad] }),
    },
    goal: 'x', requestApproval: async () => true, settings: config.settings,
  }),
};
await runConversationToolCalls(menuRuntime, [call('read_window', { window: '记事本' }), call('click', { button: 'right', target: '1' }), call('click', { target: '2' })]);
check([menuExecuted, menuInputs.map((request) => [request.action, request.expectedForegroundHwnd])], [['right_click'], [['click', 99]]], 'menu item clicked inside the popup');

// 7. Declining the scope stops further desktop actions.
const declinedDesktop: ConversationToolRuntime = {
  ...runtime,
  desktop: createConversationDesktopSession({
    dependencies: fakeDesktop(() => ['保存']), goal: 'x', requestApproval: async () => false, settings: config.settings,
  }),
};
await runConversationToolCalls(declinedDesktop, [call('read_window', { window: '记事本' })]);
const [first, secondClick] = await runConversationToolCalls(declinedDesktop, [call('click', { target: '1' }, 'a'), call('click', { target: '1' }, 'b')]);
assert.match(first.content, /没有允许操作电脑/u);
assert.match(secondClick.content, /没有允许操作电脑/u);
cases += 2;

// 8. Older window readings shrink to one line in later rounds; the newest stays in full.
const compactTurns: ConversationToolTurn[] = [];
await collect(streamConversationWithTools({
  requestRound: async (turn) => {
    compactTurns.push(turn);
    if (compactTurns.length === 1) turn.sink.toolCalls = [call('read_window', { window: '记事本' }, 'r1')];
    if (compactTurns.length === 2) turn.sink.toolCalls = [call('click', { target: '1' }, 'r2')];
    return (async function* () { yield compactTurns.length === 3 ? '好了' : ''; })();
  },
  runtime: desktopRuntime,
}));
const toolMessages = (compactTurns[2].extraMessages as Array<{ content: string; role: string }>).filter((message) => message.role === 'tool');
check([/读过窗口/u.test(toolMessages[0].content), /\[1\]/u.test(toolMessages[1].content)], [true, true], 'old reading compacted, newest kept in full');

// 9. Bridged runtime tools: same permission policy; reads run directly, commands ask first.
const bridgeCalls: string[] = [];
const bridgeApprovals: string[] = [];
const bridgeRuntime: ConversationToolRuntime = {
  ...runtime,
  executeAgentCommand: async (command) => {
    bridgeCalls.push(command.toolCall?.name ?? command.kind);
    return { ok: true, responseText: `${command.toolCall?.name} 输出` } as never;
  },
  requestApproval: async ({ title }) => { bridgeApprovals.push(title); return true; },
};
const bridgeNames = listConversationToolDefinitions(bridgeRuntime).map((tool) => tool.function.name);
check(['web_search', 'browser', 'run_command', 'system_info', 'desktop_icons', 'skills', 'mcp', 'game_companion', 'local_project'].every((name) => bridgeNames.includes(name)), true, 'bridged tools offered');
check(listConversationToolDefinitions(runtime).map((tool) => tool.function.name).includes('run_command'), false, 'no bridged runtime tools without the runtime');
const bridgeResults = await runConversationToolCalls(bridgeRuntime, [
  call('system_info', {}, 'b1'),
  call('browser', { action: 'read_page' }, 'b2'),
  call('run_command', { command: 'Start-Process notepad' }, 'b3'),
  call('run_command', { command: 'Get-Process -Name notepad' }, 'b7'),
  call('run_command', { command: 'Start-Process notepad' }, 'b8'),
  call('run_command', { command: 'Get-Item $(Start-Process notepad)' }, 'b9'),
]);
check(bridgeCalls, ['get_system_info', 'control_browser', 'run_controlled_command', 'run_controlled_command', 'run_controlled_command', 'run_controlled_command'], 'bridged calls reach the old runtime');
// A command that changes something asks once per reply; a look-up never asks; a look-up
// with a command hidden inside still asks.
check(bridgeApprovals, ['运行命令：Start-Process notepad', '运行命令：Get-Item $(Start-Process notepad)'], 'only changing commands ask, once, in plain words');
check(bridgeResults.map((result) => result.content).slice(0, 3), ['get_system_info 输出', 'control_browser 输出', 'run_controlled_command 输出'], 'runtime output returned');
const [piped, deleting] = await runConversationToolCalls(bridgeRuntime, [call('run_command', { command: 'Get-Volume | Select Size' }, 'b5'), call('run_command', { command: 'Remove-Item x' }, 'b6')]);
check([/管道/u.test(piped.content), /删除/u.test(deleting.content), bridgeApprovals.length], [true, true, 2], 'blocked commands are refused before asking');
const [badUrl] = await runConversationToolCalls(bridgeRuntime, [call('browser', { action: 'open_url', url: 'example.com' }, 'b4')]);
assert.match(badUrl.content, /http/u);
cases += 1;

// 10. The runtime world (the director moving the pet) hears about tool rounds, not plain chat.
const worldKinds: string[] = [];
const stopWorld = getAgentRuntimeWorldController().subscribe((result) => { worldKinds.push(...result.processedEvents.map((event) => event.kind)); });
await collect(streamConversationWithTools({ requestRound: async () => (async function* () { yield '只是聊天'; })(), runtime }));
check(worldKinds, [], 'plain chat sends nothing to the runtime world');
let worldRound = 0;
await collect(streamConversationWithTools({
  requestRound: async (turn) => {
    worldRound += 1;
    if (worldRound === 1) turn.sink.toolCalls = [{ arguments: '{}', id: 'w1', name: 'cap_pets__list' }];
    return (async function* () { yield worldRound === 1 ? '' : '好了'; })();
  },
  runtime,
}));
stopWorld();
check([worldKinds[0], worldKinds.at(-1)], ['agent.task-started', 'agent.task-succeeded'], 'tool rounds start and finish a task in the runtime world');

console.log(`conversation loop smoke ok: ${cases} checks`);
