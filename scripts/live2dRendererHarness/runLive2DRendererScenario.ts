import { register } from 'node:module';
import { createElement, type ComponentType } from 'react';
import { createNullRoot } from '../nullReactRenderer.ts';
import {
  advanceFakeClock,
  fakeClearTimeout,
  fakeSetTimeout,
  harnessState,
  record,
  resetHarnessState,
} from './traceStore.ts';

// Renders the real PetLive2DRenderer (or a copy of an earlier revision) with
// recording fakes for Pixi, the Cubism runtime, runtime controllers and logs,
// then drives props, timers, ticker errors, model swaps and unmount.
register('./loader.mjs', import.meta.url);

export interface Live2DRendererScenarioConfig {
  probe: boolean;
}

const BINDINGS = [{ id: 'idle-1', kind: 'motion', format: 'motion3', motionKey: 'idle' }];
const MANUAL_MOTION = { id: 'manual-motion', kind: 'motion', format: 'motion3', motionKey: 'tap' };
const MANUAL_EXPRESSION = { id: 'manual-expression', kind: 'expression', format: 'exp3', motionKey: 'smile' };

function installFakeWindow(config: Live2DRendererScenarioConfig) {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousDateNow = Date.now;
  (globalThis as { window?: unknown }).window = {
    clearTimeout: fakeClearTimeout,
    getComputedStyle: () => ({ opacity: '1', visibility: 'visible', zIndex: '3' }),
    localStorage: null,
    location: { search: config.probe ? '?live2dDragProbe=1' : '' },
    performance: { now: () => harnessState.now },
    sessionStorage: null,
    setTimeout: fakeSetTimeout,
  };
  Date.now = () => harnessState.now;
  return () => {
    (globalThis as { window?: unknown }).window = previousWindow;
    Date.now = previousDateNow;
  };
}

function snapshotHost(container: { children: Array<{ props: Record<string, unknown>; dataset: Record<string, string> }> }) {
  const host = container.children[0];
  if (!host) return record('host none');
  const { ref: _ref, ...props } = host.props;
  record('host', props, host.dataset);
}

export async function runLive2DRendererScenario(
  Component: ComponentType<Record<string, unknown>>,
  config: Live2DRendererScenarioConfig,
) {
  resetHarnessState();
  const restoreWindow = installFakeWindow(config);
  const root = createNullRoot((error) => record('react-error', error instanceof Error ? error.message : String(error)));
  let props: Record<string, unknown> = {
    action: 'idle', debugPetId: 'pet-a', isMoving: false, modelUrl: 'models/a.model3.json',
    motionBindings: BINDINGS, onRuntimeEvent: (event: unknown) => record('runtimeEvent', event),
    onVisualBoundsChange: (bounds: unknown) => record('visualBounds', bounds), pointerLookTarget: null, scale: 1,
    viewport: { height: 300, width: 300, x: 0, y: 0 }, visible: true,
  };
  const step = async (label: string, patch: Record<string, unknown> = {}, advanceMs = 0) => {
    record(`== ${label}`);
    props = { ...props, ...patch };
    await root.render(createElement(Component, props));
    if (advanceMs) {
      advanceFakeClock(advanceMs);
      await root.flush();
    }
    snapshotHost(root.container as never);
  };
  try {
    await step('mount');
    await step('presentation probes', {}, 650);
    await step('upper-right pointer', { pointerLookTarget: { x: 400, y: 50 } });
    await step('lower-left pointer', { pointerLookTarget: { x: -100, y: 200 } });
    await step('scale change', { scale: 1.25 }, 100);
    await step('pointer during scale settle', { pointerLookTarget: { x: 10, y: 10 } }, 400);
    await step('drag start', { isDragging: true, isMoving: true });
    await step('drag end', { isDragging: false });
    await step('drag settle', {}, 1000);
    await step('focus target', { focusTarget: { x: 5, y: 6 } });
    await step('clear focus', { focusTarget: null, isMoving: false });
    await step('hover and speech', { hoverState: { activeRegion: 'head' }, isSpeaking: true, isTyping: true, latestMessage: 'hello' });
    await step('runtime profile hot update', { live2dRuntimeProfile: { complex: true } });
    await step('viewport resize', { viewport: { height: 500, width: 600, x: 2, y: 3 } });
    await step('manual bindings', { expressionAction: 'smile', manualExpressionBinding: MANUAL_EXPRESSION, manualMotionBinding: MANUAL_MOTION });
    await step('manual expression as motion', { manualExpressionBinding: null, manualMotionBinding: MANUAL_EXPRESSION });
    await step('hidden', { visible: false });
    record('== ticker errors');
    harnessState.tickerErrorHandlers.forEach((handler, index) => handler(new Error(`tick ${index}`), index + 1));
    await step('model without bounds', { modelUrl: 'models/b-no-bounds.model3.json', visible: true }, 700);
    harnessState.failingModelUrls.add('models/fail.model3.json');
    await step('failing model', { modelUrl: 'models/fail.model3.json' }, 700);
    await step('controller failures', { modelUrl: 'models/pointerLook-fail-performance-fail-mouth-fail.model3.json' }, 700);
    await step('focus fallback', { modelUrl: 'models/pointerLook-fail-focus-fail.model3.json' });
    await step('focus fallback pointer', { pointerLookTarget: { x: 30, y: -40 } });
    await step('empty model url', { modelUrl: '' });
    record('== unmount');
    await root.unmount();
    advanceFakeClock(2_000);
    await root.flush();
  } finally {
    restoreWindow();
  }
  return [...harnessState.trace];
}
