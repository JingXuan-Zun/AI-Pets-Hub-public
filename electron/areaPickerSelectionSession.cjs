const { getAreaPickerContextSignature } = require('./areaPickerGeometry.cjs');

function resolveAreaPickerSelection(state, dependencies, selection = null) {
  const resolve = state.resolver;

  state.promise = null;
  state.resolver = null;
  dependencies.unregisterAreaPickerEscapeShortcut();

  if (state.window && !state.window.isDestroyed()) {
    state.window.hide();
  }

  if (typeof resolve === 'function') {
    resolve(selection);
  }

  dependencies.scheduleRestore(() => {
    dependencies.restoreAuxWindowStack();
  });
}

async function openAreaPickerWindow(state, dependencies) {
  if (state.promise) {
    if (state.window && !state.window.isDestroyed()) {
      dependencies.broadcastAreaPickerContext();
      dependencies.showAreaPickerWindow();
    }

    return state.promise;
  }

  if (!state.context?.displays?.length) {
    const context = await dependencies.captureService.buildAreaPickerContext();
    if (!context.displays.length) {
      return null;
    }

    state.context = context;
    state.contextSignature = getAreaPickerContextSignature(context);
  }

  dependencies.registerAreaPickerEscapeShortcut();
  state.promise = new Promise((resolve) => {
    state.resolver = resolve;
  });

  const nextAreaPickerWindow = dependencies.ensureAreaPickerWindow();
  if (!nextAreaPickerWindow) {
    resolveAreaPickerSelection(state, dependencies, null);
    return null;
  }

  dependencies.broadcastAreaPickerContext();
  if (!nextAreaPickerWindow.webContents.isLoadingMainFrame()) {
    dependencies.showAreaPickerWindow();
  }

  return state.promise;
}

function createAreaPickerSelectionSession(dependencies) {
  const state = {
    window: null,
    promise: null,
    resolver: null,
    context: null,
    contextSignature: '',
    rendererSignature: '',
  };
  return {
    state,
    resolveAreaPickerSelection: (selection) => resolveAreaPickerSelection(state, dependencies, selection),
    openAreaPickerWindow: () => openAreaPickerWindow(state, dependencies),
  };
}

module.exports = { createAreaPickerSelectionSession };
