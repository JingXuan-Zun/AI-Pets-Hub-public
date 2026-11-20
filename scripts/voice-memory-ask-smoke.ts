// Voice conversation (11-20): she asks out loud before remembering — briefly saying what it is —
// and a spoken yes / no answers it like the 记住 / 不用记 buttons; anything else stays ordinary
// chat. One question at a time, answers count for three minutes.
import assert from 'node:assert/strict';
import {
  answerMemoryAskBySpeech,
  buildMemoryAskInstruction,
  classifyMemoryAnswer,
  MEMORY_ASK_ANSWER_WINDOW_MS,
  readPendingMemoryAsk,
  registerMemoryAskAnswerer,
  setPendingMemoryAsk,
} from '../src/neural-memory/voiceMemoryAsk';
import type { NeuralMemoryProposal } from '../src/neural-memory/neuralMemoryProposalTypes';

let checks = 0;
const check = (condition: boolean, label: string) => { assert.ok(condition, label); checks += 1; };

for (const text of ['可以', '好', '好的', '记住吧', '记下来', '行啊']) check(classifyMemoryAnswer(text) === 'approve', `yes: ${text}`);
for (const text of ['不用', '别记', '不用记了', '算了', '不要']) check(classifyMemoryAnswer(text) === 'deny', `no: ${text}`);
for (const text of ['今天晚上吃什么', '好想睡觉啊这个电视剧', '嗯']) check(classifyMemoryAnswer(text) === null, `not an answer: ${text}`);

const proposal: NeuralMemoryProposal = { content: '用户下周三要去体检，早上不能吃东西', createdAt: 1, id: 'p1', reason: '', roleId: 'pet-4', sourceExcerpt: '', sourceMessageIds: [], type: 'experience' };
const ask = buildMemoryAskInstruction(proposal);
check(ask.includes(proposal.content) && /先简单说一下想记住的是什么/u.test(ask) && /问用户可不可以记下来/u.test(ask), 'she says briefly what it is, then asks');
check(/不要照念原文/u.test(ask) && /不要提“记忆提议”“侧栏”“按钮”/u.test(ask), 'in her own words, no app words');
const growthAsk = buildMemoryAskInstruction({ ...proposal, content: '我好像开始喜欢看老电影了', growth: { evidenceNodeIds: ['a', 'b'], kind: 'preference' }, reason: '几个晚上都一起看老电影' });
check(/觉得自己有了一个变化/u.test(growthAsk) && growthAsk.includes('几个晚上都一起看老电影'), 'a growth is asked as a change, with why');

// Pending question: answered once, only within the window.
check(!(await answerMemoryAskBySpeech('好')), 'no question waiting: not an answer');
const heard: string[] = [];
const stop = registerMemoryAskAnswerer(async (text) => { heard.push(text); setPendingMemoryAsk(null); return classifyMemoryAnswer(text) !== null; });
setPendingMemoryAsk({ askedAt: Date.now(), proposalId: 'p1', question: '下周三体检那件事我记下来好吗？', roleId: 'pet-4' });
check(await answerMemoryAskBySpeech('好'), 'a spoken yes answers her');
check(readPendingMemoryAsk() === null, 'and her question is done');
setPendingMemoryAsk({ askedAt: Date.now() - MEMORY_ASK_ANSWER_WINDOW_MS - 1, proposalId: 'p1', question: 'q', roleId: 'pet-4' });
check(!(await answerMemoryAskBySpeech('好')) && heard.length === 1, 'too late: ordinary chat');
stop();

console.log(`voice memory ask smoke ok: ${checks} checks`);
