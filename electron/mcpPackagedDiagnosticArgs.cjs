const VALUE_ARGUMENTS = new Map([
  ['--desktop-pet-mcp-config-path', 'DESKTOP_PET_MCP_CONFIG_PATH'],
  ['--desktop-pet-mcp-packaged-boot-marker-path', 'DESKTOP_PET_MCP_PACKAGED_BOOT_MARKER_PATH'],
  ['--desktop-pet-mcp-packaged-read-only-call-report', 'DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_REPORT'],
  ['--desktop-pet-mcp-packaged-read-only-call-rounds', 'DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_ROUNDS'],
  ['--desktop-pet-mcp-packaged-read-only-call-interval-ms', 'DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_INTERVAL_MS'],
  ['--desktop-pet-mcp-packaged-production-run-id', 'DESKTOP_PET_MCP_PACKAGED_PRODUCTION_RUN_ID'],
  ['--desktop-pet-packaged-user-data-dir', 'DESKTOP_PET_PACKAGED_USER_DATA_DIR'],
  ['--desktop-pet-runtime-log-dir', 'DESKTOP_PET_RUNTIME_LOG_DIR'],
]);

const FLAG_ARGUMENTS = new Map([
  ['--desktop-pet-mcp-packaged-read-only-call-enable', 'DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_ENABLE'],
  ['--desktop-pet-mcp-packaged-read-only-call-headless', 'DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_HEADLESS'],
]);

function applyMcpPackagedDiagnosticArgs(env = process.env, argv = process.argv) {
  const applied = [];
  for (const rawArgument of argv) {
    const argument = String(rawArgument || '');
    const flagEnvironmentKey = FLAG_ARGUMENTS.get(argument);
    if (flagEnvironmentKey) {
      env[flagEnvironmentKey] = '1';
      applied.push(flagEnvironmentKey);
      continue;
    }

    for (const [name, environmentKey] of VALUE_ARGUMENTS) {
      const prefix = `${name}=`;
      if (!argument.startsWith(prefix)) {
        continue;
      }
      const value = argument.slice(prefix.length).trim();
      if (value) {
        env[environmentKey] = value;
        applied.push(environmentKey);
      }
      break;
    }
  }

  return { applied: [...new Set(applied)] };
}

module.exports = { applyMcpPackagedDiagnosticArgs };
