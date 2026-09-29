import { createAgentMcpToolPolicyKey } from '../../agent/agentMcpPolicy';

export type SettingsMcpFieldPolicyMode =
  | 'allow-array-values'
  | 'allow-values'
  | 'deny-array-values'
  | 'deny-field'
  | 'deny-values'
  | 'inherit';

export interface SettingsMcpFieldPolicyDraft {
  mode: SettingsMcpFieldPolicyMode;
  valuesText: string;
}

export interface SettingsMcpSchemaField {
  arrayItemValuePolicySupported: boolean;
  enumValues: unknown[];
  path: string;
  typeLabel: string;
  valuePolicySupported: boolean;
}

const MAX_SCHEMA_FIELDS = 64;
const MAX_SCHEMA_FIELD_DEPTH = 3;
const MAX_SCHEMA_VISIT_NODES = 256;
const MAX_LOCAL_REF_SEGMENTS = 8;
const BLOCKED_POINTER_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function encodePointerSegment(value: string) {
  return value.replace(/~/gu, '~0').replace(/\//gu, '~1');
}

function schemaTypeLabel(schema: Record<string, unknown>) {
  if (typeof schema.type === 'string') return schema.type;
  if (Array.isArray(schema.type)) return schema.type.filter((item) => typeof item === 'string').join(' | ');
  if (schema.const === null) return 'null';
  if (schema.const !== undefined) return typeof schema.const;
  return 'unknown';
}

function supportsScalarValuePolicy(schema: Record<string, unknown>) {
  const types = typeof schema.type === 'string'
    ? [schema.type]
    : Array.isArray(schema.type)
      ? schema.type.filter((item): item is string => typeof item === 'string')
      : [];
  if (types.length) return types.some((type) => ['boolean', 'integer', 'null', 'number', 'string'].includes(type));
  if (schema.const !== undefined) {
    return schema.const === null || ['boolean', 'number', 'string'].includes(typeof schema.const);
  }
  if (Array.isArray(schema.enum) && schema.enum.length) {
    return schema.enum.every((value) => value === null || ['boolean', 'number', 'string'].includes(typeof value));
  }
  return null;
}

function decodeLocalRef(ref: string) {
  if (!ref.startsWith('#/') || ref.length > 512) return null;
  const rawSegments = ref.slice(2).split('/');
  if (!rawSegments.length || rawSegments.length > MAX_LOCAL_REF_SEGMENTS) return null;
  const segments: string[] = [];
  for (const rawSegment of rawSegments) {
    if (/~(?:[^01]|$)/u.test(rawSegment)) return null;
    const segment = rawSegment.replace(/~1/gu, '/').replace(/~0/gu, '~');
    if (!segment || BLOCKED_POINTER_SEGMENTS.has(segment)) return null;
    segments.push(segment);
  }
  return segments;
}

function resolveLocalRef(rootSchema: Record<string, unknown>, ref: string) {
  const segments = decodeLocalRef(ref);
  if (!segments) return null;
  let value: unknown = rootSchema;
  for (const segment of segments) {
    const record = asRecord(value);
    if (!Object.prototype.hasOwnProperty.call(record, segment)) return null;
    value = record[segment];
  }
  return asRecord(value);
}

interface SchemaVariant {
  refStack: Set<string>;
  schema: Record<string, unknown>;
}

export function collectSettingsMcpSchemaFields(inputSchema: Record<string, unknown>) {
  const fields: SettingsMcpSchemaField[] = [];
  const fieldsByPath = new Map<string, SettingsMcpSchemaField>();
  const arrayItemSupportByPath = new Map<string, boolean | null>();
  const scalarSupportByPath = new Map<string, boolean | null>();
  let visitedNodes = 0;

  function expandVariants(schemaValue: unknown, refStack: Set<string>): SchemaVariant[] {
    if (visitedNodes >= MAX_SCHEMA_VISIT_NODES) return [];
    visitedNodes += 1;
    const schema = asRecord(schemaValue);
    const variants: SchemaVariant[] = [{ refStack, schema }];
    const ref = typeof schema.$ref === 'string' ? schema.$ref : '';
    if (ref && !refStack.has(ref)) {
      const resolved = resolveLocalRef(inputSchema, ref);
      if (resolved) variants.push(...expandVariants(resolved, new Set([...refStack, ref])));
    }
    for (const keyword of ['allOf', 'anyOf', 'oneOf']) {
      const branches = schema[keyword];
      if (!Array.isArray(branches)) continue;
      for (const branch of branches) variants.push(...expandVariants(branch, refStack));
    }
    return variants;
  }

  function addField(path: string, variants: SchemaVariant[]) {
    const schemas = variants.map((variant) => variant.schema);
    const typeLabel = schemas.map(schemaTypeLabel).find((label) => label !== 'unknown') ?? 'unknown';
    const enumValues = schemas
      .map((schema) => Array.isArray(schema.enum) ? schema.enum.slice(0, 32) : [])
      .find((values) => values.length) ?? [];
    const scalarDecisions = schemas.map(supportsScalarValuePolicy).filter((value) => value !== null);
    const scalarSupport = scalarDecisions.length ? scalarDecisions.some(Boolean) : null;
    const arrayItemDecisions = variants.map((variant) => {
      if (Array.isArray(variant.schema.prefixItems) || Array.isArray(variant.schema.items)) return false;
      if (variant.schema.items && typeof variant.schema.items === 'object') {
        const itemVariants = expandVariants(variant.schema.items, variant.refStack);
        const itemDecisions = itemVariants
          .map((itemVariant) => supportsScalarValuePolicy(itemVariant.schema))
          .filter((value) => value !== null);
        return Boolean(itemDecisions.length && itemDecisions.every(Boolean));
      }
      const types = typeof variant.schema.type === 'string'
        ? [variant.schema.type]
        : Array.isArray(variant.schema.type)
          ? variant.schema.type.filter((item): item is string => typeof item === 'string')
          : [];
      return types.includes('array') ? false : null;
    }).filter((value) => value !== null);
    const arrayItemSupport = arrayItemDecisions.length ? arrayItemDecisions.every(Boolean) : null;
    const existing = fieldsByPath.get(path);
    if (existing) {
      if (existing.typeLabel === 'unknown' && typeLabel !== 'unknown') existing.typeLabel = typeLabel;
      if (!existing.enumValues.length && enumValues.length) existing.enumValues = enumValues;
      const previousSupport = scalarSupportByPath.get(path) ?? null;
      const combinedSupport = previousSupport === true || scalarSupport === true
        ? true
        : previousSupport === false || scalarSupport === false
          ? false
          : null;
      scalarSupportByPath.set(path, combinedSupport);
      existing.valuePolicySupported = combinedSupport ?? true;
      const previousArraySupport = arrayItemSupportByPath.get(path) ?? null;
      const combinedArraySupport = previousArraySupport === false || arrayItemSupport === false
        ? false
        : previousArraySupport === true || arrayItemSupport === true
          ? true
          : null;
      arrayItemSupportByPath.set(path, combinedArraySupport);
      existing.arrayItemValuePolicySupported = combinedArraySupport ?? false;
      return;
    }
    if (fields.length >= MAX_SCHEMA_FIELDS) return;
    const field = {
      arrayItemValuePolicySupported: arrayItemSupport ?? false,
      enumValues,
      path,
      typeLabel,
      valuePolicySupported: scalarSupport ?? true,
    };
    fields.push(field);
    fieldsByPath.set(path, field);
    arrayItemSupportByPath.set(path, arrayItemSupport);
    scalarSupportByPath.set(path, scalarSupport);
  }

  function visit(schemaValue: unknown, parentPath: string, depth: number, refStack = new Set<string>()) {
    if (depth >= MAX_SCHEMA_FIELD_DEPTH || fields.length >= MAX_SCHEMA_FIELDS) return;
    for (const variant of expandVariants(schemaValue, refStack)) {
      for (const [name, propertyValue] of Object.entries(asRecord(variant.schema.properties))) {
        if (fields.length >= MAX_SCHEMA_FIELDS) return;
        const propertySchema = asRecord(propertyValue);
        const path = `${parentPath}/${encodePointerSegment(name)}`;
        const propertyVariants = expandVariants(propertySchema, variant.refStack);
        addField(path, propertyVariants.length
          ? propertyVariants
          : [{ refStack: variant.refStack, schema: propertySchema }]);
        visit(propertySchema, path, depth + 1, variant.refStack);
      }
      const tupleItems = Array.isArray(variant.schema.prefixItems)
        ? variant.schema.prefixItems
        : Array.isArray(variant.schema.items)
          ? variant.schema.items
          : [];
      for (const [index, itemSchemaValue] of tupleItems.slice(0, 8).entries()) {
        if (fields.length >= MAX_SCHEMA_FIELDS) return;
        const itemSchema = asRecord(itemSchemaValue);
        const path = `${parentPath}/${index}`;
        const itemVariants = expandVariants(itemSchema, variant.refStack);
        addField(path, itemVariants.length
          ? itemVariants
          : [{ refStack: variant.refStack, schema: itemSchema }]);
        visit(itemSchema, path, depth + 1, variant.refStack);
      }
    }
  }
  visit(inputSchema, '', 0);
  return fields;
}

function getToolRule(configText: string, tool: { name: string; serverId: string }) {
  const config = asRecord(JSON.parse(configText || '{}') as unknown);
  const tools = asRecord(asRecord(config.policies).tools);
  return asRecord(tools[createAgentMcpToolPolicyKey(tool.serverId, tool.name)]);
}

export function getSettingsMcpFieldPolicyDraft(
  configText: string,
  tool: { name: string; serverId: string },
  path: string,
): SettingsMcpFieldPolicyDraft {
  try {
    const rule = asRecord(asRecord(getToolRule(configText, tool).fields)[path]);
    const values = Array.isArray(rule.values) ? rule.values : [];
    if (rule.mode === 'deny' && !values.length) return { mode: 'deny-field', valuesText: '[]' };
    if (rule.mode === 'deny') return { mode: 'deny-values', valuesText: JSON.stringify(values) };
    if (rule.mode === 'allow') return { mode: 'allow-values', valuesText: JSON.stringify(values) };
    if (rule.mode === 'deny-items') return { mode: 'deny-array-values', valuesText: JSON.stringify(values) };
    if (rule.mode === 'allow-items') return { mode: 'allow-array-values', valuesText: JSON.stringify(values) };
  } catch {
    // Invalid config falls back to a removable local draft.
  }
  return { mode: 'inherit', valuesText: '[]' };
}

function parseScalarValues(text: string) {
  let values: unknown;
  try {
    values = JSON.parse(text || '[]') as unknown;
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Field values must be valid JSON.', values: [] };
  }
  if (!Array.isArray(values) || !values.length || values.length > 32) {
    return { error: 'Field values must be a non-empty JSON array with at most 32 entries.', values: [] };
  }
  if (values.some((value) => (
    value !== null
    && !['boolean', 'number', 'string'].includes(typeof value)
  ))) {
    return { error: 'Field policy values must be strings, numbers, booleans, or null.', values: [] };
  }
  if (values.some((value) => typeof value === 'string' && value.length > 512)) {
    return { error: 'Field policy string values must be 512 characters or fewer.', values: [] };
  }
  return { error: null, values };
}

export function applySettingsMcpFieldPolicyDraft(
  configText: string,
  tool: { name: string; serverId: string },
  path: string,
  draft: SettingsMcpFieldPolicyDraft,
) {
  let config: Record<string, unknown>;
  try {
    config = asRecord(JSON.parse(configText || '{"servers":[]}') as unknown);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid MCP config JSON.', rawText: configText };
  }
  if (!path.startsWith('/') || path.length > 256) {
    return { error: 'Field path is invalid.', rawText: configText };
  }
  const parsedValues = [
    'allow-array-values',
    'allow-values',
    'deny-array-values',
    'deny-values',
  ].includes(draft.mode)
    ? parseScalarValues(draft.valuesText)
    : { error: null, values: [] };
  if (parsedValues.error) return { error: parsedValues.error, rawText: configText };

  const policies = asRecord(config.policies);
  const tools = { ...asRecord(policies.tools) };
  const key = createAgentMcpToolPolicyKey(tool.serverId, tool.name);
  const toolRule = { ...asRecord(tools[key]) };
  const fields = { ...asRecord(toolRule.fields) };
  if (draft.mode === 'inherit') delete fields[path];
  else if (draft.mode === 'deny-field') fields[path] = { mode: 'deny' };
  else fields[path] = {
    mode: draft.mode === 'allow-array-values'
      ? 'allow-items'
      : draft.mode === 'deny-array-values'
        ? 'deny-items'
        : draft.mode === 'allow-values'
          ? 'allow'
          : 'deny',
    values: parsedValues.values,
  };

  if (Object.keys(fields).length) toolRule.fields = fields;
  else delete toolRule.fields;
  if (Object.keys(toolRule).length) tools[key] = toolRule;
  else delete tools[key];
  return {
    error: null,
    rawText: `${JSON.stringify({ ...config, policies: { ...policies, tools } }, null, 2)}\n`,
  };
}
