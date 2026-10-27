import assert from 'node:assert/strict';
import { latestPendingAgentLoopApprovalId, resolveAgentLoopApproval, waitForAgentLoopApproval, waitForAgentLoopDecision } from '../src/components/chat/runController/agentLoopApprovalRegistry';
import { resolveAgentApprovalDecisionFromText } from '../src/components/chat/runController/approvalDecisionText';
import { classifyVoiceApproval } from '../src/components/chat/voiceApproval';
import { formatQqApprovalQuestion } from '../src/qq-bridge/qqBridgeRelay';

// "这次都允许": one yes covers the rest of the task (the task card itself is checked in the app).

// Spoken, typed and QQ answers.
for (const text of ['都同意', '都同意吧', '这次都允许', '全部允许！', '不用问了', '都好']) assert.equal(classifyVoiceApproval(text), 'approve-task', text);
for (const text of ['都同意', '都好吧', '别问了']) assert.equal(resolveAgentApprovalDecisionFromText(text), 'approve-task', text);
assert.equal(classifyVoiceApproval('同意'), 'approve', 'a plain yes is still one step');
assert.equal(resolveAgentApprovalDecisionFromText('不要'), 'deny');
assert.match(formatQqApprovalQuestion('打开浏览器'), /“都好”/u);

// The answer reaches the waiting question as itself, so the task card can remember it.
const waiting = waitForAgentLoopDecision('card-1');
assert.equal(latestPendingAgentLoopApprovalId(), 'card-1');
resolveAgentLoopApproval('card-1', 'approve-task');
assert.equal(await waiting, 'approve-task');
const legacy = waitForAgentLoopApproval('card-2');
resolveAgentLoopApproval('card-2', 'approve-task');
assert.equal(await legacy, true, 'callers that only want yes/no still get yes');
assert.equal(latestPendingAgentLoopApprovalId(), null);

console.log('approval allow-task smoke ok');
