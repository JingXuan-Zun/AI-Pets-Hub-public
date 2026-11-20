// "我们家" (11-19): the speaking-position rule reaches every character reply and follows the
// persona both ways; the user's correction is kept as one pinned memory that automatic upkeep
// cannot remove; ordinary sentences with "我们家" are not mistaken for a correction.
import assert from 'node:assert/strict';
import { applyAutoMemoryOperations } from '../src/character-memory/autoMemoryExtraction';
import { normalizeCharacterMemoryState } from '../src/character-memory/characterMemoryTypes';
import { detectPerspectiveCorrection, PERSPECTIVE_MEMORY_PREFIX, withPerspectiveCorrection } from '../src/character-memory/perspectiveCorrection';
import { RELATIONSHIP_PERSPECTIVE_INSTRUCTION } from '../src/services/relationshipPerspectiveRule';
import { buildCharacterReplyStableInstruction } from '../src/services/geminiPromptService';
import type { PetPersonality } from '../src/types';

let checks = 0;
const check = (condition: boolean, label: string) => { assert.ok(condition, label); checks += 1; };

// The rule: both directions, in every reply.
check(/一家人、伴侣，或住在一起/u.test(RELATIONSHIP_PERSPECTIVE_INSTRUCTION) && /没有写这种关系[\s\S]*不要自己说“我们家”/u.test(RELATIONSHIP_PERSPECTIVE_INSTRUCTION), 'family → 我们家; otherwise never on its own');
const personality = { beginDialogs: [], chatAvatarUrl: '', chatHistoryMemory: '', customErrorMessage: '', greeting: '', knowledgeBase: '', name: '测试', systemInstruction: '你是测试角色。', traits: [], userMemory: '', webLearningEnabled: false, webSearchEnabled: false } as PetPersonality;
check(buildCharacterReplyStableInstruction(personality, {} as never).includes(RELATIONSHIP_PERSPECTIVE_INSTRUCTION), 'part of every character reply');

// Corrections.
for (const text of ['什么你家 这是我们家', '是我们的电脑，不是你的', '别说你家，说咱们家', '不要说你的网，是我们家的']) check(Boolean(detectPerspectiveCorrection(text)), `correction: ${text}`);
for (const text of ['我们家的猫饿了', '你的头发好看', '我们去吃饭吧', `${'很长的一段话'.repeat(12)}你家我们家`]) check(!detectPerspectiveCorrection(text), `not a correction: ${text.slice(0, 12)}`);

const now = Date.UTC(2026, 10, 19);
let state = normalizeCharacterMemoryState({ items: [{ createdAt: 1, id: 'm1', kind: 'other', source: 'auto', text: '用户喜欢喝茶', updatedAt: 1 }] });
state = withPerspectiveCorrection(state, '什么你家 这是我们家', now);
const kept = state.items.find((item) => item.text.startsWith(PERSPECTIVE_MEMORY_PREFIX));
check(Boolean(kept?.pinned) && kept?.kind === 'preference' && /这是我们家/u.test(kept?.text ?? ''), 'kept as a pinned memory with her words');
check(withPerspectiveCorrection(state, '我们去吃饭吧', now + 1) === state, 'other messages change nothing');
state = withPerspectiveCorrection(state, '是我们的电脑，不是你的', now + 2);
check(state.items.filter((item) => item.text.startsWith(PERSPECTIVE_MEMORY_PREFIX)).length === 1 && /我们的电脑/u.test(state.items.find((item) => item.pinned)?.text ?? ''), 'a later correction refreshes the one memory');

// Automatic upkeep cannot drop or rewrite it.
const pinnedId = state.items.find((item) => item.pinned)!.id;
const after = applyAutoMemoryOperations(state, { add: [], remove: [pinnedId, 'm1'], update: [{ id: pinnedId, text: '改掉了' }] }, now + 3);
check(after.items.some((item) => item.id === pinnedId && item.text.startsWith(PERSPECTIVE_MEMORY_PREFIX)), 'pinned memory survives automatic remove / update');
check(!after.items.some((item) => item.id === 'm1'), 'unpinned ones can still be tidied');

