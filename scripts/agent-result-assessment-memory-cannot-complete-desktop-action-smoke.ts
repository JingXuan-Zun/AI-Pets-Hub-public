import assert from 'node:assert/strict';
import {
  assessAgentCommandResult,
  type AgentChatCommand,
} from '../src/agent/index.ts';

const command: AgentChatCommand = {
  instruction: '打开 WeGame 应用并登录',
  kind: 'tool-call',
  sourceText: '/agent 打开 WeGame 应用并登录',
  toolCall: {
    goal: '打开 WeGame 应用并登录',
    input: {
      action: 'recall',
      query: 'WeGame',
    },
    name: 'execute_memory_action',
  },
};

const assessed = assessAgentCommandResult(command, {
  observations: ['Memory action: recall', 'Memory scope: global', 'Memory filter: WeGame'],
  ok: true,
  responseText: 'No matching Agent memory was found.',
  verification: 'Read 0 matching memories.',
});

assert.equal(assessed.assessment?.status, 'unverified');
assert.match(assessed.assessment?.summary ?? '', /verification evidence is insufficient/iu);
assert.ok(assessed.stateSummary?.missingEvidence?.includes('missing:action-completion-evidence'));

console.log('agent result assessment memory cannot complete desktop action smoke ok');
