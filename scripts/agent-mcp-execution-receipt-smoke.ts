import { strict as assert } from 'node:assert';
import { executeCallMcpTool } from '../src/agent';
import { createAgentMcpExecutionReceipt } from '../src/agent/agentMcpExecutionReceipt';
import { setAgentExternalMcpRuntimeOverride } from '../src/agent/agentExternalMcpBridge';

const successReceipt = createAgentMcpExecutionReceipt({
  elapsedMs: 12.4,
  result: {
    content: [{ text: 'hello from tool', type: 'text' }],
    structuredContent: {
      nested: { token: 'abc123' },
      ok: true,
      password: 'secret-password',
    },
  },
  serverId: 'external-fake',
  toolName: 'echo',
});

assert.equal(successReceipt.status, 'success');
assert.equal(successReceipt.toolName, 'external-fake/echo');
assert.ok(successReceipt.summaryLines.some((line) => line === 'elapsedMs: 12'));
assert.ok(successReceipt.summaryLines.some((line) => line.includes('"token":"[redacted]"')));
assert.ok(successReceipt.summaryLines.some((line) => line.includes('"password":"[redacted]"')));
assert.ok(successReceipt.summaryLines.every((line) => !line.includes('abc123')));
assert.ok(successReceipt.summaryLines.every((line) => !line.includes('secret-password')));

const retryReceipt = createAgentMcpExecutionReceipt({
  elapsedMs: 18,
  result: {
    content: [{ text: 'recovered', type: 'text' }],
    structuredContent: {
      policyRetry: {
        failedAttempts: [{ attempt: 1, error: 'transient' }],
        retryCount: 1,
      },
    },
  },
  serverId: 'external-fake',
  toolName: 'retry',
});
assert.ok(retryReceipt.summaryLines.some((line) => line === 'policyRetry: retryCount 1, failedAttempts 1'));
assert.ok(retryReceipt.evidenceLines.some((line) => line === 'policyRetry: retryCount 1, failedAttempts 1'));

const failedReceipt = createAgentMcpExecutionReceipt({
  elapsedMs: 3,
  result: {
    content: [{ text: 'tool failed', type: 'text' }],
    isError: true,
    structuredContent: {
      policy: {
        failedAttempts: [
          { attempt: 1, error: 'first' },
          { attempt: 2, error: 'second' },
        ],
        retryCount: 1,
      },
    },
  },
  serverId: 'external-fake',
  toolName: 'fail',
});

assert.equal(failedReceipt.status, 'failed');
assert.equal(failedReceipt.title, 'MCP execution failed');
assert.ok(failedReceipt.summaryLines.some((line) => line === 'policyRetry: retryCount 1, failedAttempts 2'));

setAgentExternalMcpRuntimeOverride({
  async callMcpTool(request) {
    return {
      content: [{ text: `external:${String(request?.arguments?.text ?? '')}`, type: 'text' }],
      structuredContent: { echoed: request?.arguments?.text ?? null },
    };
  },
  async listMcpTools() {
    return { ok: true, servers: [], tools: [] };
  },
});

const runtimeResult = await executeCallMcpTool({
  input: {
    argumentsJson: '{"text":"runtime"}',
    name: 'echo',
    serverId: 'external-fake',
  },
  name: 'call_mcp_tool',
});

assert.equal(runtimeResult.ok, true);
assert.equal(runtimeResult.receipt?.status, 'success');
assert.equal(runtimeResult.receipt?.toolName, 'external-fake/echo');
assert.ok(runtimeResult.receipt?.summaryLines.some((line) => line.startsWith('elapsedMs: ')));
assert.ok(runtimeResult.receipt?.summaryLines.some((line) => line.includes('external:runtime')));
assert.ok(runtimeResult.observations?.some((line) => /MCP tool result: success/u.test(line)));

setAgentExternalMcpRuntimeOverride(null);

console.log('agent MCP execution receipt smoke passed');
