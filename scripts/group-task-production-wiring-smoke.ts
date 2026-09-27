import assert from 'node:assert/strict';
import fs from 'node:fs';

const senderSource = fs.readFileSync('src/components/chat/petChatMessageSendExecution.ts', 'utf8');
const senderHookSource = fs.readFileSync('src/components/chat/usePetChatMessageSender.ts', 'utf8');
const controllerSource = fs.readFileSync('src/components/chat/agentRunController.ts', 'utf8');
const approvalLifecycleSource = fs.readFileSync(
  'src/components/chat/group/task/groupTaskApprovalLifecycle.ts',
  'utf8',
);
const continuationPolicySource = fs.readFileSync(
  'src/components/chat/group/task/groupTaskContinuationPolicy.ts',
  'utf8',
);
const transitionSource = fs.readFileSync(
  'src/components/chat/group/state/groupStateTransitions.ts',
  'utf8',
);
const groupSource = fs.readdirSync('src/components/chat/group', { recursive: true })
  .filter((path) => String(path).endsWith('.ts'))
  .map((path) => fs.readFileSync(`src/components/chat/group/${path}`, 'utf8'))
  .join('\n');

assert.match(transitionSource, /planning: \[[^\]]*'waiting-task'/);
assert.ok(
  senderSource.indexOf('startPreparedGroupTaskRuntime(activeGroupRuntimeRef')
    < senderSource.indexOf('await runPreparedAgentProductionSession'),
);
assert.match(controllerSource, /resolveGroupTaskContinuationOutcome/);
assert.match(continuationPolicySource, /hasPendingFollowUp[\s\S]*'pending-approval'/);
assert.match(controllerSource, /continuationGroupTaskEvent/);
assert.match(controllerSource, /publishGroupTaskEvent\(groupTaskLifecycle, deniedGroupTaskEvent\)/);
assert.match(approvalLifecycleSource, /onExplanationComplete/);
assert.match(senderSource, /continueActiveGroupTaskConversation\(context, preparedRequest\)/);
assert.match(senderHookSource, /continueActiveGroupTaskConversation\(contextRef\.current\)/);
assert.doesNotMatch(groupSource, /GroupChatRuntimeV[23]/);
assert.equal((groupSource.match(/runAgentRuntime\s*\(/g) ?? []).length, 1);

console.log('group task production wiring smoke ok');
