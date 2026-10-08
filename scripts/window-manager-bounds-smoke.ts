import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readModuleProjectFunction } from './projectModuleSource.mjs';
import { assertImplementationModuleGraph } from './implementationModuleGuard';

const require = createRequire(import.meta.url);
const actualFactory = require('../electron/windowManager/windowBoundsResolver.cjs').createWindowBoundsResolver;
export function exerciseWindowManagerBounds(factory = actualFactory) {
  const outputs: unknown[] = [];
  for (const mode of ['none', 'normal', 'group', 'single']) for (const activity of ['primary', '2', 'missing', 2]) {
    for (const dialogue of ['activity', 'primary', '2', 'missing']) for (const size of [null, {width: 1, height: 1}, {width: 1e6, height: 1e6}, {width: 777.6, height: 499.6}]) {
      outputs.push(exercise(mode, activity, dialogue, size));
    }
  }
  for (const failure of ['target', 'virtual', 'full', 'all', 'primary', 'shared']) outputs.push(exercise('single', '2', 'missing', null, failure));
  for (const race of ['target', 'active', 'width']) outputs.push(exercise('single', '2', 'activity', null, undefined, race));
  return outputs;

  function exercise(mode: string, activity: string | number, dialogue: string, size: any, failure?: string, race?: string) {
    const calls: unknown[][] = []; const error = new Error('bounds dependency failure');
    const step = (name: string, value: unknown = null) => { calls.push([name, value]); if (failure === name) throw error; };
    const primary = { id: 1, bounds: {x: 0, y: 0, width: 1920, height: 1080}, workArea: {x: 0, y: 0, width: 1920, height: 1040} };
    const secondary = { id: 2, bounds: {x: -1280, y: -100, width: 1280, height: 800}, workArea: {x: -1280, y: -100, width: 800, height: 500} };
    let state: any = mode === 'none' ? null : { interactiveDialogueActive: mode !== 'normal', chatState: {chatMode: mode === 'group' ? 'group' : 'single'}, config: {settings: {activityDisplayId: activity, interactiveDialogueDisplayId: dialogue}} };
    if (race === 'active') state = { get interactiveDialogueActive() { step('active'); state = {interactiveDialogueActive: false, config: {settings: {activityDisplayId: activity, interactiveDialogueDisplayId: dialogue}}, chatState: {chatMode: 'group'}}; return true; }, config: {settings: {activityDisplayId: activity, interactiveDialogueDisplayId: dialogue}}, chatState: {chatMode: 'single'} };
    const virtual = dialogue === 'primary' ? null : dialogue === 'missing' ? {x: 0, y: 0, width: 0, height: 500} : {x: -1280, y: -100, width: 3200, height: 1180};
    const normal = {width: 1280, height: 820, minWidth: 760, minHeight: 560, maxWidth: 8192, maxHeight: 1248};
    const interactive = {width: 960, height: 300, minWidth: 620, minHeight: 240, maxWidth: 8192, maxHeight: 900};
    const options = {
      captureService: {
        getTargetDisplay: () => { step('target'); if (race === 'target') state.interactiveDialogueActive = false; return secondary; },
        getVirtualDisplayBounds: () => { step('virtual'); return virtual; },
        getFullDisplayBounds: (display: unknown) => { assert.equal(display, secondary); step('full'); return secondary.bounds; },
      },
      screen: { getAllDisplays: () => { step('all'); return [primary, secondary]; }, getPrimaryDisplay: () => { step('primary'); return primary; } },
      getSharedState: () => { step('shared'); return state; },
      SETTINGS_PANEL_WINDOW_BOUNDS: {width: 1440, height: 820}, CHAT_PANEL_WINDOW_BOUNDS: normal,
      INTERACTIVE_CHAT_PANEL_WINDOW_BOUNDS: interactive, INTERACTIVE_CHAT_PANEL_CENTER_Y_RATIO: 0.69,
    };
    const api = factory(options); assert.deepEqual(calls, [], 'creation must not read state or displays');
    const results: any[] = [];
    try {
      if (failure) {
        if (['target', 'virtual', 'full'].includes(failure)) api.getCompactWindowBounds();
        else if (failure === 'all') api.resolveDisplayById('2');
        else if (failure === 'primary') api.resolveDisplayById('primary');
        else api.isInteractiveDialogueChatActive();
        assert.fail('expected original dependency error');
      }
      const compact = api.getCompactWindowBounds(); assert.equal(compact.display, secondary);
      const expectedCompact = virtual && virtual.width > 0 && virtual.height > 0 ? virtual : secondary.bounds;
      assert.deepEqual({x: compact.x, y: compact.y, width: compact.width, height: compact.height}, expectedCompact);
      results.push(compact, api.getSettingsWindowBounds(), api.getSettingsPanelWindowBounds());
      assert.equal(api.resolveDisplayById(2), secondary); assert.equal(api.resolveDisplayById('2'), secondary);
      assert.equal(api.resolveDisplayById('missing'), primary); assert.equal(api.resolveDisplayById('primary'), primary);
      results.push(api.getResolvedInteractiveDialogueDisplay(), api.isInteractiveDialogueChatActive(), api.getActiveChatPanelWindowBoundsPreset());
      const limits = api.getResolvedChatPanelWindowLimits(); assert.ok(limits.display === primary || limits.display === secondary);
      assert.equal(limits.workArea, limits.display.workArea); results.push(limits);
      const current = race === 'width' ? {get width() {step('width'); state.interactiveDialogueActive = false; return 700; }, height: 350} : size;
      const bounds = api.getResolvedChatPanelWindowBounds(current); results.push(bounds, api.getChatPanelWindowBounds());
      for (const field of ['x', 'y', 'width', 'height']) assert.equal(Number.isFinite(bounds[field]), true);
      assert.ok(bounds.width >= limits.minWidth && bounds.width <= limits.maxWidth);
      assert.ok(bounds.height >= limits.minHeight && bounds.height <= limits.maxHeight);
      // Re-read the authoritative state after construction, without rebuilding the resolver.
      state = {interactiveDialogueActive: true, chatState: {chatMode: 'single'}, config: {settings: {activityDisplayId: 'primary', interactiveDialogueDisplayId: 'activity'}}};
      assert.equal(api.isInteractiveDialogueChatActive(), true); assert.equal(api.getResolvedInteractiveDialogueDisplay(), primary);
      assert.equal(api.getActiveChatPanelWindowBoundsPreset(), interactive); results.push(api.getResolvedChatPanelWindowBounds());
    } catch (caught) { assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)?.[0], failure); }
    return JSON.parse(JSON.stringify({mode, activity, dialogue, size, failure, race, calls, results}));
  }
}
assertImplementationModuleGraph({entry: 'electron/windowManager.cjs', directory: 'electron/windowManager', maxEntryLines: 666});
const manager = readModuleProjectFunction('electron/windowManager/windowResourceResolvers.cjs', 'createWindowResourceResolvers');
assert.match(manager, /createWindowBoundsResolver\(\{\s*captureService, screen, getSharedState, SETTINGS_PANEL_WINDOW_BOUNDS, CHAT_PANEL_WINDOW_BOUNDS, INTERACTIVE_CHAT_PANEL_WINDOW_BOUNDS, INTERACTIVE_CHAT_PANEL_CENTER_Y_RATIO,/u);
assert.match(readModuleProjectFunction('electron/windowManager/windowManagerStateControls.cjs', 'createWindowManagerStateControls'), /function getSharedState\(\)\s*\{\s*return managerState\.latestSharedState;/u);
assert.equal(exerciseWindowManagerBounds().length, 265);
console.log('Window manager bounds smoke passed (265 cases; negative displays/small work areas/fallbacks/live shared state/identity/order/errors).');
