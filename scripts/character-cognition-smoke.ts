// Cognition layer (docs/cognition-layer-design-20261106.md): pure rules and the model-output
// handling, above all that a persona's "feelings never turn cold" baseline always holds.
import { strict as assert } from 'node:assert';
import {
  applyCognitionUpdate,
  buildCognitionInitPrompt,
  buildCognitionUpdatePrompt,
  parseCognitionInit,
} from '../src/character-cognition/characterCognitionModel';
import {
  applyTurnToCognition,
  concernTouchedBy,
  describeCognitionForReply,
  effectiveCharge,
  groupAttentionBonus,
  settleConcerns,
  urgeToSpeak,
} from '../src/character-cognition/characterCognitionRules';
import { CONCERN_HALF_LIFE_MS, type CharacterCognition } from '../src/character-cognition/characterCognitionTypes';

let checks = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); checks += 1; };
const t0 = Date.UTC(2026, 10, 6, 8);

// 1. Reading the persona into a starting point.
const initText = '好的：{"baseline":{"rules":["对用户的好感永远是最高的，只会增加不会减少"],"neverNegativeTowardUser":true,"defaultMood":"开心"},"mood":{"label":"开心","intensity":0.6},"concerns":[{"text":"想知道他今天吃饭了没","about":"user","keywords":["吃饭","午饭"]}]}';
const start = parseCognitionInit(initText, 'primary', t0)!;
check([start.baseline.neverNegativeTowardUser, start.baseline.rules.length, start.mood.label, start.concerns.length], [true, 1, '开心', 1], 'persona read into a baseline');
check(parseCognitionInit('不是 JSON', 'primary', t0), null, 'garbage is ignored');
assert.match(buildCognitionInitPrompt({ name: '小桃', otherNames: [], persona: '人设' }).systemInstruction, /永远成立的规则/u); checks += 1;

// 2. Charges leak, get fed by topics, get spent by saying them.
const concern = start.concerns[0];
check(Math.round(effectiveCharge(concern, t0 + CONCERN_HALF_LIFE_MS)), Math.round(concern.charge / 2), 'charge halves after the half-life');
check(concernTouchedBy(start.concerns, '我刚吃完午饭')?.id, concern.id, 'keywords remind her');
check(concernTouchedBy(start.concerns, '今天天气不错'), null, 'unrelated talk does not');
const fed = applyTurnToCognition(start, { userText: '午饭吃了面' }, t0);
check(fed.concerns[0].charge, Math.min(100, concern.charge + 20), 'the user touching it feeds it');
const spent = applyTurnToCognition(fed, { herText: '你吃饭了吗？' }, t0);
check([spent.concerns[0].charge < fed.concerns[0].charge, Boolean(spent.concerns[0].mentionedAt)], [true, true], 'saying it spends it');
check(urgeToSpeak(start, t0), Math.round(concern.charge + 0.6 * 10), 'urge = strongest concern + mood');
check(settleConcerns([{ ...concern, charge: 2 }], t0).length, 0, 'faded concerns are dropped');

// 3. Updates: new concerns, kept ones, dropped ones — and the baseline always wins.
const update = (body: Record<string, unknown>) => applyCognitionUpdate(start, JSON.stringify(body), t0 + 1000)!;
const warm = update({ change: '听说他要比赛', concerns: [{ about: 'user', boost: 50, id: null, keywords: ['比赛'], text: '他周五比赛，不知道准备得怎么样' }, { id: concern.id, text: concern.text, boost: 10 }], drop: [], mood: { intensity: 0.7, label: '担心', towardUser: 0.8 }, toward: { target: 'user', why: '想问问比赛' } });
check([warm.mood.label, warm.concerns.length, warm.toward?.target, warm.lastChange], ['担心', 2, 'user', '听说他要比赛'], 'update applied');
const cold = update({ concerns: [], drop: [concern.id], mood: { intensity: 0.9, label: '生气', towardUser: -0.8 } });
check(cold.mood, start.mood, 'persona says feelings never turn cold: a cold mood toward the user is dropped');
check(cold.concerns.length, 0, 'but other parts of the update still apply');
check(cold.baseline, start.baseline, 'the baseline never changes');
const freeStart = { ...start, baseline: { ...start.baseline, neverNegativeTowardUser: false } } as CharacterCognition;
check(applyCognitionUpdate(freeStart, JSON.stringify({ mood: { label: '委屈', intensity: 0.5, towardUser: -0.3 } }), t0)!.mood.label, '委屈', 'without that rule her mood may change freely');
check(applyCognitionUpdate(start, 'nope', t0), null, 'garbage update ignored');
const many = update({ concerns: Array.from({ length: 5 }, (_, index) => ({ boost: 10 + index * 10, keywords: ['x' + index], text: `事情${index}` })) });
check(many.concerns.length, 3, 'at most three concerns, the strongest kept');
assert.match(buildCognitionUpdatePrompt({ current: start, dialogue: [{ speaker: '用户', text: '你好' }], name: '小桃', otherNames: ['小梨'], persona: '人设' }).systemInstruction, /绝不能违反/u); checks += 1;

// 4. What her reply sees, and group-chat attention.
const note = describeCognitionForReply(warm, t0 + 1000);
assert.match(note, /担心/u); assert.match(note, /比赛/u); assert.match(note, /不要直接念出来/u); checks += 3;
check(describeCognitionForReply({ ...start, concerns: [] }, t0).includes('惦记'), false, 'nothing on her mind: no concerns line');
const bonus = groupAttentionBonus({ cognition: warm, name: '小桃', now: t0 + 1000, topicText: '明天比赛好紧张' });
check([bonus.bonus > 15, bonus.reasons.includes('concern-topic'), bonus.reasons.includes('cognition-urge')], [true, true, true], 'a concern on the topic raises her turn');
const wanted = groupAttentionBonus({ cognition: null, lastSpeakerCognition: { ...warm, toward: { target: '小梨', why: '想问她' } }, name: '小梨', now: t0, topicText: '' });
check(wanted, { bonus: 10, reasons: ['wanted-by-speaker'] }, 'the last speaker wanting to talk to her');
check(groupAttentionBonus({ cognition: null, name: 'x', now: t0, topicText: '' }), { bonus: 0, reasons: [] }, 'no state, no bonus');


// 5. The user's "feelings only grow" switch (2026-11-06): affection sits at the top, hunger never costs it.
import('../src/life-companion/lifeCompanionGrowthController').then(({ applyLifeCompanionPassiveGrowthTick }) => {
  const stats = { affection: 60, energy: 50, fatigue: 20, hunger: 0, mood: 50 } as never;
  const hungry = { hungryDurationMs: 60 * 60_000, stats, tickMs: 60_000 };
  const locked = applyLifeCompanionPassiveGrowthTick({ ...hungry, feelingsNeverDrop: true }).nextStats;
  const free = applyLifeCompanionPassiveGrowthTick(hungry).nextStats;
  assert.equal(locked.affection, 100); assert.ok(free.affection < 60); checks += 2;
  console.log(`character cognition smoke ok: ${checks} checks`);
});
