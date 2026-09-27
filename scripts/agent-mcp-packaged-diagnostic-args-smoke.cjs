const assert = require('assert/strict');
const {
  applyMcpPackagedDiagnosticArgs,
} = require('../electron/mcpPackagedDiagnosticArgs.cjs');

const env = {};
const result = applyMcpPackagedDiagnosticArgs(env, [
  'AI Desktop Pet.exe',
  '--desktop-pet-mcp-packaged-read-only-call-enable',
  '--desktop-pet-mcp-packaged-read-only-call-headless',
  '--desktop-pet-mcp-packaged-read-only-call-rounds=1',
  '--desktop-pet-mcp-packaged-read-only-call-interval-ms=95000',
  '--desktop-pet-mcp-packaged-production-run-id=production-smoke',
  '--desktop-pet-mcp-config-path=D:\\Project With Spaces\\.desktop-pet-mcp.json',
  '--desktop-pet-mcp-packaged-boot-marker-path=D:\\Probe Output\\boot-marker.json',
]);

assert.equal(env.DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_ENABLE, '1');
assert.equal(env.DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_HEADLESS, '1');
assert.equal(env.DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_ROUNDS, '1');
assert.equal(env.DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_INTERVAL_MS, '95000');
assert.equal(env.DESKTOP_PET_MCP_PACKAGED_PRODUCTION_RUN_ID, 'production-smoke');
assert.equal(env.DESKTOP_PET_MCP_CONFIG_PATH, 'D:\\Project With Spaces\\.desktop-pet-mcp.json');
assert.equal(env.DESKTOP_PET_MCP_PACKAGED_BOOT_MARKER_PATH, 'D:\\Probe Output\\boot-marker.json');
assert.equal(result.applied.includes('DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_ENABLE'), true);

const emptyEnv = {};
assert.deepEqual(applyMcpPackagedDiagnosticArgs(emptyEnv, ['app.exe']), { applied: [] });
assert.deepEqual(emptyEnv, {});

console.log('agent MCP packaged diagnostic args smoke passed');
