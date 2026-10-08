function buildRendererQuery(query, {
  localTestDebugModelPath, localTestDesktopModelPath, localTestDebugModelScale,
  localTestDesktopModelScale, localTestDebugFocusX, localTestDebugFocusY,
  localTestMenuPausePetId, localTestMenuPauseOpenDelayMs, localTestMenuPauseWaitForMovementMs,
  localTestMenuPauseObserveMs, localTestMenuPauseThresholdPx, localTestDragPrimaryPetId,
  localTestPrimarySnapBackPetId, localTestDragCompanionPetId, localTestDragStartDelayMs,
  localTestDragWaitForMovementMs, localTestDragObserveMs, localTestDragSampleIntervalMs,
  localTestDragDeltaX, localTestDragDeltaY, localTestDragStepThresholdPx,
  pointerDiagnosticsEnabled, forceFullShapeOnDragEnabled, live2DDragProbeEnabled,
}) {
  const encodedDebugModelPath = localTestDebugModelPath
      ? Buffer.from(localTestDebugModelPath, 'utf8').toString('base64')
      : '';
  const encodedDesktopModelPath = localTestDesktopModelPath
      ? Buffer.from(localTestDesktopModelPath, 'utf8').toString('base64')
      : '';
  const nextQuery = {
      ...query,
      ...(encodedDebugModelPath ? { debugModelPathBase64: encodedDebugModelPath } : {}),
      ...(encodedDesktopModelPath ? { desktopDebugModelPathBase64: encodedDesktopModelPath } : {}),
      ...(localTestDebugModelScale ? { debugModelScale: localTestDebugModelScale } : {}),
      ...(localTestDesktopModelScale ? { desktopDebugModelScale: localTestDesktopModelScale } : {}),
      ...(localTestDebugFocusX ? { debugFocusX: localTestDebugFocusX } : {}),
      ...(localTestDebugFocusY ? { debugFocusY: localTestDebugFocusY } : {}),
      ...(localTestMenuPausePetId ? { localTestMenuPausePetId } : {}),
      ...(localTestMenuPauseOpenDelayMs ? { localTestMenuPauseOpenDelayMs } : {}),
      ...(localTestMenuPauseWaitForMovementMs ? { localTestMenuPauseWaitForMovementMs } : {}),
      ...(localTestMenuPauseObserveMs ? { localTestMenuPauseObserveMs } : {}),
      ...(localTestMenuPauseThresholdPx ? { localTestMenuPauseThresholdPx } : {}),
      ...(localTestDragPrimaryPetId ? { localTestDragPrimaryPetId } : {}),
      ...(localTestPrimarySnapBackPetId ? { localTestPrimarySnapBackPetId } : {}),
      ...(localTestDragCompanionPetId ? { localTestDragCompanionPetId } : {}),
      ...(localTestDragStartDelayMs ? { localTestDragStartDelayMs } : {}),
      ...(localTestDragWaitForMovementMs ? { localTestDragWaitForMovementMs } : {}),
      ...(localTestDragObserveMs ? { localTestDragObserveMs } : {}),
      ...(localTestDragSampleIntervalMs ? { localTestDragSampleIntervalMs } : {}),
      ...(localTestDragDeltaX ? { localTestDragDeltaX } : {}),
      ...(localTestDragDeltaY ? { localTestDragDeltaY } : {}),
      ...(localTestDragStepThresholdPx ? { localTestDragStepThresholdPx } : {}),
      ...(pointerDiagnosticsEnabled ? { pointerDiagnostics: '1' } : {}),
      ...(forceFullShapeOnDragEnabled ? { forceFullShapeOnDrag: '1' } : {}),
      ...(live2DDragProbeEnabled ? { live2dDragProbe: '1' } : {}),
    };
  return nextQuery;
}

module.exports = { buildRendererQuery };
