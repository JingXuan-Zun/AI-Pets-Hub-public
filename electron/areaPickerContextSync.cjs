function syncAreaPickerWindowBounds(state) {
  if (
    !state.window
    || state.window.isDestroyed()
    || !state.context
    || !state.context.virtualBounds
  ) {
    return;
  }

  const nextBounds = state.context.virtualBounds;
  const currentBounds = state.window.getBounds();
  if (
    currentBounds.x !== nextBounds.x
    || currentBounds.y !== nextBounds.y
    || currentBounds.width !== nextBounds.width
    || currentBounds.height !== nextBounds.height
  ) {
    state.window.setBounds(nextBounds);
  }
}

function broadcastAreaPickerContext(state) {
  if (
    !state.window
    || state.window.isDestroyed()
    || !state.context
    || state.window.webContents.isLoadingMainFrame()
  ) {
    return;
  }

  if (state.rendererSignature === state.contextSignature) {
    return;
  }

  state.window.webContents.send('desktop-pet:area-picker-context', state.context);
  state.rendererSignature = state.contextSignature;
}

function showAreaPickerWindow(state, dependencies) {
  if (!state.window || state.window.isDestroyed()) {
    return;
  }

  syncAreaPickerWindowBounds(state);
  dependencies.reduceAuxWindowTopmostForAreaPicker();
  state.window.show();
  state.window.focus();
  dependencies.windowManager.keepWindowOnTop(state.window, dependencies.topmostRelativeLevel, {
    bringToFront: true,
    topmostLevel: dependencies.topmostLevel,
  });
}

function createAreaPickerContextSync(dependencies) {
  const { state } = dependencies;
  return {
    syncAreaPickerWindowBounds: () => syncAreaPickerWindowBounds(state),
    broadcastAreaPickerContext: () => broadcastAreaPickerContext(state),
    showAreaPickerWindow: () => showAreaPickerWindow(state, dependencies),
  };
}

module.exports = { createAreaPickerContextSync };
