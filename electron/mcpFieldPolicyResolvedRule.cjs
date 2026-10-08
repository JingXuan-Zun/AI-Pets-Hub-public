const { isBoundedDenseScalarArray, scalarMatches } = require('./mcpFieldPolicyRules.cjs');

function evaluateResolvedMcpFieldRule(key, pointer, rawRule, normalizedValues, field) {
  if (rawRule.mode === 'allow-items' || rawRule.mode === 'deny-items') {
    const arrayAllowed = isBoundedDenseScalarArray(field.value);
    const denied = !arrayAllowed || (rawRule.mode === 'deny-items'
      ? field.value.some((item) => normalizedValues.values.some((value) => scalarMatches(item, value)))
      : !field.value.every((item) => normalizedValues.values.some((value) => scalarMatches(item, value))));
    if (denied) {
      return {
        allowed: false,
        error: 'mcp_field_policy_denied',
        mode: rawRule.mode,
        path: pointer,
        reason: `MCP field policy array-item rule denied ${key} at ${pointer}.`,
      };
    }
    return null;
  }
  if (rawRule.mode === 'deny') {
    const denied = !normalizedValues.values
      || normalizedValues.values.some((value) => scalarMatches(field.value, value));
    if (denied) {
      return {
        allowed: false,
        error: 'mcp_field_policy_denied',
        mode: 'deny',
        path: pointer,
        reason: `MCP field policy denied ${key} at ${pointer}.`,
      };
    }
    return null;
  }
  const allowed = normalizedValues.values.some((value) => scalarMatches(field.value, value));
  if (!allowed) {
    return {
      allowed: false,
      error: 'mcp_field_policy_denied',
      mode: 'allow',
      path: pointer,
      reason: `MCP field policy allow-list denied ${key} at ${pointer}.`,
    };
  }
  return null;
}

module.exports = { evaluateResolvedMcpFieldRule };
