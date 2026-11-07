// Cognition layer phase 2: when a character may speak first (limits agreed 2026-11-06).
import { strict as assert } from 'node:assert';
import {
  PROACTIVE_LIMITS,
  buildProactiveLineInstruction,
  decideProactiveSpeech,
  spendConcern,
  trackPresence,
  type ProactiveSpeechEntry,
  type ProactiveSpeechInput,
} from '../src/character-cognition/proactiveSpeechRules';
import type { CharacterCognition } from '../src/character-cognition/characterCognitionTypes';

let checks = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); checks += 1; };
const MIN = 60_000;
const now = new Date(2026, 10, 6, 15, 0).getTime();

const cognition = (roleId: string, charge: number): CharacterCognition => ({
  baseline: { defaultMood: '平静', neverNegativeTowardUser: true, rules: [] },
  concerns: charge ? [{ about: 'user', charge, chargedAt: now, createdAt: now, id: `${roleId}-c`, keywords: ['比赛'], text: `${roleId} 惦记的事` }] : [],
  initializedAt: now, mood: { intensity: 0.5, label: '担心' }, roleId, toward: null, updatedAt: now,
});
const base = (over: Partial<ProactiveSpeechInput> = {}): ProactiveSpeechInput => ({
  candidates: [{ cognition: cognition('a', 40), name: 'A', roleId: 'a' }, { cognition: cognition('b', 70), name: 'B', roleId: 'b' }],
  chatBusy: false, enabled: true, idleMs: 5_000, justCameBack: false, lastUserMessageAt: now - 30 * MIN,
  log: [], now, quietHours: false, ...over,
});
const entry = (roleId: string, minutesAgo: number): ProactiveSpeechEntry => ({ at: now - minutesAgo * MIN, concernText: 'x', kind: 'concern', name: roleId, roleId });
const reason = (input: ProactiveSpeechInput) => { const d = decideProactiveSpeech(input); return 'reason' in d ? d.reason : `speak:${d.candidate.roleId}`; };

// The most eager one with enough charge speaks.
check(reason(base()), 'speak:b', 'the strongest concern over the threshold speaks');
check(reason(base({ candidates: [{ cognition: cognition('a', 40), name: 'A', roleId: 'a' }] })), '还没有谁有特别想说的事', 'below the threshold nobody speaks');
check(reason(base({ candidates: [{ cognition: cognition('a', 0), name: 'A', roleId: 'a' }] })), '还没有谁有特别想说的事', 'no concern, no speech (no canned lines)');

// Every limit.
check(reason(base({ enabled: false })), '主动聊天关着', 'switch off');
check(reason(base({ quietHours: true })), '现在是安静时段', 'quiet hours');
check(reason(base({ chatBusy: true })), '正在聊天或说话，等一下', 'busy');
check(reason(base({ idleMs: PROACTIVE_LIMITS.awayAfterMs })), '你不在电脑前，等你回来', 'away');
check(reason(base({ lastUserMessageAt: now - 5 * MIN })), '你刚说过话（10 分钟内不主动打扰）', 'right after the user spoke');
check(reason(base({ log: [entry('a', 10)] })), '离上一次主动说话还不到 20 分钟', 'at least 20 minutes apart');
check(reason(base({ log: [entry('a', 50), entry('c', 25)] })), '这一小时已经主动说了 2 次', 'two per hour in total');
check(reason(base({ log: [entry('b', 40)] })), '还没有谁有特别想说的事', 'once per hour per character (b spoke, a is below threshold)');
const today = Array.from({ length: 8 }, (_, index) => entry(`r${index}`, 70 + index * 25));
check(reason(base({ log: today })), '今天已经主动说了 8 次', 'eight a day');

// Coming back: a weaker concern is enough for one hello, even right after an old message.
check(reason(base({ candidates: [{ cognition: cognition('a', 30), name: 'A', roleId: 'a' }], justCameBack: true, lastUserMessageAt: now - 2 * MIN })), 'speak:a', 'welcome back');
const away = trackPresence({ awaySince: null }, 40 * MIN, now);
check(away.justCameBack, false, 'still away');
const back = trackPresence(away, 2_000, now + MIN);
check(back, { awaySince: null, justCameBack: true }, 'back after 40 minutes');
check(trackPresence(trackPresence({ awaySince: null }, 12 * MIN, now), 1_000, now + MIN).justCameBack, false, 'a short break is not "coming back"');

// Saying it spends the charge; the request carries only the reason, her persona does the talking.
const spent = spendConcern(cognition('b', 70), 'b-c', now);
check([spent.concerns[0].charge, spent.concerns[0].mentionedAt], [21, now], 'spoken concern keeps 30% of its charge');
const instruction = buildProactiveLineInstruction({ concernText: '他明天比赛', kind: 'concern', moodLabel: '担心' });
assert.match(instruction, /他明天比赛/u); assert.doesNotMatch(instruction, /[A-Za-z]{4,}/u, 'no English task note'); checks += 2;

console.log(`proactive speech smoke ok: ${checks} checks`);

// Relationship candidates are decided by the character they are about (phase 3).
import('../src/character-cognition/relationshipSelfReview').then(({ buildRelationshipDecisionPrompt, parseRelationshipDecision, pendingRelationshipCandidates }) => {
  const candidate = {
    baseDimensions: { intimacy: 0.5, trust: 0.5, vigilance: 0.2 }, baseUpdatedAt: null, createdAt: 2, deltas: { intimacy: 0.1, trust: 0, vigilance: -0.05 },
    evidenceExcerpt: '她帮我挑了礼物', id: 'c1', proposedDimensions: { intimacy: 0.6, trust: 0.5, vigilance: 0.15 }, reason: '一起准备礼物',
    screeningDecision: 'manual-review', screeningReasons: [], sourceMessageId: 'm', sourceRoleId: 'a', sourceRoleName: 'A', status: 'pending', targetRoleId: 'b', targetRoleName: 'B',
  } as never;
  const prompt = buildRelationshipDecisionPrompt({ candidate, name: 'A', persona: '人设' });
  assert.match(prompt.payload, /亲近多了一些、戒备少了一些/u); assert.match(prompt.systemInstruction, /人设里写明的关系和感情永远优先/u);
  assert.deepEqual(parseRelationshipDecision('好的 {"accept": false, "why": "我才不会"}'), { accept: false, why: '我才不会' });
  assert.equal(parseRelationshipDecision('{"accept": "yes"}'), null);
  assert.deepEqual(pendingRelationshipCandidates([{ ...(candidate as object), id: 'late', createdAt: 9 }, candidate, { ...(candidate as object), id: 'done', status: 'approved' }] as never).map((c: { id: string }) => c.id), ['c1', 'late']);
  console.log('relationship self-review checks ok: 5');
});

// Back-to-back decisions build on the round's own copy; new candidates arriving meanwhile are kept.
import('../src/character-cognition/useRelationshipSelfReview').then(({ withNewCandidates }) => {
  const working = { candidates: [{ id: 'x', status: 'rejected' }] } as never;
  const latest = { candidates: [{ id: 'x', status: 'pending' }, { id: 'new', status: 'pending' }] } as never;
  const merged = withNewCandidates(working, latest) as unknown as { candidates: { id: string; status: string }[] };
  assert.deepEqual(merged.candidates.map((c) => `${c.id}:${c.status}`), ['x:rejected', 'new:pending']);
  assert.equal(withNewCandidates(working, undefined), working);
  console.log('relationship round copy checks ok: 2');
});
