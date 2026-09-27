const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the real draft hook with deterministic render cycles and no user data.
const cells = []; let cursor = 0; let effects = []; let updates = [];
const react = {
  useState(initial) { const i = cursor++; if (!(i in cells)) cells[i] = typeof initial === 'function' ? initial() : initial;
    return [cells[i], (next) => { cells[i] = typeof next === 'function' ? next(cells[i]) : next; }]; },
  useRef(value) { const i = cursor++; return cells[i] ||= { current: value }; },
  useEffect(fn, deps) { const i = cursor++; if (!cells[i] || deps.some((x, j) => x !== cells[i][j])) effects.push(fn); cells[i] = deps; },
};
const exported = {};
const code = ts.transpileModule(fs.readFileSync('src/components/settings/useSettingsPanelDraftState.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
vm.runInNewContext(code, { exports: exported, require(id) {
  if (id === 'react') return react;
  if (id.includes('petConfigNormalization')) return { normalizePetConfig: (x) => x };
  if (id.includes('multiPetRoster')) return { PRIMARY_DESKTOP_PET_SLOT_ID: 'primary', getDesktopPetSlot: (c) => c,
    getDesktopPetSlots: (c) => [c] };
  return {};
} });
const initial = { id: 'primary', personality: { traits: [] }, settings: { customModelName: '', customApiUrl: '', customApiKey: '' }, customModelPresets: [] };
function render(config) {
  cursor = 0; effects = [];
  const result = exported.useSettingsPanelDraftState({ config, initialSelectedPetSlotId: 'primary', initialTab: 'model', isOpen: true,
    resetToken: 0, onClose() {}, onUpdateConfig(c, options) { updates.push({ c, options }); } });
  effects.forEach((fn) => fn()); return result;
}
render(initial);
const old = render(initial); // video conversion starts, capturing this render
const newer = { ...initial, customModelPresets: [{ id: 'png-import' }] };
render(newer); render(newer); // a PNG import/shared-state update completes meanwhile
old.commitModelConfig((base) => ({ ...base, customModelPresets: [...base.customModelPresets, { id: 'video-import' }] }));
assert.deepEqual(Array.from(updates.at(-1).c.customModelPresets, (p) => p.id), ['png-import', 'video-import']);
assert.equal(updates.at(-1).options.baseConfig, newer, 'commit must diff against latest committed state');
// A second pending conversion must not replace the first committed import.
old.commitModelConfig((base) => ({ ...base, customModelPresets: [...base.customModelPresets, { id: 'video-two' }] }));
assert.equal(updates.at(-1).c.customModelPresets.length, 3);
const persisted = updates.at(-1).c;
render(persisted);
const beforeDraftEdit = render(persisted);
beforeDraftEdit.applyConfig({ ...persisted, settings: { ...persisted.settings, customModelName: 'unsaved-edit' } });
render(persisted);
beforeDraftEdit.commitModelConfig((base) => ({ ...base, customModelPresets: [...base.customModelPresets, { id: 'video-three' }] }));
assert.equal(updates.at(-1).c.settings.customModelName, '', 'import must not persist unrelated unsaved edits');
const afterImport = render(persisted);
afterImport.handleCloseWithoutSaving();
assert.equal(updates.at(-1).c.customModelPresets.length, 4, 'cancel settings must retain completed imports');
console.log('model import stale commit smoke: PASS');
