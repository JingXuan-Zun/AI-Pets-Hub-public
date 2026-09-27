const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  getBootMarkerPath,
  writePackagedMcpBootMarker,
} = require('../electron/mcpPackagedRuntimeDiagnostic.cjs');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-mcp-packaged-marker-'));
const markerPath = path.join(tempRoot, 'nested', 'marker.json');

assert.equal(getBootMarkerPath({}), '');
assert.deepEqual(writePackagedMcpBootMarker({ env: {} }), { written: false });

const result = writePackagedMcpBootMarker({
  appIsPackaged: true,
  env: { DESKTOP_PET_MCP_PACKAGED_BOOT_MARKER_PATH: markerPath },
  headlessProbeRequested: true,
  isDev: false,
  isLocalTest: false,
});
assert.equal(result.written, true);
const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
assert.equal(marker.kind, 'mcp-packaged-runtime-boot-marker.v1');
assert.equal(marker.appIsPackaged, true);
assert.equal(marker.headlessProbeRequested, true);
assert.equal(marker.isDev, false);
assert.equal(marker.isLocalTest, false);

fs.rmSync(tempRoot, { force: true, recursive: true });
console.log('agent MCP packaged runtime diagnostic smoke passed');