// Belonging beyond the home topic (11-19 later): to other people, about family members, and
// family matters on her mind.
check(/和用户以外的人说话[\s\S]*我们家/u.test(RELATIONSHIP_PERSPECTIVE_INSTRUCTION) && /不用等别人问/u.test(RELATIONSHIP_PERSPECTIVE_INSTRUCTION), 'to others she says 我们家, and may bring it up herself');
check(/其他角色也和你是一家人[\s\S]*我们家某某/u.test(RELATIONSHIP_PERSPECTIVE_INSTRUCTION), 'family members as 我们家某某');
const { buildCognitionUpdatePrompt } = await import('../src/character-cognition/characterCognitionModel');
const { familyNewsFor } = await import('../src/character-status/characterStatusBoard');
const cognition = { baseline: { defaultMood: '平静', neverNegativeTowardUser: true, rules: [] }, concerns: [], initializedAt: now, mood: { intensity: 0.3, label: '平静' }, roleId: 'a', toward: null, updatedAt: now };
const withNews = buildCognitionUpdatePrompt({ current: cognition, dialogue: [{ speaker: '用户', text: '早' }], familyNews: ['乙：今天在学做饭'], name: '甲', now, otherNames: ['乙'], persona: '' });
check(JSON.parse(withNews.payload).familyNews?.[0] === '乙：今天在学做饭' && /familyNews[\s\S]*一家人[\s\S]*不是一家人就不必放/u.test(withNews.systemInstruction), 'family news offered, only kept when the persona makes them family');
const withoutNews = buildCognitionUpdatePrompt({ current: cognition, dialogue: [{ speaker: '用户', text: '早' }], name: '甲', now, otherNames: ['乙'], persona: '' });
check(!('familyNews' in JSON.parse(withoutNews.payload)) && !/familyNews/u.test(withoutNews.systemInstruction), 'nothing extra without news');
const fact = (subjectPetId: string, subjectName: string, text: string, ago: number) => ({ createdAt: now - ago, id: `${subjectPetId}-${ago}`, kind: 'self' as const, quote: '', sourceName: subjectName, sourcePetId: subjectPetId, subjectName, subjectPetId, text });
const news = familyNewsFor('a', [fact('a', '甲', '我自己的事', 1000), fact('b', '乙', '在学做饭', 2000), fact('c', '丙', '昨天的事', 30 * 3600_000)], now);
check(news.length === 1 && news[0] === '乙：在学做饭', 'only the others, only recent');

// After the real test (11-19 evening): the one-line reminder sits right before the user's
// message, and a correction made before this existed is found in her history once.
const { RELATIONSHIP_PERSPECTIVE_REMINDER } = await import('../src/services/relationshipPerspectiveRule');
const { readFileSync } = await import('node:fs');
const promptSource = readFileSync(new URL('../src/services/geminiPromptService.ts', import.meta.url), 'utf8');
const turnBuilder = promptSource.slice(promptSource.indexOf('export function buildCharacterReplyTurnContext'), promptSource.indexOf('export function buildCharacterReplySystemInstruction'));
const singleBuilder = promptSource.slice(promptSource.indexOf('export function buildCharacterReplySystemInstruction'));
check(/personality\.cognitionNote[\s\S]*RELATIONSHIP_PERSPECTIVE_REMINDER,\s*\]/u.test(turnBuilder), 'reminder last in the per-turn part (after the history)');
check(/buildPersonaRuleContractInstruction\(personality\),[\s\S]*RELATIONSHIP_PERSPECTIVE_REMINDER,\s*\]/u.test(singleBuilder), 'and last in the single-instruction path');
check(RELATIONSHIP_PERSPECTIVE_REMINDER.includes('聊天记录里以前的说法不算数'), 'it overrides her own earlier wording');
const { withEarlierPerspectiveCorrection } = await import('../src/character-memory/perspectiveCorrection');
const fresh = normalizeCharacterMemoryState({ items: [] });
const backfilled = withEarlierPerspectiveCorrection(fresh, ['帮我看看光猫', '什么你家 这是我们家', '好吧'], now);
check(backfilled.items.length === 1 && backfilled.items[0].pinned === true, 'an earlier correction in the history becomes the memory');
check(withEarlierPerspectiveCorrection(backfilled, ['不是你家 是我们家'], now) === backfilled, 'only when she has none yet');
check(withEarlierPerspectiveCorrection(fresh, ['我们家的猫饿了'], now) === fresh, 'ordinary lines do not count');

console.log(`relationship perspective smoke ok: ${checks} checks`);
