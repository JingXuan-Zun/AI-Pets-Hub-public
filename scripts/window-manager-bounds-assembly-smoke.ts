import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const actual = createRequire(import.meta.url)('../electron/windowManager/windowBoundsResolver.cjs').createWindowBoundsResolver;
export function exerciseBoundsEdges(factory = actual) {
  const results: unknown[] = [];
  for (const area of ['work-area', 'bounds-fallback', 'tiny']) for (const mode of ['missing', 'normal', 'group', 'single'])
  for (const size of [null, { width: 0, height: -5 }, { width: 233.6, height: 177.4 }, { width: NaN, height: Infinity }])
  for (const ratio of [-1, 0.69, 2]) {
    const calls: unknown[][] = [];
    const display = { id: 2, bounds: { x: -1500, y: -240, width: 800, height: 600 },
      workArea: area === 'bounds-fallback' ? undefined : { x: -1400, y: -200, width: area === 'tiny' ? 180 : 700, height: area === 'tiny' ? 90 : 500 } };
    let state: any = mode === 'missing' ? undefined : { interactiveDialogueActive: mode !== 'normal', chatState: { chatMode: mode === 'group' ? 'group' : 'single' },
      config: { settings: { activityDisplayId: '2', interactiveDialogueDisplayId: 'activity' } } };
    const normal = { width: 600, height: 400, minWidth: 200, minHeight: 150, maxWidth: 900, maxHeight: 700 };
    const interactive = { width: 420, height: 200, minWidth: 250, minHeight: 100, maxWidth: 750, maxHeight: 600 };
    const api = factory({
      captureService: { getTargetDisplay: () => { calls.push(['target']); return display; } },
      screen: { getAllDisplays: () => { calls.push(['all']); return [display]; }, getPrimaryDisplay: () => { calls.push(['primary']); return display; } },
      getSharedState: () => { calls.push(['shared']); return state; },
      SETTINGS_PANEL_WINDOW_BOUNDS: {}, CHAT_PANEL_WINDOW_BOUNDS: normal,
      INTERACTIVE_CHAT_PANEL_WINDOW_BOUNDS: interactive, INTERACTIVE_CHAT_PANEL_CENTER_Y_RATIO: ratio,
    });
    assert.deepEqual(calls, [], 'assembly has no eager display/state query');
    const limits = api.getResolvedChatPanelWindowLimits();
    assert.equal(limits.display, display); assert.equal(limits.workArea, display.workArea || display.bounds);
    assert.equal(api.getActiveChatPanelWindowBoundsPreset(), mode === 'single' ? interactive : normal);
    const bounds = api.getResolvedChatPanelWindowBounds(size);
    if (size === null && mode === 'single') {
      const workArea = limits.workArea;
      assert.ok(bounds.x >= workArea.x && bounds.x + bounds.width <= workArea.x + workArea.width);
      assert.ok(bounds.y >= workArea.y && bounds.y + bounds.height <= workArea.y + workArea.height);
    }
    state = { interactiveDialogueActive: false, chatState: { chatMode: 'single' } };
    assert.equal(api.getActiveChatPanelWindowBoundsPreset(), normal);
    results.push({ area, mode, size, ratio, calls, limits, bounds, updated: api.getChatPanelWindowBounds() });
  }
  return results;
}

const source = fs.readFileSync('electron/windowManager/windowBoundsResolver.cjs', 'utf8');
const stages = ['createCaptureWindowBounds', 'createChatDisplayPolicy', 'createChatPanelBounds'];
const keys = [
  ['getCompactWindowBounds', 'getSettingsWindowBounds', 'getSettingsPanelWindowBounds'],
  ['resolveDisplayById', 'getResolvedInteractiveDialogueDisplay', 'isInteractiveDialogueChatActive', 'getActiveChatPanelWindowBoundsPreset'],
  ['getResolvedChatPanelWindowLimits', 'getResolvedChatPanelWindowBounds', 'getChatPanelWindowBounds'],
];
for (const failure of [undefined, ...stages]) {
  const calls: string[] = [], error = new Error('bounds assembly'), outputs = new Map<string, () => never>();
  const dependencies = { captureService: {}, screen: {}, getSharedState: () => { throw new Error('no eager state read'); } };
  const factories = Object.fromEntries(stages.map((stage, index) => [stage, (input: any) => {
    calls.push(stage);
    for (const [key, value] of Object.entries(dependencies)) assert.equal(input[key], value);
    if (index === 2) for (const key of keys[1]) assert.equal(input[key], outputs.get(key));
    if (failure === stage) throw error;
    return Object.fromEntries(keys[index].map(key => {
      const fn = () => { throw new Error('no eager action'); }; outputs.set(key, fn); return [key, fn];
    }));
  }]));
  const module = { exports: {} as any };
  vm.runInNewContext(source, { module, require: () => factories });
  let caught: unknown, result: any;
  try { result = module.exports.createWindowBoundsResolver(dependencies); } catch (value) { caught = value; }
  assert.equal(caught, failure ? error : undefined);
  assert.deepEqual(calls, failure ? stages.slice(0, stages.indexOf(failure) + 1) : stages);
  if (!failure) {
    assert.deepEqual(Object.keys(result), [...keys[0], 'getChatPanelWindowBounds', ...keys[1], 'getResolvedChatPanelWindowLimits', 'getResolvedChatPanelWindowBounds']);
    for (const [key, value] of Object.entries(result)) assert.equal(value, outputs.get(key));
  }
}
const results = exerciseBoundsEdges();
console.log(`Bounds assembly passed (${results.length} missing-work-area/small-area/preset/position/size cases; three lazy stages, live state, identities and failures).`);
