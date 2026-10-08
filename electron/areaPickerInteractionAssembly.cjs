const { createAreaPickerSelectionSession } = require('./areaPickerSelectionSession.cjs');
const { createAreaPickerContextSync } = require('./areaPickerContextSync.cjs');
const { createAreaPickerWindowStack } = require('./areaPickerWindowStack.cjs');
const { createAreaPickerEscapeShortcut } = require('./areaPickerEscapeShortcut.cjs');
const { createAreaPickerWindowController } = require('./areaPickerWindow.cjs');

function createPickerWindowBinding(dependencies, session, shortcut, context) {
  const { BrowserWindow, windowManager, loadRenderer, isQuitting, topmostRelativeLevel, topmostLevel } = dependencies;
  return createAreaPickerWindowController({
    BrowserWindow, windowManager, loadRenderer, isQuitting, topmostRelativeLevel, topmostLevel,
    ...context,
    resolveAreaPickerSelection: session.resolveAreaPickerSelection,
    unregisterAreaPickerEscapeShortcut: shortcut.unregisterAreaPickerEscapeShortcut,
    state: session.state,
  });
}

function createAreaPickerInteractionAssembly(dependencies) {
  const { captureService, windowManager, globalShortcut, scheduleRestore, mainRelativeLevel, auxRelativeLevel, accelerator, topmostRelativeLevel, topmostLevel } = dependencies;
  let bindings;
  const session = createAreaPickerSelectionSession({
    captureService, scheduleRestore,
    registerAreaPickerEscapeShortcut: () => bindings.shortcut.registerAreaPickerEscapeShortcut(),
    unregisterAreaPickerEscapeShortcut: () => bindings.shortcut.unregisterAreaPickerEscapeShortcut(),
    ensureAreaPickerWindow: () => bindings.ensureWindow(),
    broadcastAreaPickerContext: () => bindings.context.broadcastAreaPickerContext(),
    showAreaPickerWindow: () => bindings.context.showAreaPickerWindow(),
    restoreAuxWindowStack: () => bindings.stack.restoreAuxWindowStack(),
  });
  const stack = createAreaPickerWindowStack({ windowManager, mainRelativeLevel, auxRelativeLevel });
  const shortcut = createAreaPickerEscapeShortcut({
    globalShortcut, accelerator,
    getPendingResolver: () => session.state.resolver,
    resolveAreaPickerSelection: session.resolveAreaPickerSelection,
  });
  const context = createAreaPickerContextSync({
    state: session.state, windowManager, topmostRelativeLevel, topmostLevel,
    reduceAuxWindowTopmostForAreaPicker: stack.reduceAuxWindowTopmostForAreaPicker,
  });
  const ensureWindow = createPickerWindowBinding(dependencies, session, shortcut, context);
  bindings = { stack, shortcut, context, ensureWindow };
  return { ...session, unregisterAreaPickerEscapeShortcut: shortcut.unregisterAreaPickerEscapeShortcut };
}

module.exports = { createAreaPickerInteractionAssembly };
