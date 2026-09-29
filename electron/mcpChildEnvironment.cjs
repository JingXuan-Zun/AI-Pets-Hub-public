const BLOCKED_HOST_ENVIRONMENT_KEYS = new Set(['NODE_OPTIONS', 'NODE_PATH']);
const SENSITIVE_HOST_ENVIRONMENT_KEY = /(?:^|_)(?:ACCESS_?KEY|API_?KEY|AUTH|CREDENTIALS?|PASSWORD|PASSWD|PRIVATE_?KEY|SECRET|TOKEN)(?:_|$)/iu;

function shouldBlockInheritedEnvironmentKey(key) {
  const normalizedKey = String(key || '').trim().toUpperCase();
  return normalizedKey.startsWith('DESKTOP_PET_')
    || BLOCKED_HOST_ENVIRONMENT_KEYS.has(normalizedKey)
    || SENSITIVE_HOST_ENVIRONMENT_KEY.test(normalizedKey);
}

function createMcpChildEnvironment(serverEnv = {}, hostEnv = process.env) {
  const childEnv = Object.create(null);
  for (const [key, value] of Object.entries(hostEnv || {})) {
    if (!shouldBlockInheritedEnvironmentKey(key) && value !== undefined) childEnv[key] = value;
  }
  for (const [key, value] of Object.entries(serverEnv || {})) {
    if (value !== undefined) childEnv[key] = value;
  }
  return childEnv;
}

module.exports = {
  createMcpChildEnvironment,
  shouldBlockInheritedEnvironmentKey,
};
