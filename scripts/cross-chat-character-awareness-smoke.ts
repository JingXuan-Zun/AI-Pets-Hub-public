// 角色之间互通近况 (docs/cross-chat-character-awareness-design-20261008.md §1 scenario).
import { strict as assert } from 'node:assert';
import { buildCognitionUpdatePrompt } from '../src/character-cognition/characterCognitionModel';
import { describeStatusBoardFor, mergeStatusFacts, STATUS_FACT_TTL_MS, TOLD_USER_WINDOW_MS } from '../src/character-status/characterStatusBoard';
import { STATUS_EXTRACTION_INSTRUCTION, parseStatusFacts } from '../src/character-status/characterStatusExtraction';

let checks = 0;
const ok = (value: unknown, label: string) => { assert.ok(value, label); checks += 1; };
const roles = [{ id: 'a', name: '阿璃' }, { id: 'b', name: '小桃' }, { id: 'c', name: '雪见' }];
const now = Date.UTC(2026, 10, 6, 10);

// A tells the user B is at the library (the update extracts it from A's line).
const output = JSON.stringify({ mood: { label: '忙', intensity: 0.4 }, status: [
  { speaker: '阿璃', subject: '小桃', text: '在图书馆看历史书', quote: 'B 好像在图书馆看书，她最近在看一些历史书' },
  { speaker: '阿璃', subject: '阿璃', text: '今天很忙', quote: '今天我很忙' },
  { speaker: '用户', subject: '小桃', text: '用户说的话', quote: '' },
  { speaker: '阿璃', subject: '不认识的人', text: 'x', quote: '' },
] });
const facts = parseStatusFacts(output, roles, now);
ok(facts.length === 2, 'user lines and unknown names are dropped');
ok(facts[0].kind === 'about-other' && facts[0].subjectPetId === 'b' && facts[1].kind === 'self', 'kinds resolved');

let board = mergeStatusFacts([], facts, now);
ok(mergeStatusFacts(board, facts, now).length === 2, 'repeats are skipped');

// Going to B: she knows what A just told the user.
const forB = describeStatusBoardFor('b', board, now + 10 * 60_000);
ok(/阿璃刚才跟用户说/u.test(forB) && /图书馆/u.test(forB) && /不要否认/u.test(forB), 'B knows what A said about her');
ok(/阿璃：今天很忙（阿璃自己说的/u.test(forB), 'B also knows A is busy');
// C hears about B as A's account.
ok(/小桃：在图书馆看历史书（阿璃提到的/u.test(describeStatusBoardFor('c', board, now)), 'others see it as A\'s account');
ok(!/图书馆/u.test(describeStatusBoardFor('b', board, now).split('【其他角色的近况')[1]?.split('【')[0] ?? ''), 'her own facts are not listed as news about others');

// The relay window and expiry.
ok(!/刚才跟用户说/u.test(describeStatusBoardFor('b', board, now + TOLD_USER_WINDOW_MS + 1)), 'the relay is only fresh for a while');
ok(describeStatusBoardFor('c', board, now + STATUS_FACT_TTL_MS + 1) === '', 'facts expire');

// A newer self-report replaces the older one.
board = mergeStatusFacts(board, [{ ...facts[1], id: 'n', text: '忙完了，在喝茶', createdAt: now + 1 }], now + 1);
ok(board.filter((fact) => fact.kind === 'self' && fact.subjectPetId === 'a').length === 1 && /喝茶/u.test(describeStatusBoardFor('b', board, now + 2)), 'self-report superseded');

// The update prompt asks for status only when the switch is on.
const base = { current: { baseline: { defaultMood: '', neverNegativeTowardUser: true, rules: [] }, concerns: [], initializedAt: 0, mood: { intensity: 0, label: '' }, roleId: 'a', toward: null, updatedAt: 0 }, dialogue: [], name: '阿璃', otherNames: [], persona: '' };
ok(!/"status"/u.test(buildCognitionUpdatePrompt(base).systemInstruction), 'off: no status field');
ok(/"status":\[\]/u.test(buildCognitionUpdatePrompt({ ...base, statusInstruction: STATUS_EXTRACTION_INSTRUCTION }).systemInstruction), 'on: status field requested');
ok(/用户说的话一律不记/u.test(STATUS_EXTRACTION_INSTRUCTION), 'privacy rule in the request');

console.log(`cross-chat character awareness smoke ok: ${checks} checks`);
