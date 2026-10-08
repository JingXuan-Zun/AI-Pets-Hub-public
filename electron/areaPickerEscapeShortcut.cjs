function registerAreaPickerEscapeShortcut(state, dependencies) {
    if (state.registered) {
      return;
    }

    try {
      state.registered = dependencies.globalShortcut.register(
        dependencies.accelerator,
        () => {
          if (dependencies.getPendingResolver()) {
            dependencies.resolveAreaPickerSelection(null);
          }
        },
      );
    } catch (_error) {
      state.registered = false;
    }
  }

function unregisterAreaPickerEscapeShortcut(state, dependencies) {
    if (!state.registered) {
      return;
    }

    try {
      dependencies.globalShortcut.unregister(dependencies.accelerator);
    } catch (_error) {
      // Ignore unregister failures when the shortcut is already gone.
    }

    state.registered = false;
  }

function createAreaPickerEscapeShortcut(dependencies) {
  const state = { registered: false };
  return {
    registerAreaPickerEscapeShortcut: () => registerAreaPickerEscapeShortcut(state, dependencies),
    unregisterAreaPickerEscapeShortcut: () => unregisterAreaPickerEscapeShortcut(state, dependencies),
  };
}

module.exports = { createAreaPickerEscapeShortcut };
