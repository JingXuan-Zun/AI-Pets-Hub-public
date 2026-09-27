import assert from 'node:assert/strict';

import { type AgentRuntimeContinuation } from '../src/agent/index.ts';
import { resolveChatAgentRuntimeContinuation } from '../src/components/chat/chatAgentRuntimeCompatibility.ts';

function continuation(userGoal: string): AgentRuntimeContinuation {
  return {
    historyLines: [],
    sourceText: `/agent ${userGoal}`,
    steps: [],
    traceEvents: [],
    toolResults: [],
    userGoal,
  };
}

const canonical = continuation('Canonical task');
const legacy = continuation('Legacy task');

assert.equal(resolveChatAgentRuntimeContinuation({ agentRuntime: canonical }), canonical);
assert.equal(resolveChatAgentRuntimeContinuation({ agentSessionV2: legacy }), legacy);
assert.equal(
  resolveChatAgentRuntimeContinuation({ agentRuntime: canonical, agentSessionV2: legacy }),
  canonical,
);
assert.equal(resolveChatAgentRuntimeContinuation(null), null);
assert.equal(resolveChatAgentRuntimeContinuation({}), null);

console.log('agent runtime chat persistence compatibility smoke ok');
