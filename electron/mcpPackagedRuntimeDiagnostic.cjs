const fs = require('fs');
const path = require('path');

function getBootMarkerPath(env = process.env) {
  return typeof env.DESKTOP_PET_MCP_PACKAGED_BOOT_MARKER_PATH === 'string'
    ? env.DESKTOP_PET_MCP_PACKAGED_BOOT_MARKER_PATH.trim()
    : '';
}

function writePackagedMcpBootMarker(options = {}) {
  const markerPath = getBootMarkerPath(options.env);
  if (!markerPath) {
    return { written: false };
  }

  const payload = {
    appIsPackaged: Boolean(options.appIsPackaged),
    headlessProbeRequested: Boolean(options.headlessProbeRequested),
    isDev: Boolean(options.isDev),
    isLocalTest: Boolean(options.isLocalTest),
    kind: 'mcp-packaged-runtime-boot-marker.v1',
    pid: process.pid,
    timestamp: new Date().toISOString(),
  };
  const resolvedPath = path.resolve(markerPath);
  try {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.writeFileSync(resolvedPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return { path: resolvedPath, written: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), path: resolvedPath, written: false };
  }
}

module.exports = { getBootMarkerPath, writePackagedMcpBootMarker };
