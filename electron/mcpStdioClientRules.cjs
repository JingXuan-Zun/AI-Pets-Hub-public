const { parseJsonObject } = require('./mcpServerConfigLoader.cjs');

function createTextContent(text) {
  return { text: String(text ?? ''), type: 'text' };
}

const MAX_IMAGE_BASE64 = 12 * 1024 * 1024;

function normalizeToolContent(item) {
  if (item?.type === 'text') {
    return createTextContent(item.text);
  }

  // Pictures (a screenshot…) stay pictures: the chat shows them. As JSON text the whole base64
  // went into the model's context.
  if (item?.type === 'image' && typeof item.data === 'string' && item.data.length <= MAX_IMAGE_BASE64) {
    return { data: item.data, mimeType: typeof item.mimeType === 'string' ? item.mimeType : 'image/png', text: '', type: 'image' };
  }

  // Other binary content (audio, blobs) is named, not pasted.
  const { blob: _blob, data: _data, ...rest } = item && typeof item === 'object' ? item : { value: item };
  const omitted = item && typeof item === 'object' && (typeof item.data === 'string' || typeof item.blob === 'string');
  return { text: JSON.stringify(omitted ? { ...rest, data: '（二进制内容，没有放进来）' } : (item ?? null)), type: 'json' };
}

function normalizeToolCallResult(result) {
  const content = Array.isArray(result?.content)
    ? result.content.map(normalizeToolContent)
    : [createTextContent(JSON.stringify(result ?? {}))];

  return {
    content,
    isError: Boolean(result?.isError),
    structuredContent: parseJsonObject(result?.structuredContent, null),
  };
}

function inferMcpCallErrorStatus(error) {
  const message = error?.message || String(error ?? '');
  if (/timed out|timeout/i.test(message)) {
    return 'timeout';
  }

  if (/cancelled|canceled|closed/i.test(message)) {
    return 'cancelled';
  }

  return 'error';
}

function createCooldownToolCallResult(server, retryGate) {
  const waitMs = Math.max(0, Math.round(Number(retryGate.waitMs ?? 0)));
  const reason = retryGate.reason || `MCP server ${server.id} is cooling down after failure.`;
  return {
    content: [createTextContent(`${reason}${waitMs ? ` Retry in ${waitMs}ms.` : ''}`)],
    isError: true,
    structuredContent: {
      mcpServerHealth: retryGate.status,
      retryAfterMs: waitMs,
    },
  };
}

function createSchemaRejectedToolCallResult(validation) {
  return {
    content: [{ text: 'MCP tool arguments did not pass bounded JSON Schema validation; external call was not started.', type: 'text' }],
    isError: true,
    structuredContent: { schemaValidation: validation },
  };
}

function createFieldPolicyDeniedToolCallResult(decision) {
  return {
    content: [{ text: decision.reason, type: 'text' }],
    isError: true,
    structuredContent: { fieldPolicy: decision },
  };
}

function shouldRecordServerFailure(status) {
  return status === 'error' || status === 'timeout';
}

module.exports = {
  createTextContent,
  normalizeToolContent,
  normalizeToolCallResult,
  inferMcpCallErrorStatus,
  createCooldownToolCallResult,
  createSchemaRejectedToolCallResult,
  createFieldPolicyDeniedToolCallResult,
  shouldRecordServerFailure,
};
