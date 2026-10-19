import assert from 'node:assert/strict';
import { subscribeAgentLoopApprovals, waitForAgentLoopApproval } from '../src/components/chat/runController/agentLoopApprovalRegistry';
import { classifyVoiceApproval, resolvePendingApprovalBySpeech, resolvePendingApprovalByVoice } from '../src/components/chat/voiceApproval';

// Spoken answers to approval cards: only clear whole-utterance yes/no words count.
for (const text of ['同意', '同意。', '可以啊', '我同意', '确认吧', '允许', '没问题']) assert.equal(classifyVoiceApproval(text), 'approve', text);
for (const text of ['拒绝', '不同意！', '不行', '不要', '取消吧', '不可以']) assert.equal(classifyVoiceApproval(text), 'deny', text);
for (const text of ['好', '好的', '行吧', '准了']) assert.equal(classifyVoiceApproval(text), 'approve', text);
for (const text of ['不', '先别', '不用了']) assert.equal(classifyVoiceApproval(text), 'deny', text);
for (const text of ['嗯', '我觉得你说的我同意一半', '帮我打开记事本', '可以帮我看看吗', '好不好看', '']) assert.equal(classifyVoiceApproval(text), null, text);

// Nothing waiting: speech is left alone.
assert.equal(resolvePendingApprovalByVoice('同意'), null);

// The most recent waiting card is answered; unrelated speech does not touch it.
const older = waitForAgentLoopApproval('card-older');
const newer = waitForAgentLoopApproval('card-newer');
assert.equal(resolvePendingApprovalByVoice('今天天气不错'), null);
assert.equal(resolvePendingApprovalByVoice('同意'), 'approve');
assert.equal(await newer, true);
assert.equal(resolvePendingApprovalByVoice('拒绝'), 'deny');
assert.equal(await older, false);
assert.equal(resolvePendingApprovalByVoice('同意'), null);
// Free-form answers: fixed words act at once without asking the model; other short replies
// are understood by the model; long speech and "unrelated" leave the card waiting.
const judged: string[] = [];
const judge = async (_question: string, answer: string) => {
  judged.push(answer);
  return answer.includes('去吧') ? 'approve' as const : answer.includes('等会') ? 'deny' as const : null;
};
const third = waitForAgentLoopApproval('card-third');
assert.equal(await resolvePendingApprovalBySpeech('今天吃什么好呢', judge), null);
assert.equal(await resolvePendingApprovalBySpeech('这句话非常非常长，说的是今天下午去公园散步看到了一只特别可爱的小猫咪，一直跟着我走了好远好远好远', judge), null);
assert.equal(await resolvePendingApprovalBySpeech('去吧去吧没事', judge), 'approve');
assert.equal(await third, true);
const fourth = waitForAgentLoopApproval('card-fourth');
assert.equal(await resolvePendingApprovalBySpeech('同意', judge), 'approve');
assert.equal(await fourth, true);
const fifth = waitForAgentLoopApproval('card-fifth');
assert.equal(await resolvePendingApprovalBySpeech('嗯你等会再弄', judge), 'deny');
assert.equal(await fifth, false);
assert.deepEqual(judged, ['今天吃什么好呢', '去吧去吧没事', '嗯你等会再弄'], 'fixed words and long speech never reach the model');
assert.equal(await resolvePendingApprovalBySpeech('去吧', judge), null, 'nothing waiting: nothing asked');

// While her voice is playing nothing is acted on — not even a short "好", which could be her
// own voice — and nothing goes to the model; once she is silent the same answer counts.
const talking = () => true;
const silent = () => false;
const sixth = waitForAgentLoopApproval('card-sixth');
judged.length = 0;
assert.equal(await resolvePendingApprovalBySpeech('夫君大人，可以让我去点一下吗', judge, talking), null);
assert.equal(await resolvePendingApprovalBySpeech('好', judge, talking), null);
assert.equal(await resolvePendingApprovalBySpeech('去吧去吧没事', judge, talking), null);
assert.deepEqual(judged, [], 'nothing is sent to the model while she talks');
assert.equal(await resolvePendingApprovalBySpeech('好', judge, silent), 'approve');
assert.equal(await sixth, true);
// The microphone is told when a question starts and stops waiting, so a question registered
// after the last chat update still wakes it (it stayed paused through a whole question).
let wakeUps = 0;
const unsubscribe = subscribeAgentLoopApprovals(() => { wakeUps += 1; });
const seventh = waitForAgentLoopApproval('card-seventh');
assert.equal(wakeUps, 1, 'told when the question starts waiting');
resolvePendingApprovalByVoice('同意');
assert.equal(await seventh, true);
assert.equal(wakeUps, 2, 'told when it is answered');
unsubscribe();
console.log('voice approval smoke ok');
