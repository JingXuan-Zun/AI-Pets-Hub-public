import { register } from 'node:module';
import { createElement } from 'react';
import { createNullRoot } from '../nullReactRenderer.ts';
import {
  advanceFakeClock,
  fakeCancelAnimationFrame,
  fakeClearInterval,
  fakeClearTimeout,
  fakeRequestAnimationFrame,
  fakeSetInterval,
  fakeSetTimeout,
  flushFakeAnimationFrames,
  harnessState,
  record,
  resetHarnessState,
} from './traceStore.ts';
import {
  createFakeDocumentTree,
  createListenerTarget,
  FakeElement,
  FakeEvent,
  FakeMutationObserver,
  FakeMutationRecord,
} from './fakeDom.ts';
import { shellRuntimeControl } from './fakes/desktopShellRuntime.ts';

// Drives the real usePetContainerShellEffects hook (or an earlier revision)
// against a minimal recorded DOM, controlled timers/frames and a recording
// desktop shell runtime.
register('./loader.mjs', import.meta.url);

export interface PetShellScenarioConfig {
  diagnostics: boolean;
  nativeRegions: boolean;
}

type ShellHook = (options: Record<string, unknown>) => void;

function installFakeEnvironment(config: PetShellScenarioConfig) {
  const tree = createFakeDocumentTree();
  const windowTarget = createListenerTarget('window');
  const documentTarget = createListenerTarget('document');
  const globals = globalThis as Record<string, unknown>;
  const previous = Object.fromEntries(['window', 'document', 'Element', 'Event', 'MutationRecord', 'MutationObserver']
    .map((key) => [key, globals[key]]));
  const previousDateNow = Date.now;
  globals.Element = FakeElement;
  globals.Event = FakeEvent;
  globals.MutationRecord = FakeMutationRecord;
  globals.MutationObserver = FakeMutationObserver;
  globals.document = {
    ...documentTarget,
    body: tree.body,
    elementFromPoint: (x: number, y: number) => tree.elementFromPoint(x, y),
    querySelectorAll: (selector: string) => tree.querySelectorAll(selector),
  };
  globals.window = {
    ...windowTarget,
    cancelAnimationFrame: fakeCancelAnimationFrame,
    clearInterval: fakeClearInterval,
    clearTimeout: fakeClearTimeout,
    innerHeight: 600,
    innerWidth: 800,
    localStorage: null,
    location: { search: config.diagnostics ? '?pointerDiagnostics=1&live2dDragProbe=1' : '' },
    performance: { now: () => harnessState.now },
    requestAnimationFrame: fakeRequestAnimationFrame,
    screenX: 100,
    screenY: 50,
    sessionStorage: null,
    setInterval: fakeSetInterval,
    setTimeout: fakeSetTimeout,
  };
  Date.now = () => harnessState.now;
  FakeMutationObserver.instances = [];
  shellRuntimeControl.cursorPoint = { x: 900, y: 650 };
  shellRuntimeControl.cursorFailure = false;
  shellRuntimeControl.refreshListeners = [];
  const restore = () => {
    for (const [key, value] of Object.entries(previous)) globals[key] = value;
    Date.now = previousDateNow;
  };
  return { documentTarget, restore, tree, windowTarget };
}

