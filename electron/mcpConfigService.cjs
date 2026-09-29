const fs = require('fs');
const path = require('path');

const MCP_CONFIG_FILE_NAME = '.desktop-pet-mcp.json';

function createEmptyConfig() {
  return { servers: [] };
}

function createDefaultConfigText() {
  return `${JSON.stringify(createEmptyConfig(), null, 2)}\n`;
}

function parseJsonConfig(rawText) {
  const text = typeof rawText === 'string' && rawText.trim()
    ? rawText
    : createDefaultConfigText();
  const config = JSON.parse(text);
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('MCP config must be a JSON object.');
  }

  if (!('servers' in config)) {
    return { ...config, servers: [] };
  }

  if (Array.isArray(config.servers)) {
    return config;
  }

  if (config.servers && typeof config.servers === 'object') {
    return config;
  }

  throw new Error('MCP config "servers" must be an array or object.');
}

function createConfigPayload(configPath, exists, rawText, config, error = null) {
  return {
    config,
    error,
    exists,
    ok: !error,
    path: configPath,
    rawText,
  };
}

function createMcpConfigService(options = {}) {
  const projectRoot = options.projectRoot || path.join(__dirname, '..');
  const configPath = path.join(projectRoot, MCP_CONFIG_FILE_NAME);
  const log = typeof options.log === 'function' ? options.log : null;
  const onSaved = typeof options.onSaved === 'function' ? options.onSaved : null;

  function loadConfig() {
    const exists = fs.existsSync(configPath);
    const rawText = exists ? fs.readFileSync(configPath, 'utf8') : createDefaultConfigText();
    try {
      return createConfigPayload(configPath, exists, rawText, parseJsonConfig(rawText));
    } catch (error) {
      return createConfigPayload(
        configPath,
        exists,
        rawText,
        createEmptyConfig(),
        error?.message || String(error),
      );
    }
  }

  function saveConfig(request = {}) {
    const rawText = typeof request.rawText === 'string'
      ? request.rawText
      : JSON.stringify(request.config ?? createEmptyConfig(), null, 2);
    let config;
    try {
      config = parseJsonConfig(rawText);
    } catch (error) {
      return createConfigPayload(
        configPath,
        fs.existsSync(configPath),
        rawText,
        createEmptyConfig(),
        error?.message || String(error),
      );
    }

    const nextRawText = `${JSON.stringify(config, null, 2)}\n`;
    fs.writeFileSync(configPath, nextRawText, 'utf8');
    log?.('saved MCP config', { path: configPath });
    onSaved?.(config);
    return createConfigPayload(configPath, true, nextRawText, config);
  }

  return {
    getConfigPath: () => configPath,
    loadConfig,
    saveConfig,
  };
}

module.exports = {
  createMcpConfigService,
};
