// Time in the chat history (2026-11-10): gaps get a time mark, old task cards say they are old,
// and the note says how long it has been and whether the computer / app was restarted.
import assert from 'node:assert/strict';
import { annotateHistoryTimeline, formatHistoryGap, formatHistoryWhen } from '../src/components/chat/chatHistoryTimeline';
import type { ChatMessage } from '../src/types';

let checks = 0;
const check = (condition: unknown, message: string) => { assert.ok(condition, message); checks += 1; };

const HOUR = 60 * 60 * 1000;
const now = new Date(2026, 10, 10, 9, 30).getTime();
const yesterday = (h: number, m = 0) => new Date(2026, 10, 9, h, m).getTime();
const msg = (id: string, role: 'user' | 'model', createdAt: number, text: string) => ({ createdAt, id, role, text }) as unknown as ChatMessage;

check(formatHistoryWhen(new Date(2026, 10, 10, 8, 5).getTime(), now) === '今天 08:05', 'today');
check(formatHistoryWhen(yesterday(15, 10), now) === '昨天 15:10', 'yesterday');
check(formatHistoryWhen(new Date(2026, 10, 7, 21, 0).getTime(), now) === '11月7日 21:00', 'older date');
check(formatHistoryGap(5 * HOUR) === '5 小时' && formatHistoryGap(50 * HOUR) === '2 天', 'gap wording');

// Yesterday's task, then the computer was off; the app started this morning.
const history = [
  msg('a', 'user', yesterday(15, 0), '帮我打开wegame'),
  msg('b', 'model', yesterday(15, 2), '【任务记录】帮我打开wegame：已完成；做了：启动「WeGame」'),
  msg('c', 'model', yesterday(15, 2), '好啦，开好了'),
];
const restarted = annotateHistoryTimeline(history, { appStartedAt: new Date(2026, 10, 10, 9, 0).getTime(), now });
check(restarted.messages[1].text.startsWith('【以前的任务记录 · 昨天 15:02】'), 'old task card says it is old');
check(restarted.messages[0].text === '帮我打开wegame' && restarted.messages[2].text === '好啦，开好了', 'no mark inside one sitting');
check(/上一次说话是昨天 15:02/.test(restarted.note) && /重新打开过/.test(restarted.note) && /不要当成还开着/.test(restarted.note), 'note: how long and restarted');
check(!restarted.note.includes('［…］'), 'no marker explanation when nothing was marked');
check(history[1].text.startsWith('【任务记录】'), 'the original messages are not changed');

// Continued today after the restart: the first message today gets a mark saying so.
const continued = annotateHistoryTimeline([...history, msg('d', 'user', new Date(2026, 10, 10, 9, 20).getTime(), '早上好')], {
  appStartedAt: new Date(2026, 10, 10, 9, 0).getTime(),
  now,
});
check(continued.messages[3].text.startsWith('［今天 09:20 · 距上一条 18 小时 · 中间桌宠重启过］\n早上好'), 'mark on the first message after the gap');
check(continued.note.includes('［…］') && !/重新打开过（/.test(continued.note), 'explains the marks; no restart note once she has talked since');

// Same app run, a long pause: note without restart, the running-session task card stays as is.
const sameRun = annotateHistoryTimeline([
  msg('e', 'model', now - 5 * HOUR, '【任务记录】整理桌面：已完成'),
], { appStartedAt: now - 10 * HOUR, now });
check(sameRun.messages[0].text.startsWith('【以前的任务记录'), 'a task card from 5 hours ago is old');
check(/隔了 5 小时/.test(sameRun.note) && !/重新打开过/.test(sameRun.note), 'long pause without restart');

// A fresh conversation: nothing to add.
const fresh = annotateHistoryTimeline([
  msg('f', 'user', now - 10 * 60 * 1000, '在吗'),
  msg('g', 'model', now - 9 * 60 * 1000, '【任务记录】打开记事本：已完成'),
], { appStartedAt: now - HOUR, now });
check(fresh.note === '' && fresh.messages[1].text.startsWith('【任务记录】'), 'recent talk is left alone');
check(annotateHistoryTimeline([], { appStartedAt: now, now }).note === '', 'empty history');

console.log(`chat history timeline smoke ok: ${checks} checks`);
