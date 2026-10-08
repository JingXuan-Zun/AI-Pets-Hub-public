const { MAX_FIELD_RULES, isRecord, decodePointer, normalizeValues, readPointer, invalidDecision } = require('./mcpFieldPolicyRules.cjs');
const { evaluateResolvedMcpFieldRule } = require('./mcpFieldPolicyResolvedRule.cjs');

function evaluateMcpFieldPolicy(config, request) {
  if (config?.fieldPolicyConfigInvalid) return invalidDecision();
  if (config?.policies !== undefined && !isRecord(config.policies)) return invalidDecision();
  const policies = isRecord(config?.policies) ? config.policies : {};
  if (policies.tools !== undefined && !isRecord(policies.tools)) return invalidDecision();
  const tools = isRecord(policies.tools) ? policies.tools : {};
  const key = `${String(request.serverId || '').trim()}/${String(request.toolName || '').trim()}`;
  if (!Object.prototype.hasOwnProperty.call(tools, key)) {
    return { allowed: true, error: null, mode: null, path: null, reason: 'No field policy matched.' };
  }
  if (!isRecord(tools[key])) return invalidDecision();
  const toolRule = tools[key];
  if (toolRule.fields === undefined) {
    return { allowed: true, error: null, mode: null, path: null, reason: 'No field policy matched.' };
  }
  if (!isRecord(toolRule.fields)) return invalidDecision();
  const fieldEntries = Object.entries(toolRule.fields);
  if (fieldEntries.length > MAX_FIELD_RULES) return invalidDecision();

  for (const [pointer, rawRule] of fieldEntries) {
    const segments = decodePointer(pointer);
    if (!segments || !isRecord(rawRule) || !['allow', 'allow-items', 'deny', 'deny-items'].includes(rawRule.mode)) {
      return invalidDecision(pointer);
    }
    const normalizedValues = normalizeValues(rawRule.values);
    if (normalizedValues.error
      || (['allow', 'allow-items', 'deny-items'].includes(rawRule.mode) && !normalizedValues.values)) {
      return invalidDecision(pointer);
    }
    const field = readPointer(request.arguments || {}, segments);
    if (!field.found) continue;
    const decision = evaluateResolvedMcpFieldRule(key, pointer, rawRule, normalizedValues, field);
    if (decision) return decision;
  }

  return { allowed: true, error: null, mode: null, path: null, reason: 'Field policy allowed the arguments.' };
}

module.exports = { evaluateMcpFieldPolicy };
