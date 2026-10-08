function createSettingsWindowControls({
  getSettingsWindow, ensureSettingsWindowReady, showSettingsWindow, reportOpenSettingsError,
}) {
  function closeSettingsWindow() {
    if (getSettingsWindow() && !getSettingsWindow().isDestroyed()) {
      getSettingsWindow().hide();
    }
  }

  async function openSettingsWindow() {
    try {
      const nextSettingsWindow = await ensureSettingsWindowReady();
      if (!nextSettingsWindow || nextSettingsWindow.isDestroyed()) {
        return;
      }

      showSettingsWindow();
    } catch (error) {
      reportOpenSettingsError(error);
    }
  }

  return { closeSettingsWindow, openSettingsWindow };
}

function createChatWindowControls({
  getChatWindow, setChatWindow, presentReusedChatWindow,
  getChatPanelWindowBounds, getResolvedChatPanelWindowLimits,
  BrowserWindow, buildChatWindowOptions, attachLoadLogging,
  scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, attachChatWindowEvents, loadRenderer,
}) {
  function closeChatWindow() {
    if (getChatWindow() && !getChatWindow().isDestroyed()) {
      getChatWindow().hide();
    }
  }

  function openChatWindow() {
    if (getChatWindow() && !getChatWindow().isDestroyed()) {
      presentReusedChatWindow();
      return;
    }

    const initialBounds = getChatPanelWindowBounds();
    const initialLimits = getResolvedChatPanelWindowLimits();
    setChatWindow(new BrowserWindow(buildChatWindowOptions(initialBounds, initialLimits)));
    attachLoadLogging(getChatWindow(), 'chat-window');

    scheduleKeepWindowOnTop(getChatWindow(), AUX_TOPMOST_RELATIVE_LEVEL);

    attachChatWindowEvents();

    loadRenderer(getChatWindow(), { desktop: '1', panel: 'chat' });
  }

  return { closeChatWindow, openChatWindow };
}

module.exports = { createSettingsWindowControls, createChatWindowControls };
