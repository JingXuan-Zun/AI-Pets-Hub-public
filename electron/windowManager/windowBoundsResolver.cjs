const { createCaptureWindowBounds } = require('./captureWindowBounds.cjs');
const { createChatDisplayPolicy } = require('./chatDisplayPolicy.cjs');
const { createChatPanelBounds } = require('./chatPanelBounds.cjs');

function createWindowBoundsResolver(dependencies) {
  const captureBounds = createCaptureWindowBounds(dependencies);
  const displayPolicy = createChatDisplayPolicy(dependencies);
  const chatBounds = createChatPanelBounds({ ...dependencies, ...displayPolicy });
  return {
    ...captureBounds,
    getChatPanelWindowBounds: chatBounds.getChatPanelWindowBounds,
    ...displayPolicy,
    getResolvedChatPanelWindowLimits: chatBounds.getResolvedChatPanelWindowLimits,
    getResolvedChatPanelWindowBounds: chatBounds.getResolvedChatPanelWindowBounds,
  };
}

module.exports = { createWindowBoundsResolver };
