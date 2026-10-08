const { loadExternalMcpPolicyConfig } = require('./mcpServerConfigLoader.cjs');
const { evaluateMcpFieldPolicy } = require('./mcpFieldPolicy.cjs');
const {
  createCooldownToolCallResult,
  createFieldPolicyDeniedToolCallResult,
} = require('./mcpStdioClientRules.cjs');

function recordMcpRejectedToolCall(history, context, result, status) {
  history?.recordToolCallResult?.({
    durationMs: status === 'cooldown' ? 0 : Date.now() - context.startedAt,
    error: result.content[0]?.text ?? '',
    ok: false,
    requestId: context.requestId,
    serverId: context.serverId,
    status,
    toolName: context.name,
  });
  return result;
}

function checkMcpCallCooldown(server, health, history, context) {
  const retryGate = health?.getRetryGate?.(server.id);
  if (!retryGate || retryGate.allowed) {
    return null;
  }
  const result = createCooldownToolCallResult(server, retryGate);
  return recordMcpRejectedToolCall(history, context, result, 'cooldown');
}

function checkMcpCallFieldPolicy(projectRoot, request, history, context) {
  const decision = evaluateMcpFieldPolicy(loadExternalMcpPolicyConfig(projectRoot), {
    arguments: request.arguments ?? {},
    serverId: context.serverId,
    toolName: context.name,
  });
  if (decision.allowed) {
    return null;
  }
  const result = createFieldPolicyDeniedToolCallResult(decision);
  return recordMcpRejectedToolCall(history, context, result, 'field-policy-denied');
}

module.exports = { recordMcpRejectedToolCall, checkMcpCallCooldown, checkMcpCallFieldPolicy };
