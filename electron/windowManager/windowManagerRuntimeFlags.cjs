const LOCAL_TEST_QUERY_ENV_KEYS = [
  ['localTestDebugModelPath', 'DESKTOP_PET_LOCAL_TEST_DEBUG_MODEL_PATH'],
  ['localTestDesktopModelPath', 'DESKTOP_PET_LOCAL_TEST_DESKTOP_MODEL_PATH'],
  ['localTestDebugModelScale', 'DESKTOP_PET_LOCAL_TEST_DEBUG_MODEL_SCALE'],
  ['localTestDesktopModelScale', 'DESKTOP_PET_LOCAL_TEST_DESKTOP_MODEL_SCALE'],
  ['localTestDebugFocusX', 'DESKTOP_PET_LOCAL_TEST_DEBUG_FOCUS_X'],
  ['localTestDebugFocusY', 'DESKTOP_PET_LOCAL_TEST_DEBUG_FOCUS_Y'],
  ['localTestMenuPausePetId', 'DESKTOP_PET_LOCAL_TEST_MENU_PAUSE_PET_ID'],
  ['localTestMenuPauseOpenDelayMs', 'DESKTOP_PET_LOCAL_TEST_MENU_PAUSE_OPEN_DELAY_MS'],
  ['localTestMenuPauseWaitForMovementMs', 'DESKTOP_PET_LOCAL_TEST_MENU_PAUSE_WAIT_FOR_MOVEMENT_MS'],
  ['localTestMenuPauseObserveMs', 'DESKTOP_PET_LOCAL_TEST_MENU_PAUSE_OBSERVE_MS'],
  ['localTestMenuPauseThresholdPx', 'DESKTOP_PET_LOCAL_TEST_MENU_PAUSE_THRESHOLD_PX'],
  ['localTestDragPrimaryPetId', 'DESKTOP_PET_LOCAL_TEST_DRAG_PRIMARY_PET_ID'],
  ['localTestPrimarySnapBackPetId', 'DESKTOP_PET_LOCAL_TEST_PRIMARY_SNAPBACK_PET_ID'],
  ['localTestDragCompanionPetId', 'DESKTOP_PET_LOCAL_TEST_DRAG_COMPANION_PET_ID'],
  ['localTestDragStartDelayMs', 'DESKTOP_PET_LOCAL_TEST_DRAG_START_DELAY_MS'],
  ['localTestDragWaitForMovementMs', 'DESKTOP_PET_LOCAL_TEST_DRAG_WAIT_FOR_MOVEMENT_MS'],
  ['localTestDragObserveMs', 'DESKTOP_PET_LOCAL_TEST_DRAG_OBSERVE_MS'],
  ['localTestDragSampleIntervalMs', 'DESKTOP_PET_LOCAL_TEST_DRAG_SAMPLE_INTERVAL_MS'],
  ['localTestDragDeltaX', 'DESKTOP_PET_LOCAL_TEST_DRAG_DELTA_X'],
  ['localTestDragDeltaY', 'DESKTOP_PET_LOCAL_TEST_DRAG_DELTA_Y'],
  ['localTestDragStepThresholdPx', 'DESKTOP_PET_LOCAL_TEST_DRAG_STEP_THRESHOLD_PX'],
];

// The window manager passes its own process object so callers that load it in
// an isolated context keep the same platform and environment view.
function resolveLocalTestQueryValues(process) {
  return Object.fromEntries(LOCAL_TEST_QUERY_ENV_KEYS.map(([name, envKey]) => [
    name,
    process.env.DESKTOP_PET_LOCAL_TEST === '1'
      ? (process.env[envKey] || '').trim()
      : '',
  ]));
}

function resolveWindowManagerRuntimeFlags(process) {
  const USE_SEPARATE_RENDER_AND_INPUT_WINDOWS = process.platform === 'win32';
  const PREWARM_MAIN_INTERACTIVE_LAYER = process.env.DESKTOP_PET_PREWARM_INTERACTIVE_LAYER !== '0';
  const HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS = (
    process.env.DESKTOP_PET_HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS === '1'
  );
  const DISABLE_SETTINGS_TOPMOST_FOR_GRAPH_DIAGNOSTICS = (
    process.env.DESKTOP_PET_DISABLE_SETTINGS_TOPMOST_FOR_GRAPH_DIAGNOSTICS === '1'
  );
  const localTestQueryValues = resolveLocalTestQueryValues(process);
  const dragDiagnosticsEnabled = process.env.DESKTOP_PET_DRAG_DIAGNOSTICS === '1';
  const pointerDiagnosticsEnabled = process.env.DESKTOP_PET_POINTER_DIAGNOSTICS === '1'
    || dragDiagnosticsEnabled;
  const forceFullShapeOnDragEnabled = process.env.DESKTOP_PET_FORCE_FULL_SHAPE_ON_DRAG === '1';
  const live2DDragProbeEnabled = process.env.DESKTOP_PET_LIVE2D_DRAG_PROBE === '1'
    || process.argv.includes('--live2d-drag-probe');
  return {
    USE_SEPARATE_RENDER_AND_INPUT_WINDOWS,
    PREWARM_MAIN_INTERACTIVE_LAYER,
    HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS,
    DISABLE_SETTINGS_TOPMOST_FOR_GRAPH_DIAGNOSTICS,
    localTestQueryValues,
    pointerDiagnosticsEnabled,
    forceFullShapeOnDragEnabled,
    live2DDragProbeEnabled,
  };
}

module.exports = { resolveWindowManagerRuntimeFlags };
