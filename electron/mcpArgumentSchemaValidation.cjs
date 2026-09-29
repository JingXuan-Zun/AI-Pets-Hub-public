const Ajv = require('ajv');
const Ajv2019 = require('ajv/dist/2019');
const Ajv2020 = require('ajv/dist/2020');

const MAX_SCHEMA_BYTES = 64 * 1024;
const MAX_SCHEMA_DEPTH = 16;
const MAX_SCHEMA_NODES = 1024;
const MAX_ARGUMENT_DEPTH = 24;
const MAX_ARGUMENT_NODES = 4096;
const MAX_ARGUMENT_ARRAY_ITEMS = 1024;
const MAX_ARGUMENT_PROPERTIES = 512;
const MAX_PATTERN_LENGTH = 256;
const MAX_VALIDATION_ERRORS = 12;
const MAX_VALIDATOR_CACHE = 32;
const UNSAFE_PATTERN_SHAPE = /(?:\\[1-9]|\([^)]*[+*][^)]*\)\s*(?:[+*]|\{)|(?:\.\*){2,})/u;

const draft7Ajv = new Ajv({ allErrors: true, allowUnionTypes: true, strict: false, validateFormats: false });
const draft2019Ajv = new Ajv2019({ allErrors: true, allowUnionTypes: true, strict: false, validateFormats: false });
const draft2020Ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: false, validateFormats: false });
const validatorCache = new Map();

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function inspectPattern(pattern, state) {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    state.error = 'mcp_tool_schema_pattern_limit_exceeded';
  } else if (UNSAFE_PATTERN_SHAPE.test(pattern)) {
    state.error = 'mcp_tool_schema_pattern_rejected';
  }
}

function inspectSchema(value, state, depth = 0) {
  if (state.error) return;
  state.nodes += 1;
  if (state.nodes > MAX_SCHEMA_NODES) {
    state.error = 'mcp_tool_schema_node_limit_exceeded';
    return;
  }
  if (depth > MAX_SCHEMA_DEPTH) {
    state.error = 'mcp_tool_schema_depth_limit_exceeded';
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => inspectSchema(item, state, depth + 1));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if ((key === '$ref' || key === '$dynamicRef') && typeof child === 'string' && !child.startsWith('#')) {
      state.error = 'mcp_tool_schema_remote_reference_rejected';
      return;
    }
    if (key === 'pattern' && typeof child === 'string') {
      inspectPattern(child, state);
      if (state.error) return;
    }
    if (key === 'patternProperties' && isRecord(child)) {
      for (const pattern of Object.keys(child)) {
        inspectPattern(pattern, state);
        if (state.error) return;
      }
    }
    inspectSchema(child, state, depth + 1);
    if (state.error) return;
  }
}

function inspectArguments(value, state, depth = 0) {
  if (state.error) return;
  state.nodes += 1;
  if (state.nodes > MAX_ARGUMENT_NODES) {
    state.error = 'mcp_tool_arguments_node_limit_exceeded';
    return;
  }
  if (depth > MAX_ARGUMENT_DEPTH) {
    state.error = 'mcp_tool_arguments_depth_limit_exceeded';
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (state.seen.has(value)) {
    state.error = 'mcp_tool_arguments_cycle_rejected';
    return;
  }
  state.seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > MAX_ARGUMENT_ARRAY_ITEMS) {
      state.error = 'mcp_tool_arguments_array_limit_exceeded';
      return;
    }
    value.forEach((item) => inspectArguments(item, state, depth + 1));
    return;
  }
  const entries = Object.entries(value);
  if (entries.length > MAX_ARGUMENT_PROPERTIES) {
    state.error = 'mcp_tool_arguments_property_limit_exceeded';
    return;
  }
  entries.forEach(([, child]) => inspectArguments(child, state, depth + 1));
}

function selectAjv(schema) {
  const draft = typeof schema.$schema === 'string' ? schema.$schema : '';
  if (/2020-12/iu.test(draft)) return draft2020Ajv;
  if (/2019-09/iu.test(draft)) return draft2019Ajv;
  return draft7Ajv;
}

function compileValidator(schema) {
  let schemaText;
  try {
    schemaText = JSON.stringify(schema);
  } catch {
    return { error: 'mcp_tool_schema_not_serializable', validator: null };
  }
  if (!schemaText || Buffer.byteLength(schemaText, 'utf8') > MAX_SCHEMA_BYTES) {
    return { error: 'mcp_tool_schema_size_limit_exceeded', validator: null };
  }
  const preflight = { error: null, nodes: 0 };
  inspectSchema(schema, preflight);
  if (preflight.error) return { error: preflight.error, validator: null };
  const cacheKey = `${typeof schema.$schema === 'string' ? schema.$schema : 'draft7'}\n${schemaText}`;
  const cached = validatorCache.get(cacheKey);
  if (cached) return { error: null, validator: cached };
  try {
    const validator = selectAjv(schema).compile(schema);
    if (validatorCache.size >= MAX_VALIDATOR_CACHE) {
      const oldestKey = validatorCache.keys().next().value;
      if (oldestKey) validatorCache.delete(oldestKey);
    }
    validatorCache.set(cacheKey, validator);
    return { error: null, validator };
  } catch {
    return { error: 'mcp_tool_schema_compile_failed', validator: null };
  }
}

function validateMcpToolArguments(schema, input) {
  const argumentPreflight = { error: null, nodes: 0, seen: new WeakSet() };
  inspectArguments(input, argumentPreflight);
  if (argumentPreflight.error) {
    return { error: argumentPreflight.error, errors: [], ok: false, truncated: false };
  }
  const compiled = compileValidator(schema);
  if (!compiled.validator) {
    return { error: compiled.error, errors: [], ok: false, truncated: false };
  }
  const ok = Boolean(compiled.validator(input));
  const sourceErrors = compiled.validator.errors || [];
  return {
    error: ok ? null : 'mcp_tool_arguments_schema_invalid',
    errors: ok ? [] : sourceErrors.slice(0, MAX_VALIDATION_ERRORS).map((error) => ({
      keyword: error.keyword || 'schema',
      path: error.instancePath || '/',
    })),
    ok,
    truncated: !ok && sourceErrors.length > MAX_VALIDATION_ERRORS,
  };
}

module.exports = { validateMcpToolArguments };
