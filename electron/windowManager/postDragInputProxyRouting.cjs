const { createInputProxyRegionRouting } = require('./inputProxyRegionRouting.cjs');
const { createInputProxyEventForwarder } = require('./inputProxyEventForwarding.cjs');

function createPostDragInputProxyRouting(dependencies) {
  const regionRouting = createInputProxyRegionRouting(dependencies);
  const forwardPostDragInputProxyEvent = createInputProxyEventForwarder({ ...dependencies, ...regionRouting });
  return { ...regionRouting, forwardPostDragInputProxyEvent };
}

module.exports = { createPostDragInputProxyRouting };
