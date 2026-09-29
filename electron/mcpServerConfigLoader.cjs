const fs = require('fs');
const path = require('path');

const DEFAULT_MCP_SERVER_TIMEOUT_MS = 15_000;

function parseJsonObject(value, fallback = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  return value;
}

function normalizeServerEntry(entry, projectRoot) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }

  const id = typeof entry.id === 'string' ? entry.id.trim() : '';
  const command = typeof entry.command === 'string' ? entry.command.trim() : '';
  if (!id || !command) {
    return null;
  }

  const cwd = typeof entry.cwd === 'string' && entry.cwd.trim()
    ? path.resolve(projectRoot, entry.cwd.trim())
    : projectRoot;
  return {
    args: Array.isArray(entry.args) ? entry.args.filter((item) => typeof item === 'string') : [],
    command,
    cwd,
    description: typeof entry.description === 'string' ? entry.description.trim() : '',
    env: parseJsonObject(entry.env),
    id,
    timeoutMs: Number.isFinite(Number(entry.timeoutMs))
      ? Math.max(1000, Math.min(120_000, Math.round(Number(entry.timeoutMs))))
      : DEFAULT_MCP_SERVER_TIMEOUT_MS,
    title: typeof entry.title === 'string' && entry.title.trim() ? entry.title.trim() : id,
  };
}

function normalizeConfigServers(rawConfig, projectRoot) {
  const rawServers = Array.isArray(rawConfig?.servers)
    ? rawConfig.servers
    : Object.entries(parseJsonObject(rawConfig?.servers)).map(([id, entry]) => ({
        ...(parseJsonObject(entry)),
        id,
      }));

  return rawServers
    .map((entry) => normalizeServerEntry(entry, projectRoot))
    .filter(Boolean);
}

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readJsonEnv(name) {
  try {
    const rawValue = process.env[name];
    return rawValue && rawValue.trim() ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
}

function readConfigFileSource(projectRoot) {
  const overridePath = (process.env.DESKTOP_PET_MCP_CONFIG_PATH || '').trim();
  const configPath = overridePath
    ? path.resolve(overridePath)
    : path.join(projectRoot, '.desktop-pet-mcp.json');
  const config = readJsonFile(configPath);
  return config
    ? { config, root: path.dirname(configPath) }
    : null;
}

function uniqueServers(servers) {
  const byId = new Map();
  for (const server of servers) {
    byId.set(server.id, server);
  }

  return [...byId.values()];
}

function loadExternalMcpServers(projectRoot) {
  const fileSource = readConfigFileSource(projectRoot);
  const envConfig = readJsonEnv('DESKTOP_PET_MCP_SERVERS_JSON');
  return uniqueServers([
    ...normalizeConfigServers(fileSource?.config, fileSource?.root || projectRoot),
    ...normalizeConfigServers(envConfig, projectRoot),
  ]);
}

function loadExternalMcpPolicyConfig(projectRoot) {
  const fileConfig = readConfigFileSource(projectRoot)?.config;
  const envConfig = readJsonEnv('DESKTOP_PET_MCP_SERVERS_JSON');
  const filePolicyValue = fileConfig?.policies;
  const envPolicyValue = envConfig?.policies;
  const filePolicies = parseJsonObject(filePolicyValue);
  const envPolicies = parseJsonObject(envPolicyValue);
  const fieldPolicyConfigInvalid = [filePolicyValue, envPolicyValue].some((policies) => (
    policies !== undefined
    && (!policies || typeof policies !== 'object' || Array.isArray(policies)
      || (policies.tools !== undefined
        && (!policies.tools || typeof policies.tools !== 'object' || Array.isArray(policies.tools))))
  ));
  return {
    fieldPolicyConfigInvalid,
    policies: {
      ...filePolicies,
      ...envPolicies,
      tools: {
        ...parseJsonObject(filePolicies.tools),
        ...parseJsonObject(envPolicies.tools),
      },
    },
  };
}

function normalizeMcpTool(server, tool) {
  const annotations = parseJsonObject(tool?.annotations);
  return {
    ...(Object.keys(annotations).length ? { annotations } : {}),
    description: typeof tool?.description === 'string' ? tool.description : '',
    inputSchema: parseJsonObject(tool?.inputSchema),
    name: typeof tool?.name === 'string' ? tool.name : '',
    serverId: server.id,
    title: typeof tool?.title === 'string' && tool.title.trim() ? tool.title : tool?.name ?? '',
  };
}

module.exports = {
  DEFAULT_MCP_SERVER_TIMEOUT_MS,
  loadExternalMcpPolicyConfig,
  loadExternalMcpServers,
  normalizeConfigServers,
  normalizeMcpTool,
  parseJsonObject,
};
