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

    applyChatWindowSizeConstraints(getChatWindow());
    const currentBounds = getChatWindow().getBounds();
    const limits = getResolvedChatPanelWindowLimits();
    const isBelowNormalMinimum = !isInteractive && (
      currentBounds.width < limits.minWidth || currentBounds.height < limits.minHeight
    );
    if ((getWasInteractive() && !isInteractive) || isBelowNormalMinimum) {
      getChatWindow().setBounds(getResolvedChatPanelWindowBounds(), false);
    }
    setWasInteractive(isInteractive);
    if (!isInteractive) {
      return;
    }

    const nextBounds = getResolvedChatPanelWindowBounds(currentBounds);
    if (
      currentBounds.x === nextBounds.x
      && currentBounds.y === nextBounds.y
      && currentBounds.width === nextBounds.width
      && currentBounds.height === nextBounds.height
    ) {
      return;
    }

    getChatWindow().setBounds(nextBounds, false);
  };
}

module.exports = { createChatWindowSizeConstraints, createInteractiveChatWindowBoundsSync };
