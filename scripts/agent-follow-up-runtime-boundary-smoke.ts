import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const source = readProjectFile('src/components/chat/petChatMessageSendExecution.ts');
const assessmentSource = readProjectFile('src/agent/agentResultAssessment.ts');

assert.match(
  source,
  /function resolveInitialAgentInstruction[\s\S]*command\.toolCall\?\.goal[\s\S]*command\.instruction[\s\S]*command\.sourceText/u,
  'A follow-up command must return its semantic goal to the Runtime instead of using only the UI button label.',
);
assert.doesNotMatch(
  source,
  /await context\.onAgentChatCommand\(action\.command\)/u,
  'A follow-up command must not dispatch directly from the chat sender before entering the Runtime.',
);
assert.doesNotMatch(
  source,
  /const approvedToolResult = action\?\.kind === 'run-command'/u,
  'A follow-up command must not be executed first and later recorded as an approved Runtime result.',
);
assert.match(
  source,
  /await runPreparedAgentProductionSession\(\{[\s\S]*instruction,/u,
  'The chat sender must route follow-up intent through the production Runtime session.',
);

const retryFunction = assessmentSource
  .slice(assessmentSource.indexOf('function createAgentRetryCommand('), assessmentSource.indexOf('\nfunction createAgentReobserveCommand('));
assert.doesNotMatch(
  retryFunction,
  /闂傚倸鍊搁崐鎼|閸婃|鈧|�/u,
  'Retry instructions must not contain mojibake that can pollute the next model decision.',
);
assert.match(
  retryFunction,
  /preserve the original target and parameters[\s\S]*fresh evidence/u,
  'Retry instructions must preserve logical target semantics and require fresh evidence.',
);

const organizationRecovery = assessmentSource
  .slice(assessmentSource.indexOf("if (command.kind === 'desktop-organization'"), assessmentSource.indexOf("if (command.kind === 'desktop-icon-placement'"));
assert.doesNotMatch(
  organizationRecovery,
  /闂傚倸鍊搁崐鎼|閸婃|鈧|�/u,
  'Desktop organization recovery instructions must not contain mojibake.',
);
assert.match(
  organizationRecovery,
  /Re-observe the current desktop icon layout[\s\S]*preserve the original organization scope/u,
  'Desktop organization recovery must preserve scope while refreshing evidence.',
);

console.log('agent follow-up runtime boundary smoke ok');
