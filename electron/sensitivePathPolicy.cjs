const fs = require('fs');
const path = require('path');

// Paths that hold credentials, private keys or browser/OS secret stores. Agent file tools
// may not read, copy, move or write them, whatever the model asks for.
const SENSITIVE_DIRECTORY_SEGMENTS = [
  ['.ssh'],
  ['.aws'],
  ['.azure'],
  ['.gnupg'],
  ['.kube'],
  ['.docker'],
  ['.config', 'gcloud'],
  ['appdata', 'roaming', 'microsoft', 'credentials'],
  ['appdata', 'local', 'microsoft', 'credentials'],
  ['appdata', 'roaming', 'microsoft', 'protect'],
  ['appdata', 'roaming', 'microsoft', 'crypto'],
  ['appdata', 'local', 'google', 'chrome', 'user data'],
  ['appdata', 'local', 'microsoft', 'edge', 'user data'],
  ['appdata', 'local', 'bravesoftware', 'brave-browser', 'user data'],
  ['appdata', 'roaming', 'mozilla', 'firefox', 'profiles'],
];
const SENSITIVE_FILE_NAMES = new Set([
  '.git-credentials', '.netrc', '_netrc', '.npmrc', '.pypirc', '.pgpass', '.htpasswd',
  'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519', 'authorized_keys', 'known_hosts',
]);
const SENSITIVE_EXTENSIONS = new Set(['.pem', '.key', '.pfx', '.p12', '.ppk', '.kdbx', '.jks', '.keystore']);

function splitSegments(targetPath) {
  return path.resolve(targetPath).toLowerCase().split(/[\\/]+/u).filter(Boolean);
}

function containsSegments(segments, needle) {
  for (let index = 0; index + needle.length <= segments.length; index += 1) {
    if (needle.every((part, offset) => segments[index + offset] === part)) return true;
  }
  return false;
}

function isInside(childPath, parentPath) {
  const relative = path.relative(path.resolve(parentPath).toLowerCase(), path.resolve(childPath).toLowerCase());
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function matchesSensitiveRule(targetPath, extraRoots) {
  const segments = splitSegments(targetPath);
  const name = segments[segments.length - 1] ?? '';
  if (SENSITIVE_DIRECTORY_SEGMENTS.some((needle) => containsSegments(segments, needle))) return true;
  if (SENSITIVE_FILE_NAMES.has(name) || /^id_(?:rsa|dsa|ecdsa|ed25519)/u.test(name)) return true;
  if (name === '.env' || (name.startsWith('.env.') && name !== '.env.example')) return true;
  if (SENSITIVE_EXTENSIONS.has(path.extname(name))) return true;
  return extraRoots.some((root) => root && isInside(targetPath, root));
}

function realPathOrNull(targetPath) {
  try {
    return fs.realpathSync.native(targetPath);
  } catch {
    return null;
  }
}

function createSensitivePathPolicy({ extraRoots = [] } = {}) {
  const roots = extraRoots.filter(Boolean).map((root) => path.resolve(root));
  return {
    // Checks the requested path and, when it exists, where links and junctions point.
    isSensitivePath(targetPath) {
      if (!targetPath || typeof targetPath !== 'string') return false;
      if (matchesSensitiveRule(targetPath, roots)) return true;
      const realPath = realPathOrNull(targetPath) ?? realPathOrNull(path.dirname(targetPath));
      return Boolean(realPath && matchesSensitiveRule(realPath, roots));
    },
  };
}

const SENSITIVE_PATH_ERROR = 'This path holds credentials, keys or private app data and is not available to agent file tools.';

module.exports = {
  SENSITIVE_PATH_ERROR,
  createSensitivePathPolicy,
};
