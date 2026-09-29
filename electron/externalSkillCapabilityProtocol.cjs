const CAPABILITY_REQUEST_KIND = 'external-skill-capability-request.v1';
const CAPABILITY_RESPONSE_KIND = 'external-skill-capability-response.v1';
const CAPABILITY_REQUEST_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/u;
const STORAGE_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/u;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseCapabilityRequest(value) {
  if (!isRecord(value) || value.kind !== CAPABILITY_REQUEST_KIND) {
    return { request: null, status: 'not-requested' };
  }
  const capabilityRequestId = typeof value.capabilityRequestId === 'string'
    ? value.capabilityRequestId.trim()
    : '';
  const key = typeof value.key === 'string' ? value.key.trim() : '';
  if (
    !CAPABILITY_REQUEST_ID_PATTERN.test(capabilityRequestId)
    || value.operation !== 'get'
    || value.scope !== 'storage.read'
    || !STORAGE_KEY_PATTERN.test(key)
  ) {
    return { error: 'capability_request_invalid', request: null, status: 'invalid' };
  }
  return {
    request: {
      capabilityRequestId,
      key,
      operation: 'get',
      scope: 'storage.read',
    },
    status: 'requested',
  };
}

function createCapabilityResponseInput(capabilityRequest, capabilityResult) {
  const succeeded = capabilityResult.status === 'succeeded';
  return {
    capabilityRequestId: capabilityRequest.capabilityRequestId,
    kind: CAPABILITY_RESPONSE_KIND,
    response: succeeded
      ? { status: 'succeeded', value: capabilityResult.capabilityValue }
      : { error: capabilityResult.error || 'capability_request_failed', status: 'failed' },
  };
}

module.exports = {
  CAPABILITY_REQUEST_KIND,
  CAPABILITY_RESPONSE_KIND,
  createCapabilityResponseInput,
  parseCapabilityRequest,
};
