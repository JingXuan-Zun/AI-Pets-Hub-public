function resolveInteractiveChatPanelPosition(workArea, width, height, INTERACTIVE_CHAT_PANEL_CENTER_Y_RATIO) {
  const centeredX = workArea.x + (workArea.width - width) / 2;
  const centeredY = workArea.y + workArea.height * INTERACTIVE_CHAT_PANEL_CENTER_Y_RATIO - height / 2;

  return {
    x: Math.round(Math.max(
      workArea.x,
      Math.min(workArea.x + workArea.width - width, centeredX),
    )),
    y: Math.round(Math.max(
      workArea.y,
      Math.min(workArea.y + workArea.height - height, centeredY),
    )),
    width,
    height,
  };
}

function createChatPanelLimitsResolver({ captureService, isInteractiveDialogueChatActive, getResolvedInteractiveDialogueDisplay, getActiveChatPanelWindowBoundsPreset }) {
  function getResolvedChatPanelWindowLimits() {
    const display = isInteractiveDialogueChatActive()
      ? getResolvedInteractiveDialogueDisplay()
      : captureService.getTargetDisplay();
    const workArea = display.workArea || display.bounds;
    const preset = getActiveChatPanelWindowBoundsPreset();
    const minWidth = Math.min(preset.minWidth, workArea.width);
    const minHeight = Math.min(preset.minHeight, workArea.height);

    return {
      display,
      maxHeight: Math.max(minHeight, Math.min(preset.maxHeight, workArea.height)),
      maxWidth: Math.max(minWidth, Math.min(preset.maxWidth, workArea.width)),
      minHeight,
      minWidth,
      workArea,
    };
  }
  return getResolvedChatPanelWindowLimits;
}

function createChatPanelBoundsResolver({ getResolvedChatPanelWindowLimits, getActiveChatPanelWindowBoundsPreset, isInteractiveDialogueChatActive, INTERACTIVE_CHAT_PANEL_CENTER_Y_RATIO }) {
  function getResolvedChatPanelWindowBounds(currentBounds = null) {
    const limits = getResolvedChatPanelWindowLimits();
    const { workArea } = limits;
    const preset = getActiveChatPanelWindowBoundsPreset();
    const requestedWidth = currentBounds?.width ?? preset.width;
    const requestedHeight = currentBounds?.height ?? preset.height;
    const width = Math.min(
      limits.maxWidth,
      Math.max(limits.minWidth, Math.round(requestedWidth)),
    );
    const height = Math.min(
      limits.maxHeight,
      Math.max(limits.minHeight, Math.round(requestedHeight)),
    );

    if (isInteractiveDialogueChatActive()) {
      return resolveInteractiveChatPanelPosition(workArea, width, height, INTERACTIVE_CHAT_PANEL_CENTER_Y_RATIO);
    }

    const x = Math.round(workArea.x + (workArea.width - width) / 2);
    const y = Math.round(workArea.y + (workArea.height - height) / 2);

    return {
      x,
      y,
      width,
      height,
    };
  }

  function getChatPanelWindowBounds() {
    return getResolvedChatPanelWindowBounds();
  }
  return { getResolvedChatPanelWindowBounds, getChatPanelWindowBounds };
}

function createChatPanelBounds(dependencies) {
  const getResolvedChatPanelWindowLimits = createChatPanelLimitsResolver(dependencies);
  const bounds = createChatPanelBoundsResolver({ ...dependencies, getResolvedChatPanelWindowLimits });
  return { getResolvedChatPanelWindowLimits, ...bounds };
}

module.exports = { createChatPanelBounds };
