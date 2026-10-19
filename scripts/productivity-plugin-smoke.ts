import assert from 'node:assert/strict';
import { listConversationToolDefinitions } from '../src/agent/conversation/conversationTools';
import { getPlatformCapability, runPlatformCapability } from '../src/platform-capabilities/platformCapabilityRegistry';
import { collectDueProductivityEvents, fallbackProductivityLine } from '../src/productivity/productivityScheduler';
import { DEFAULT_PRODUCTIVITY_SETTINGS, normalizeProductivitySettings } from '../src/productivity/productivitySettings';
import { nextRepeatTime, parseLocalTime } from '../src/productivity/productivityTime';
import type { PetConfig } from '../src/types';

let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases++; };

// 1. Time parsing against a fixed "now": Friday 2026-10-09 14:00 local.
const now = new Date(2026, 9, 9, 14, 0, 0, 0).getTime();
const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
check(parseLocalTime('15:00', now), at(2026, 10, 9, 15, 0), 'later today');
check(parseLocalTime('9:30', now), at(2026, 10, 10, 9, 30), 'already past today → tomorrow');
check(parseLocalTime('2026-10-12 08:00', now), at(2026, 10, 12, 8, 0), 'full date');
check(parseLocalTime('10-12 08:00', now), at(2026, 10, 12, 8, 0), 'month-day');
check(parseLocalTime('15：00', now), at(2026, 10, 9, 15, 0), 'full-width colon');
check([parseLocalTime('25:00', now), parseLocalTime('下午三点', now)], [null, null], 'unreadable → null');
check(nextRepeatTime(at(2026, 10, 9, 8, 0), 'daily', now), at(2026, 10, 10, 8, 0), 'daily repeat');
check(nextRepeatTime(at(2026, 10, 9, 8, 0), 'weekdays', now), at(2026, 10, 12, 8, 0), 'weekdays skip the weekend');
check(nextRepeatTime(at(2026, 10, 9, 8, 0), 'none', now), null, 'no repeat');

// 2. Capabilities: registered, personal changes need no confirmation, reads are reads.
let config = { settings: { productivity: DEFAULT_PRODUCTIVITY_SETTINGS } } as unknown as PetConfig;
const configRef = { current: config };
const context = { configRef, onUpdateConfig: (next: PetConfig) => { config = next; configRef.current = next; } };
const run = (capability: string, args: Record<string, unknown> = {}) => runPlatformCapability(context, { args, capability });
check(['reminders.add', 'todos.complete', 'pomodoro.start'].map((id) => getPlatformCapability(id)?.risk), ['personal', 'personal', 'personal'], 'changes are personal');
check(getPlatformCapability('reminders.list')?.risk, 'read', 'listing is a read');
const toolNames = listConversationToolDefinitions({}).map((tool) => tool.function.name);
check(['cap_reminders__add', 'cap_todos__list', 'cap_pomodoro__start'].every((name) => toolNames.includes(name)), true, 'exposed to the conversation loop');

const added = await run('reminders.add', { in_minutes: 30, text: '喝水' });
check(added.ok, true, 'reminder added');
await run('reminders.add', { at: '23:59', repeat: 'daily', text: '吃药' });
check(config.settings.productivity.reminders.map((item) => [item.text, item.repeat]), [['喝水', 'none'], ['吃药', 'daily']], 'two reminders stored');
check((await run('reminders.add', { at: '明天下午', text: 'x' })).ok, false, 'unreadable time refused');
assert.match((await run('reminders.list')).text, /现在是 .*\n1\. .*喝水/u);
cases++;
check((await run('reminders.remove', { match: '喝水' })).ok, true, 'cancel by keyword');
check(config.settings.productivity.reminders.map((item) => item.text), ['吃药'], 'only that one removed');

await run('todos.add', { text: '- 买牛奶\n- 回邮件\n3. 洗衣服' });
check(config.settings.productivity.todos.map((item) => item.text), ['买牛奶', '回邮件', '洗衣服'], 'list items split and cleaned');
assert.match((await run('todos.complete', { match: '2' })).text, /回邮件.*还剩 2 项/u);
cases++;
check((await run('todos.remove', { match: '已完成' })).text, '清掉了 1 项做完的待办。', 'clear finished');

assert.match((await run('pomodoro.start', { task: '写周报' })).text, /专注 25 分钟.*休息 5 分钟/u);
check([config.settings.productivity.pomodoro.phase, config.settings.productivity.pomodoro.task], ['focus', '写周报'], 'pomodoro running with the default 25/5');
assert.match((await run('pomodoro.status')).text, /专注中：写周报，还剩约 25 分钟/u);
cases++;

// 3. Scheduler: due reminders fire once; repeats move on; pomodoro focus → break → idle.
const settings = normalizeProductivitySettings({
  pomodoro: { ...DEFAULT_PRODUCTIVITY_SETTINGS.pomodoro, phase: 'focus', phaseEndsAt: now - 1000, task: '写周报' },
  reminders: [
    { dueAt: now - 1000, id: 'a', repeat: 'none', text: '喝水' },
    { dueAt: now - 60 * 60_000, id: 'b', repeat: 'daily', text: '吃药' },
    { dueAt: now - 2 * 86_400_000, id: 'c', repeat: 'none', text: '很久以前的' },
    { dueAt: now + 86_400_000 * 3, id: 'd', repeat: 'none', text: '还没到' },
  ],
  todos: [],
});
const first = collectDueProductivityEvents(settings, now);
check(first.events.map((event) => event.kind === 'reminder' ? `${event.text}${event.late ? '(迟)' : ''}` : event.kind), ['喝水', '吃药(迟)', 'focus-end'], 'due events, late flagged, stale dropped');
check(first.next.reminders.map((item) => item.id), ['b', 'd'], 'one-offs removed, repeat kept, future kept');
check(first.next.reminders[0].dueAt, at(2026, 10, 10, 13, 0), 'daily repeat moved to tomorrow');
check([first.next.pomodoro.phase, first.next.pomodoro.completedToday], ['break', 1], 'focus → break, counted');
check(collectDueProductivityEvents(first.next, now).changed, false, 'nothing fires twice');
const afterBreak = collectDueProductivityEvents(first.next, first.next.pomodoro.phaseEndsAt! + 1);
check([afterBreak.events.map((event) => event.kind), afterBreak.next.pomodoro.phase], [['break-end'], 'idle'], 'break → idle');
assert.match(fallbackProductivityLine(first.events), /提醒你：喝水。.*刚才该提醒你的：吃药。.*第 1 个番茄/u);
cases++;

console.log(`productivity plugin smoke ok: ${cases} checks`);
