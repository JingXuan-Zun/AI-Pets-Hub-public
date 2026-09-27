const MAX_DISCOVERY_PATHS = 180;
const SENSITIVE_PATH_SEGMENT_PATTERN = /(?:api[_-]?key|secret|password|token|credential|private[_-]?key)/iu;
const FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

export type AgentPetSettingsJsonValue = boolean | number | string | null | AgentPetSettingsJsonValue[] | { [key: string]: AgentPetSettingsJsonValue };
export type AgentPetSettingsPathSegment = number | string;

export function isAgentPetSettingsPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isAgentPetSettingsSensitivePath(path: string) {
  return path.split('.').some((segment) => SENSITIVE_PATH_SEGMENT_PATTERN.test(segment));
}

function redactAgentPetSettingsValue(value: unknown, path: string): unknown {
  if (isAgentPetSettingsSensitivePath(path)) {
    return typeof value === 'string' && value.length > 0 ? '已设置（已隐藏）' : '未设置';
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => redactAgentPetSettingsValue(entry, `${path}.${index}`));
  }
  if (!isAgentPetSettingsPlainRecord(value)) return value;

  const recordDeclaresSensitiveValue = typeof value.valueType === 'string'
    && SENSITIVE_PATH_SEGMENT_PATTERN.test(value.valueType);
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    recordDeclaresSensitiveValue && key === 'value'
      ? (typeof entry === 'string' && entry.length > 0 ? '已设置（已隐藏）' : '未设置')
      : redactAgentPetSettingsValue(entry, path ? `${path}.${key}` : key),
  ]));
}

export function formatAgentPetSettingsValue(value: unknown, path: string) {
  if (isAgentPetSettingsSensitivePath(path)) {
    return typeof value === 'string' && value.length > 0 ? '已设置（已隐藏）' : '未设置';
  }
  const serialized = JSON.stringify(redactAgentPetSettingsValue(value, path));
  if (typeof serialized !== 'string') return String(value);
  return serialized.length > 320 ? `${serialized.slice(0, 317)}...` : serialized;
}

export function collectAgentPetSettingsPaths(value: unknown, path = '', paths: string[] = []) {
  if (paths.length >= MAX_DISCOVERY_PATHS) return paths;
  if (Array.isArray(value)) {
    if (!value.length && path) paths.push(path);
    else value.forEach((entry, index) => collectAgentPetSettingsPaths(entry, path ? `${path}.${index}` : String(index), paths));
    return paths;
  }
  if (isAgentPetSettingsPlainRecord(value)) {
    const entries = Object.entries(value);
    // Runtime history can contain many entries. Put the live settings branch first so
    // configuration discovery is not starved by unrelated history at the root.
    if (!path) {
      entries.sort(([left], [right]) => {
        if (left === 'settings') return -1;
        if (right === 'settings') return 1;
        return 0;
      });
    }
    if (!entries.length && path) paths.push(path);
    for (const [key, entry] of entries) {
      collectAgentPetSettingsPaths(entry, path ? `${path}.${key}` : key, paths);
      if (paths.length >= MAX_DISCOVERY_PATHS) break;
    }
    return paths;
  }
  if (path) paths.push(path);
  return paths;
}

export function parseAgentPetSettingsPath(input: unknown): AgentPetSettingsPathSegment[] | null {
  if (typeof input !== 'string' || !input.trim()) return null;
  const segments = input.trim().split('.').map((segment) => segment.trim());
  if (!segments.length || segments.some((segment) => !segment || FORBIDDEN_PATH_SEGMENTS.has(segment))) return null;
  return segments.map((segment) => (/^(?:0|[1-9]\d*)$/u.test(segment) ? Number(segment) : segment));
}

export function getAgentPetSettingsValueAtPath(source: unknown, path: AgentPetSettingsPathSegment[]) {
  let current: unknown = source;
  for (const segment of path) {
    if (Array.isArray(current) && typeof segment === 'number' && segment < current.length) {
      current = current[segment];
      continue;
    }
    if (isAgentPetSettingsPlainRecord(current) && typeof segment === 'string' && Object.prototype.hasOwnProperty.call(current, segment)) {
      current = current[segment];
      continue;
    }
    return { found: false as const, value: undefined };
  }
  return { found: true as const, value: current };
}

export function cloneAgentPetSettingsValue<T>(config: T) {
  return JSON.parse(JSON.stringify(config)) as T;
}

export function doesAgentPetSettingsValueTypeMatch(current: unknown, next: unknown) {
  if (Array.isArray(current)) return Array.isArray(next);
  if (current === null) return next === null;
  if (isAgentPetSettingsPlainRecord(current)) return isAgentPetSettingsPlainRecord(next);
  if (typeof current === 'number') return typeof next === 'number' && Number.isFinite(next);
  return typeof current === typeof next;
}

export function setAgentPetSettingsValueAtPath(source: unknown, path: AgentPetSettingsPathSegment[], value: AgentPetSettingsJsonValue) {
  const target = getAgentPetSettingsValueAtPath(source, path.slice(0, -1));
  const finalSegment = path[path.length - 1];
  if (!target.found || finalSegment === undefined) return false;
  if (Array.isArray(target.value) && typeof finalSegment === 'number' && finalSegment < target.value.length) {
    target.value[finalSegment] = value;
    return true;
  }
  if (isAgentPetSettingsPlainRecord(target.value) && typeof finalSegment === 'string' && Object.prototype.hasOwnProperty.call(target.value, finalSegment)) {
    target.value[finalSegment] = value;
    return true;
  }
  return false;
}