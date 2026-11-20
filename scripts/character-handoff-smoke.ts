// Switching characters (11-19): the new one learns the last three days of the previous chat
// (only today for a 知识记忆人格 character), long chats keep the newest part word for word, her
// entrance stays in her own voice and scene, she keeps knowing it for a day, and only a switch
// between two private chats hands over.
import assert from 'node:assert/strict';
import type { ChatMessage } from '../src/types';

const data = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  clear: () => data.clear(), getItem: (key: string) => data.get(key) ?? null, key: () => null, length: 0,
  removeItem: (key: string) => { data.delete(key); }, setItem: (key: string, value: string) => { data.set(key, value); },
};

const rules = await import('../src/character-handoff/handoffRules');
const store = await import('../src/character-handoff/handoffStore');
const { desktopPetChatStore } = await import('../src/chatStore');

let checks = 0;
const check = (condition: boolean, label: string) => { assert.ok(condition, label); checks += 1; };
const hour = 60 * 60_000;
const now = new Date(2026, 10, 19, 15, 0).getTime();
const msg = (role: 'user' | 'model', text: string, ago: number, petId = 'primary'): ChatMessage => ({ chatMode: 'single', createdAt: now - ago, petId, petName: petId === 'primary' ? '甲' : '乙', role, text });

// Window: three days, or today only.
check(rules.handoffWindowStart(now, false) === now - 72 * hour, 'default: the last three days');
check(rules.handoffWindowStart(now, true) === new Date(2026, 10, 19).getTime(), '知识记忆人格: today only');

const history = [
  msg('user', '四天前的事', 96 * hour),
  msg('user', '前天说的计划', 50 * hour),
  msg('model', '记住了', 50 * hour - 1000),
  msg('user', '和乙说的话', 2 * hour, 'pet-2'),
  msg('user', '今天上午在改简历', 5 * hour),
  msg('model', '我帮你看看第二段', 5 * hour - 1000),
];
const threeDays = rules.selectHandoffMessages(history, 'primary', rules.handoffWindowStart(now, false));
check(threeDays.map((m) => m.text).join('|') === '前天说的计划|记住了|今天上午在改简历|我帮你看看第二段', 'three days of her private chat, nothing older, nothing from another chat');
const today = rules.selectHandoffMessages(history, 'primary', rules.handoffWindowStart(now, true));
check(today.length === 2 && today[0].text === '今天上午在改简历', 'today only');

// Long chats: the newest part word for word, the rest summarized.
const long = Array.from({ length: 50 }, (_, i) => msg(i % 2 ? 'model' : 'user', `第${i}句${'字'.repeat(200)}`, (50 - i) * 60_000));
const { older, recent } = rules.splitForHandoff(long);
check(recent.length > 0 && older.length > 0 && older.length + recent.length === 50, 'split into older + recent');
check(recent[recent.length - 1].text.startsWith('第49句'), 'recent ends with the latest message');
check(recent.reduce((sum, m) => sum + Math.min(m.text.length, 300), 0) <= rules.HANDOFF_VERBATIM_CHARS, 'recent stays within the budget');
check(rules.splitForHandoff(threeDays).older.length === 0, 'a short chat is passed whole');

// Note and entrance.
const lines = rules.formatHandoffLines(threeDays, '甲');
check(lines[0].startsWith('[') && lines[0].includes('用户：前天说的计划') && lines[1].includes('甲：记住了'), 'lines carry date and speaker');
const note = rules.buildHandoffNote({ fromName: '甲', olderSummary: '', recentLines: lines, windowLabel: '最近三天' });
check(note.includes('用户刚才和甲的对话（最近三天）') && note.includes('今天上午在改简历'), 'note holds the conversation');
const entrance = rules.buildEntranceInstruction({ fromName: '甲', handoverLine: '让乙来陪你', note, reason: 'asked' });
check(entrance.includes('这不是用户发来的消息') && entrance.includes('让乙来陪你') && entrance.includes('今天上午在改简历'), 'entrance knows why, the handover line and the chat');
check(entrance.includes('不要扮演甲') && /软件用语/u.test(entrance), 'stays her own voice, no app words');
check(rules.buildEntranceInstruction({ fromName: '甲', handoverLine: '', note, reason: 'switched' }).includes('用户刚从甲那边转过来找你'), 'the user switching is told as such');

// She keeps knowing it for a day.
const record = { at: now, fromName: '甲', fromPetId: 'primary', note, toPetId: 'pet-2' };
check(rules.describeHandoffForReply(record, now + hour).includes('今天上午在改简历'), 'later replies still know it');
check(rules.describeHandoffForReply(record, now + 25 * hour) === '', 'gone after a day');
store.saveHandoffRecord(record);
check(store.readHandoffRecord('pet-2')?.note === note && store.readHandoffRecord('primary') === null, 'kept per character');

// Only a switch between two private chats hands over.
const seen: string[] = [];
const stop = store.onCharacterHandoffRequest((request) => seen.push(`${request.fromPetId}>${request.toPetId}:${request.reason}`));
desktopPetChatStore.setChatMode('single');
desktopPetChatStore.setActivePetId('primary');
store.requestCharacterHandoff('pet-2', 'switched');
store.requestCharacterHandoff('primary', 'switched');
desktopPetChatStore.setChatMode('group');
store.requestCharacterHandoff('pet-2', 'woken');
stop();
check(seen.join(',') === 'primary>pet-2:switched', 'private → another private only (not to herself, not from group chat)');

console.log(`character handoff smoke ok: ${checks} checks`);
