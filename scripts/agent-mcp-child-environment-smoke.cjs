const assert = require('node:assert/strict');
const {
  createMcpChildEnvironment,
  shouldBlockInheritedEnvironmentKey,
} = require('../electron/mcpChildEnvironment.cjs');

assert.equal(shouldBlockInheritedEnvironmentKey('DESKTOP_PET_MCP_SERVERS_JSON'), true);
assert.equal(shouldBlockInheritedEnvironmentKey('openai_api_key'), true);
assert.equal(shouldBlockInheritedEnvironmentKey('GITHUB_TOKEN'), true);
assert.equal(shouldBlockInheritedEnvironmentKey('SERVICE_PASSWORD'), true);
assert.equal(shouldBlockInheritedEnvironmentKey('NODE_OPTIONS'), true);
assert.equal(shouldBlockInheritedEnvironmentKey('PATH'), false);
assert.equal(shouldBlockInheritedEnvironmentKey('HTTP_PROXY'), false);
assert.equal(shouldBlockInheritedEnvironmentKey('NPM_CONFIG_CACHE'), false);

const hostEnv = {
  DESKTOP_PET_MCP_SERVERS_JSON: '{"secret":"hidden"}',
  GITHUB_TOKEN: 'host-token',
  NODE_OPTIONS: '--require host-hook.cjs',
  PATH: 'host-path',
  TEMP: 'host-temp',
};
const childEnv = createMcpChildEnvironment({
  GITHUB_TOKEN: 'explicit-server-token',
  SERVER_MODE: 'read-only',
}, hostEnv);
assert.equal(Object.getPrototypeOf(childEnv), null);
assert.deepEqual({ ...childEnv }, {
  GITHUB_TOKEN: 'explicit-server-token',
  PATH: 'host-path',
  SERVER_MODE: 'read-only',
  TEMP: 'host-temp',
});
assert.equal(hostEnv.GITHUB_TOKEN, 'host-token');
assert.equal(JSON.stringify(childEnv).includes('hidden'), false);

console.log('agent MCP child environment smoke passed');
