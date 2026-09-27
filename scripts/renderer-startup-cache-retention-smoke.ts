import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainSource = fs.readFileSync('electron/main.cjs', 'utf8');

assert.match(
  mainSource,
  /process\.env\.DESKTOP_PET_ENABLE_TRANSPARENT_OVERLAY_COMPAT === '1'[\s\S]*process\.env\.DESKTOP_PET_DISABLE_TRANSPARENT_OVERLAY_COMPAT !== '1'/u,
  'the expensive Windows transparent-overlay compatibility path must be opt-in',
);
assert.match(
  mainSource,
  /shouldUseWindowsTransparentOverlayCompatibility[\s\S]*DESKTOP_PET_FORCE_DISABLE_GPU_COMPOSITING[\s\S]*appendSwitch\('disable-gpu-compositing'\)/u,
  'the explicit compatibility and diagnostic switches must retain the software-compositing fallback',
);
assert.match(
  mainSource,
  /const shouldClearRendererStartupCodeCache = process\.env\.DESKTOP_PET_CLEAR_RENDERER_CODE_CACHE === '1';/u,
  'renderer code-cache clearing must require an explicit diagnostic environment flag',
);
assert.match(
  mainSource,
  /async function clearRendererStartupCodeCaches\(activeSession\) \{[\s\S]*if \(!shouldClearRendererStartupCodeCache\) \{[\s\S]*return;[\s\S]*activeSession\.clearCodeCaches/u,
  'normal startup must return before Electron clearCodeCaches is called',
);

console.log('renderer startup cache retention smoke ok');
