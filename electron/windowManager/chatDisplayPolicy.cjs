function createDialogueDisplayResolver({ screen, getSharedState }) {
  function resolveDisplayById(displayId) {
    if (displayId !== 'primary') {
      const matchedDisplay = screen.getAllDisplays().find(
        (display) => String(display.id) === String(displayId),
      );
      if (matchedDisplay) {
        return matchedDisplay;
      }
    }

    return screen.getPrimaryDisplay();
  }

  function getResolvedInteractiveDialogueDisplay() {
    const settings = getSharedState()?.config?.settings ?? {};
    const activityDisplayId = typeof settings.activityDisplayId === 'string'
      ? settings.activityDisplayId
      : 'primary';
    const interactiveDialogueDisplayId = typeof settings.interactiveDialogueDisplayId === 'string'
      ? settings.interactiveDialogueDisplayId
      : 'activity';
    const resolvedDisplayId = interactiveDialogueDisplayId === 'activity'
      ? activityDisplayId
      : interactiveDialogueDisplayId;

    return resolveDisplayById(resolvedDisplayId);
  }
  return { resolveDisplayById, getResolvedInteractiveDialogueDisplay };
}

function createChatPanelPresetPolicy({ getSharedState, CHAT_PANEL_WINDOW_BOUNDS, INTERACTIVE_CHAT_PANEL_WINDOW_BOUNDS }) {
  function isInteractiveDialogueChatActive() {
    return Boolean(
      getSharedState()?.interactiveDialogueActive
      && getSharedState()?.chatState?.chatMode === 'single',
    );
  }

  function getActiveChatPanelWindowBoundsPreset() {
    return isInteractiveDialogueChatActive()
      ? INTERACTIVE_CHAT_PANEL_WINDOW_BOUNDS
      : CHAT_PANEL_WINDOW_BOUNDS;
  }
  return { isInteractiveDialogueChatActive, getActiveChatPanelWindowBoundsPreset };
}

function createChatDisplayPolicy(dependencies) {
  const displays = createDialogueDisplayResolver(dependencies);
  const presets = createChatPanelPresetPolicy(dependencies);
  return { ...displays, ...presets };
}

module.exports = { createChatDisplayPolicy };
