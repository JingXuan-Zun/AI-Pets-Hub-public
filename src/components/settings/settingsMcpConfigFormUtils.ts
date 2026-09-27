export interface SettingsMcpServerDraft {
  argsText: string;
  command: string;
  cwd: string;
  envJson: string;
  id: string;
  title: string;
}

export interface SettingsMcpConfigParseResult {
  config: Record<string, unknown>;
  error: string | null;
  servers: SettingsMcpServerDraft[];
}

export function createEmptyMcpServerDraft(): SettingsMcpServerDraft {
  return {
    argsText: '',
    command: '',
    cwd: '',
    envJson: '{}',
    id: '',
    title: '',
  };
}

export function hasMcpServerDraftContent(draft: SettingsMcpServerDraft) {
  return Boolean(
    draft.id.trim()
    || draft.command.trim()
    || draft.argsText.trim()
    || draft.cwd.trim()
    || draft.envJson.trim() !== '{}',
  );
}

export function formatMcpConfigResult(result: DesktopPetMcpConfigResultLike | null) {
  if (!result) {
    return '';
  }

  if (!result.ok) {
    return result.error || 'MCP config load failed.';
  }

  return result.exists
    ? `Loaded MCP config from ${result.path}`
    : `MCP config has not been created yet. Saving will write ${result.path}`;
}


function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizeEnvJson(value: unknown) {
  const record = asRecord(value);
  return JSON.stringify(record, null, 2);
}

function serverEntryToDraft(id: string, value: unknown): SettingsMcpServerDraft {
  const server = asRecord(value);
  return {
    argsText: Array.isArray(server.args)
      ? server.args.filter((arg) => typeof arg === 'string').join('\n')
      : '',
    command: normalizeString(server.command),
    cwd: normalizeString(server.cwd),
    envJson: normalizeEnvJson(server.env),
    id: normalizeString(server.id) || id,
    title: normalizeString(server.title),
  };
}

function normalizeServers(rawServers: unknown): SettingsMcpServerDraft[] {
  if (Array.isArray(rawServers)) {
    return rawServers.map((server, index) => serverEntryToDraft(`server-${index + 1}`, server));
  }

  return Object.entries(asRecord(rawServers)).map(([id, server]) => serverEntryToDraft(id, {
    ...asRecord(server),
    id,
  }));
}

export function parseMcpConfigText(rawText: string): SettingsMcpConfigParseResult {
  try {
    const config = JSON.parse(rawText || '{"servers":[]}') as unknown;
    const normalizedConfig = asRecord(config);
    return {
      config: normalizedConfig,
      error: null,
      servers: normalizeServers(normalizedConfig.servers),
    };
  } catch (error) {
    return {
      config: { servers: [] },
      error: error instanceof Error ? error.message : 'Invalid MCP config JSON.',
      servers: [],
    };
  }
}

function normalizeRawServerEntries(rawServers: unknown): Record<string, unknown>[] {
  if (Array.isArray(rawServers)) {
    return rawServers
      .map((server) => asRecord(server))
      .filter((server) => typeof server.id === 'string' && server.id.trim());
  }

  return Object.entries(asRecord(rawServers)).map(([id, server]) => ({
    ...asRecord(server),
    id,
  }));
}

function parseArgsText(argsText: string) {
  return argsText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseEnvJson(envJson: string) {
  if (!envJson.trim()) {
    return {};
  }

  const parsed = JSON.parse(envJson) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('env JSON must be an object.');
  }

  return parsed as Record<string, unknown>;
}

function createServerConfigFromDraft(draft: SettingsMcpServerDraft) {
  const env = parseEnvJson(draft.envJson);
  return {
    args: parseArgsText(draft.argsText),
    command: draft.command.trim(),
    ...(draft.cwd.trim() ? { cwd: draft.cwd.trim() } : {}),
    ...(Object.keys(env).length ? { env } : {}),
    id: draft.id.trim(),
    ...(draft.title.trim() ? { title: draft.title.trim() } : {}),
  };
}

export function applyMcpServerDraftToConfigText(
  rawText: string,
  draft: SettingsMcpServerDraft,
): { error: string | null; rawText: string } {
  const id = draft.id.trim();
  const command = draft.command.trim();
  if (!id || !command) {
    return { error: 'MCP server needs id and command.', rawText };
  }

  let server: Record<string, unknown>;
  try {
    server = createServerConfigFromDraft(draft);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid env JSON.', rawText };
  }

  const parsed = parseMcpConfigText(rawText);
  if (parsed.error) {
    return { error: parsed.error, rawText };
  }

  const existingServers = normalizeRawServerEntries(parsed.config.servers);
  const nextServers = [
    ...existingServers.filter((item) => item.id !== id),
    server,
  ];

  return {
    error: null,
    rawText: `${JSON.stringify({
      ...parsed.config,
      servers: nextServers,
    }, null, 2)}\n`,
  };
}

export function removeMcpServerFromConfigText(
  rawText: string,
  serverId: string,
): { error: string | null; rawText: string } {
  const parsed = parseMcpConfigText(rawText);
  if (parsed.error) {
    return { error: parsed.error, rawText };
  }

  return {
    error: null,
    rawText: `${JSON.stringify({
      ...parsed.config,
      servers: normalizeRawServerEntries(parsed.config.servers)
        .filter((server) => server.id !== serverId),
    }, null, 2)}\n`,
  };
}

export function findMcpServerDraftById(
  servers: SettingsMcpServerDraft[],
  serverId: string,
): { error: string | null; server: SettingsMcpServerDraft | null } {
  const normalizedServerId = serverId.trim();
  const server = servers.find((item) => item.id === normalizedServerId) ?? null;
  if (!server) {
    return {
      error: `MCP server ${normalizedServerId} is not in the current config.`,
      server: null,
    };
  }

  return { error: null, server };
}
