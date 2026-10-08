const { createChatWindowOptionsBuilder } = require('./chatWindowOptions.cjs');
const { createChatWindowSizeConstraints, createInteractiveChatWindowBoundsSync } = require('./chatWindowBoundsSync.cjs');
const { createChatWindowReusePresenter } = require('./chatWindowPresentation.cjs');
const { createChatWindowEventRegistrar } = require('./chatWindowEvents.cjs');
const { createChatWindowControls } = require('./auxiliaryWindowControls.cjs');

function createChatWindowControllers({
  getBrowserWindowIconOptions, path, baseDirectory, sessionPartition,
  isCurrentWindowCompactMinimumSizeActive, getResolvedChatPanelWindowLimits,
  getChatWindow, getWasInteractive, setWasInteractive, isInteractiveDialogueChatActive,
  getResolvedChatPanelWindowBounds, scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL,
  scheduleWindowStackOnTop, notifyChatWindowState, broadcastSharedState,
  getIsQuitting, clearChatWindow, openExternalSafely, shell, setChatWindow,
  getChatPanelWindowBounds, BrowserWindow, attachLoadLogging, loadRenderer,
}) {
  const buildChatWindowOptions = createChatWindowOptionsBuilder({
    getBrowserWindowIconOptions, path, baseDirectory, sessionPartition,
  });
  const applyChatWindowSizeConstraints = createChatWindowSizeConstraints({
    isCurrentWindowCompactMinimumSizeActive, getResolvedChatPanelWindowLimits,
  });
  const syncInteractiveChatWindowBounds = createInteractiveChatWindowBoundsSync({
    getChatWindow, getWasInteractive, setWasInteractive,
    isInteractiveDialogueChatActive, isCurrentWindowCompactMinimumSizeActive, applyChatWindowSizeConstraints,
    getResolvedChatPanelWindowLimits, getResolvedChatPanelWindowBounds,
  });
  const presentReusedChatWindow = createChatWindowReusePresenter({
    getChatWindow, applyChatWindowSizeConstraints, getResolvedChatPanelWindowBounds,
    scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,
    notifyChatWindowState, broadcastSharedState,
  });
  const attachChatWindowEvents = createChatWindowEventRegistrar({
    getChatWindow, getIsQuitting, clearChatWindow,
    applyChatWindowSizeConstraints, getResolvedChatPanelWindowBounds,
    scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,
    openExternalSafely, shell, broadcastSharedState,
    notifyChatWindowState, syncInteractiveChatWindowBounds,
  });
  const { closeChatWindow, openChatWindow } = createChatWindowControls({
    getChatWindow, setChatWindow,
    presentReusedChatWindow, getChatPanelWindowBounds, getResolvedChatPanelWindowLimits,
    BrowserWindow, buildChatWindowOptions, attachLoadLogging,
    scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, attachChatWindowEvents, loadRenderer,
  });
  return { closeChatWindow, openChatWindow, syncInteractiveChatWindowBounds };
}

function createChatWindowOwnershipControllers({
  windowOwnershipState, getBrowserWindowIconOptions, path, baseDirectory,
  sessionPartition, isCurrentWindowCompactMinimumSizeActive, getResolvedChatPanelWindowLimits, isInteractiveDialogueChatActive,
  getResolvedChatPanelWindowBounds, scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,
  notifyChatWindowState, broadcastSharedState, openExternalSafely, shell,
  getChatPanelWindowBounds, BrowserWindow, attachLoadLogging, loadRenderer,
}) {
  return createChatWindowControllers({
    getBrowserWindowIconOptions, path, baseDirectory,
    sessionPartition, isCurrentWindowCompactMinimumSizeActive, getResolvedChatPanelWindowLimits,
    ...windowOwnershipState.chatOwnership, isInteractiveDialogueChatActive, getResolvedChatPanelWindowBounds,
    scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,
    notifyChatWindowState, broadcastSharedState, ...windowOwnershipState.chatClosing,
    openExternalSafely, shell, getChatPanelWindowBounds,
    BrowserWindow, attachLoadLogging, loadRenderer,
  });
}

module.exports = { createChatWindowControllers, createChatWindowOwnershipControllers };
