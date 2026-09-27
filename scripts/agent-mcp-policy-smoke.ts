import { strict as assert } from 'node:assert';
import {
  createAgentMcpPolicyLine,
  parseAgentMcpPolicyConfig,
  resolveAgentMcpPolicy,
} from '../src/agent';
import { executeMcpCallWithPolicy } from '../src/agent/agentMcpPolicyRuntime';

const config = parseAgentMcpPolicyConfig({
  policies: {
    default: { retryCount: 1, timeoutMs: 2000 },
    servers: {
      alpha: { mode: 'deny' },
    },
    tools: {
      'alpha/echo': { mode: 'allow', retryCount: 0, timeoutMs: 1500 },
      'beta/write': { mode: 'deny' },
    },
  },
});

const alphaEcho = resolveAgentMcpPolicy(config, { serverId: 'alpha', toolName: 'echo' });
assert.equal(alphaEcho.allowed, true);
assert.equal(alphaEcho.source, 'tool');
assert.equal(alphaEcho.timeoutMs, 1500);

const alphaOther = resolveAgentMcpPolicy(config, { serverId: 'alpha', toolName: 'other' });
assert.equal(alphaOther.allowed, false);
assert.equal(alphaOther.source, 'server');

const betaWrite = resolveAgentMcpPolicy(config, { serverId: 'beta', toolName: 'write' });
assert.equal(betaWrite.allowed, false);
assert.equal(betaWrite.source, 'tool');
assert.match(createAgentMcpPolicyLine(config, { name: 'write', serverId: 'beta' }), /deny, tool/u);

const denied = await executeMcpCallWithPolicy(betaWrite, async () => {
  throw new Error('should not execute');
});
assert.equal(denied.isError, true);
assert.match(denied.content[0]?.text ?? '', /policy denied/i);

let attempts = 0;
const retryDecision = resolveAgentMcpPolicy(config, { serverId: 'gamma', toolName: 'retry' });
const retried = await executeMcpCallWithPolicy(retryDecision, async () => {
  attempts += 1;
  if (attempts === 1) {
    throw new Error('transient');
  }

  return { content: [{ text: 'ok', type: 'text' }] };
});
assert.equal(retried.isError, undefined);
assert.equal(retried.content[0]?.text, 'ok');
assert.equal(retried.structuredContent?.policyRetry?.retryCount, 1);
assert.equal(retried.structuredContent?.policyRetry?.failedAttempts?.[0]?.attempt, 1);
assert.match(String(retried.structuredContent?.policyRetry?.failedAttempts?.[0]?.error ?? ''), /transient/u);
assert.equal(attempts, 2);

let failedAttempts = 0;
const failedRetry = await executeMcpCallWithPolicy(retryDecision, async () => {
  failedAttempts += 1;
  throw new Error(`still failing ${failedAttempts}`);
});
assert.equal(failedRetry.isError, true);
assert.equal(failedAttempts, 2);
assert.equal(failedRetry.structuredContent?.policy?.finalAttempt, 2);
assert.equal(failedRetry.structuredContent?.policy?.failedAttempts?.length, 2);
assert.match(failedRetry.content[0]?.text ?? '', /still failing 2/u);

console.log('agent MCP policy smoke passed');
