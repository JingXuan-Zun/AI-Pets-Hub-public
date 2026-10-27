function createChatWindowSizeConstraints({
  isCurrentWindowCompactMinimumSizeActive, getResolvedChatPanelWindowLimits,
}) {
  return function applyChatWindowSizeConstraints(win) {
    if (!win || win.isDestroyed()) {
      return;
    }

    if (isCurrentWindowCompactMinimumSizeActive(win)) {
      return;
    }

    const limits = getResolvedChatPanelWindowLimits();
    win.setMinimumSize(limits.minWidth, limits.minHeight);
    win.setMaximumSize(limits.maxWidth, limits.maxHeight);
  };
}

function createInteractiveChatWindowBoundsSync({
  getChatWindow, getWasInteractive, setWasInteractive, isInteractiveDialogueChatActive,
  isCurrentWindowCompactMinimumSizeActive, applyChatWindowSizeConstraints,
  getResolvedChatPanelWindowLimits, getResolvedChatPanelWindowBounds,
}) {
  return function syncInteractiveChatWindowBounds() {
    const isInteractive = isInteractiveDialogueChatActive();
    if (!getChatWindow() || getChatWindow().isDestroyed()) {
      setWasInteractive(isInteractive);
      return;
    }

    if (isCurrentWindowCompactMinimumSizeActive(getChatWindow())) {
      setWasInteractive(isInteractive);
      return;
    }

    const wasInteractive = getWasInteractive();
    setWasInteractive(isInteractive);
    if (wasInteractive && isInteractive) {
      // 进入时摆好一次，之后窗口随用户拖动、缩放。
      return;
    }

    applyChatWindowSizeConstraints(getChatWindow());
    const currentBounds = getChatWindow().getBounds();
    const limits = getResolvedChatPanelWindowLimits();
    const isBelowNormalMinimum = !isInteractive && (
      currentBounds.width < limits.minWidth || currentBounds.height < limits.minHeight
    );
    if (isInteractive || (wasInteractive && !isInteractive) || isBelowNormalMinimum) {
      getChatWindow().setBounds(getResolvedChatPanelWindowBounds(), false);
    }
  };
}

module.exports = { createChatWindowSizeConstraints, createInteractiveChatWindowBoundsSync };