export async function runPetShellScenario(useShellEffects: ShellHook, config: PetShellScenarioConfig) {
  resetHarnessState();
  const env = installFakeEnvironment(config);
  const root = createNullRoot((error) => record('react-error', error instanceof Error ? error.message : String(error)));
  const pointerInteractionLockRef = { current: false };
  const baseRegionsRef = { current: [] as unknown[] };
  const setIsChatOpen = (value: unknown) => record('setIsChatOpen', typeof value === 'function' ? '[updater]' : value);
  let props: Record<string, unknown> = {
    activityRegionDragState: null, activityRegionResizeState: null, chatPanelDragState: null, chatPanelResizeState: null,
    companionDragState: null, dragState: null, isChatOpen: false, isExternalChatOpen: false, isPetMotionActive: false,
    isSettingsOpen: false, nativeInteractiveRegionBaseRegionsRef: baseRegionsRef, nativeInteractiveRegionPostRenderSyncKey: 'k1',
    pointerInteractionLockRef, setIsChatOpen, useExternalChatWindow: false, useExternalSettingsWindow: true,
    useFullWindowNativeShapeForPetDrag: false, useNativeInteractiveRegions: config.nativeRegions,
  };
  const Host = (hostProps: Record<string, unknown>) => {
    useShellEffects(hostProps);
    return null;
  };
  const settle = async () => {
    await root.flush();
    record('base', baseRegionsRef.current, pointerInteractionLockRef.current);
  };
  const step = async (label: string, action: () => unknown = () => {}, patch: Record<string, unknown> = {}) => {
    record(`== ${label}`);
    props = { ...props, ...patch };
    await root.render(createElement(Host, props));
    action();
    await settle();
  };
  const pointer = (type: string, x: number, y: number, target: unknown = env.tree.elementFromPoint(x, y)) => {
    env.windowTarget.dispatch(type, new FakeEvent(type, { button: 0, clientX: x, clientY: y, target }));
  };
  try {
    await step('mount');
    await step('idle polls', () => advanceFakeClock(400));
    await step('hover pet hit area', () => { pointer('pointermove', 200, 200); flushFakeAnimationFrames(); });
    await step('hover chat button', () => { pointer('pointermove', 20, 20); flushFakeAnimationFrames(); });
    await step('hover empty area', () => { pointer('pointermove', 700, 500); flushFakeAnimationFrames(); });
    await step('release outside', () => advanceFakeClock(130));
    await step('cursor inside interactive', () => { shellRuntimeControl.cursorPoint = { x: 120, y: 70 }; advanceFakeClock(90); });
    await step('pointerdown chat', () => pointer('pointerdown', 20, 20));
    await step('pointerup pet', () => pointer('pointerup', 200, 200));
    await step('pointerdown pet', () => pointer('pointerdown', 200, 200));
    await step('pointercancel empty', () => pointer('pointercancel', 700, 500));
    await step('dom mutation', () => {
      FakeMutationObserver.instances.forEach((observer) => observer.callback([new FakeMutationRecord('attributes', 'style', env.tree.petShape)]));
      advanceFakeClock(130);
      flushFakeAnimationFrames();
    });
    await step('dirty while pending', () => {
      env.windowTarget.dispatch('resize', new FakeEvent('resize'));
      env.windowTarget.dispatch('scroll', new FakeEvent('scroll'));
      advanceFakeClock(130);
      flushFakeAnimationFrames();
      advanceFakeClock(130);
      flushFakeAnimationFrames();
    });
    await step('pet drag starts', () => { pointer('pointermove', 210, 210); flushFakeAnimationFrames(); advanceFakeClock(1); flushFakeAnimationFrames(); },
      { dragState: { petId: 'pet-a' }, isPetMotionActive: true });
    await step('forced full-window drag', () => {
      pointer('pointermove', 220, 220);
      for (let round = 0; round < 3; round += 1) { advanceFakeClock(130); flushFakeAnimationFrames(); }
    },
      { useFullWindowNativeShapeForPetDrag: true });
    await step('drag ends', () => { advanceFakeClock(1_000); flushFakeAnimationFrames(); },
      { dragState: null, isPetMotionActive: false, useFullWindowNativeShapeForPetDrag: false });
    await step('refresh input proxy', () => shellRuntimeControl.refreshListeners.forEach((listener) => listener({ inputProxy: true })));
    await step('refresh fresh shape', () => shellRuntimeControl.refreshListeners.forEach((listener) => listener({ reason: 'hold-expired' })));
    await step('post render key', () => {}, { nativeInteractiveRegionPostRenderSyncKey: 'k2' });
    await step('mouse leave', () => { env.documentTarget.dispatch('mouseleave', new FakeEvent('mouseleave')); advanceFakeClock(130); });
    await step('blur locked', () => { pointerInteractionLockRef.current = true; env.windowTarget.dispatch('blur', new FakeEvent('blur')); });
    await step('blur unlocked', () => {
      pointerInteractionLockRef.current = false;
      env.windowTarget.dispatch('blur', new FakeEvent('blur'));
      shellRuntimeControl.cursorFailure = true;
      advanceFakeClock(130);
    });
    await step('full-window shape element', () => {
      shellRuntimeControl.cursorFailure = false;
      env.tree.paddedShape.setAttribute('data-desktop-pet-window-shape', 'full-window');
      env.tree.paddedShape.setAttribute('data-desktop-pet-interactive', 'true');
      FakeMutationObserver.instances.forEach((observer) => observer.callback([new FakeMutationRecord('attributes', 'data-desktop-pet-window-shape', env.tree.paddedShape)]));
      advanceFakeClock(130);
      flushFakeAnimationFrames();
    });
    await step('embedded chat opens', () => advanceFakeClock(100), { isChatOpen: true });
    await step('panel drag', () => { pointer('pointermove', 30, 30); advanceFakeClock(1); flushFakeAnimationFrames(); }, { chatPanelDragState: { x: 1 } });
    await step('external chat window', () => {}, { chatPanelDragState: null, isExternalChatOpen: true, useExternalChatWindow: true });
    record('== unmount');
    await root.unmount();
    advanceFakeClock(2_000);
    flushFakeAnimationFrames();
    await settle();
  } finally {
    env.restore();
  }
  return [...harnessState.trace];
}

export const petShellScenarioConfigs: PetShellScenarioConfig[] = [false, true]
  .flatMap((nativeRegions) => [false, true].map((diagnostics) => ({ diagnostics, nativeRegions })));
