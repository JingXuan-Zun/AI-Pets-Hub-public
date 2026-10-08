const MAX_FIELD_RULES = 32;

const MAX_POINTER_LENGTH = 256;

const MAX_POINTER_SEGMENTS = 8;

const MAX_RULE_VALUES = 32;

const MAX_STRING_VALUE_LENGTH = 512;

const MAX_ARRAY_POLICY_ITEMS = 1024;

const BLOCKED_POINTER_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isScalar(value) {
  return value === null || ['boolean', 'number', 'string'].includes(typeof value);
}

function isBoundedDenseScalarArray(value) {
  if (!Array.isArray(value) || value.length > MAX_ARRAY_POLICY_ITEMS) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index) || !isScalar(value[index])) return false;
  }
  return true;
}

function decodePointer(pointer) {
  if (pointer === '') return [];
  if (typeof pointer !== 'string' || !pointer.startsWith('/') || pointer.length > MAX_POINTER_LENGTH) return null;
  const rawSegments = pointer.slice(1).split('/');
  if (rawSegments.length > MAX_POINTER_SEGMENTS) return null;
  const segments = [];
  for (const rawSegment of rawSegments) {
    if (/~(?:[^01]|$)/u.test(rawSegment)) return null;
    const segment = rawSegment.replace(/~1/gu, '/').replace(/~0/gu, '~');
    if (!segment || BLOCKED_POINTER_SEGMENTS.has(segment)) return null;
    segments.push(segment);
  }
  return segments;
}

function readPointer(input, segments) {
  let value = input;
  for (const segment of segments) {
    if (Array.isArray(value)) {
      if (!/^\d+$/u.test(segment)) return { found: false, value: undefined };
      const index = Number(segment);
      if (!Number.isSafeInteger(index) || index >= value.length) return { found: false, value: undefined };
      value = value[index];
      continue;
    }
    if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, segment)) {
      return { found: false, value: undefined };
    }
    value = value[segment];
  }
  return { found: true, value };
}

function normalizeValues(value) {
  if (value === undefined) return { error: null, values: null };
  if (!Array.isArray(value) || !value.length || value.length > MAX_RULE_VALUES) {
    return { error: 'mcp_field_policy_values_invalid', values: null };
  }
  const values = [];
  for (const item of value) {
    if (!isScalar(item) || (typeof item === 'string' && item.length > MAX_STRING_VALUE_LENGTH)) {
      return { error: 'mcp_field_policy_values_invalid', values: null };
    }
    values.push(item);
  }
  return { error: null, values };
}

function scalarMatches(value, expected) {
  return isScalar(value) && Object.is(value, expected);
}

function invalidDecision(path = null) {
  return {
    allowed: false,
    error: 'mcp_field_policy_invalid',
    mode: 'deny',
    path,
    reason: 'MCP field policy configuration is invalid.',
  };
}

module.exports = { MAX_FIELD_RULES, MAX_POINTER_LENGTH, MAX_POINTER_SEGMENTS, MAX_RULE_VALUES, MAX_STRING_VALUE_LENGTH, MAX_ARRAY_POLICY_ITEMS, BLOCKED_POINTER_SEGMENTS, isRecord, isScalar, isBoundedDenseScalarArray, decodePointer, readPointer, normalizeValues, scalarMatches, invalidDecision };
