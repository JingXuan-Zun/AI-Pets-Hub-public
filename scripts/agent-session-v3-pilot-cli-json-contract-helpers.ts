import assert from 'node:assert/strict';

export function parseTrailingJsonObject(stdout: string) {
  const jsonStart = stdout.lastIndexOf('\n{');
  const fallbackStart = stdout.indexOf('{');
  const start = jsonStart >= 0 ? jsonStart + 1 : fallbackStart;

  assert.notEqual(start, -1, `Expected trailing JSON object in stdout:\n${stdout}`);

  return JSON.parse(stdout.slice(start)) as Record<string, unknown>;
}

export function assertObjectRecord(value: unknown, label: string) {
  assert.equal(typeof value, 'object', `${label} should be an object.`);
  assert.notEqual(value, null, `${label} should not be null.`);

  return value as Record<string, unknown>;
}

export function assertNumberRecordKeys(
  value: unknown,
  keys: readonly string[],
  label: string,
) {
  const record = assertObjectRecord(value, label);

  for (const key of keys) {
    assert.equal(typeof record[key], 'number', `${label}.${key} should be a number.`);
  }

  return record;
}

export function assertNestedKind(
  container: Record<string, unknown>,
  key: string,
  kind: string,
) {
  const nested = assertObjectRecord(container[key], key);

  assert.equal(nested.kind, kind);

  return nested;
}

export function assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source: string,
  label: string,
) {
  assert.doesNotMatch(
    source,
    /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
    `${label} should not depend on runtime execution, permissions, concrete tools, or tool execution.`,
  );
  assert.doesNotMatch(
    source,
    /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
    `${label} should not encode a fixed desktop tool chain.`,
  );
}
