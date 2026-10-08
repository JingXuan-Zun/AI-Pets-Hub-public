// Module resolution hook used by the Live2D renderer and pet shell harnesses: native,
// WebGL and logging dependencies resolve to recording fakes while the
// renderer component and its pure helpers stay real.
const fakeDirectory = new URL('./fakes/', import.meta.url);
const redirects = [
  ['/src/components/pet/live2dSharedRenderer.ts', 'live2dSharedRenderer.ts'],
  ['/src/components/pet/live2dModelRuntime.ts', 'live2dModelRuntime.ts'],
  ['/src/components/pet/live2dPointerLookRuntimeController.ts', 'live2dControllers.ts'],
  ['/src/components/pet/live2dPerformanceRuntimeController.ts', 'live2dControllers.ts'],
  ['/src/components/pet/live2dMouthRuntimeController.ts', 'live2dControllers.ts'],
  ['/src/components/pet/live2dComplexPhysicsWarmup.ts', 'live2dSupport.ts'],
  ['/src/components/pet/useLive2DRuntimeHeartbeatProbe.ts', 'live2dSupport.ts'],
  ['/src/components/pet/useLive2DMotionExpressionSync.ts', 'live2dSupport.ts'],
  ['/src/pet-runtime/live2d/live2dDisplayInfoParameters.ts', 'live2dSupport.ts'],
  ['/src/frontendRuntimeLogger.ts', 'frontendRuntimeLogger.ts'],
  ['/src/desktopShellRuntime.ts', 'desktopShellRuntime.ts'],
];

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'pixi.js') {
    return { url: new URL('pixi.ts', fakeDirectory).href, shortCircuit: true };
  }
  const resolved = await nextResolve(specifier, context);
  const normalized = decodeURIComponent(resolved.url).replaceAll('\\', '/');
  const match = redirects.find(([suffix]) => normalized.endsWith(suffix));
  return match ? { ...resolved, url: new URL(match[1], fakeDirectory).href } : resolved;
}
