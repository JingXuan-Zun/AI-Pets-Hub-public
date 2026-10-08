const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const root = require.resolve('../electron/areaPickerService.cjs');
const source = fs.readFileSync(root, 'utf8');

function fixture(loading) {
  const timers = [], windows = [], registrations = new Map();
  class Window extends EventEmitter {
    constructor(options) {
      super(); this.bounds = { ...options }; this.dead = false; this.visible = false; this.loading = loading;
      this.messages = []; this.webContents = new EventEmitter(); windows.push(this);
      this.webContents.isLoadingMainFrame = () => this.loading;
      this.webContents.send = (...args) => this.messages.push(args);
      this.webContents.executeJavaScript = () => Promise.resolve();
    }
    isDestroyed() { return this.dead; }
    isVisible() { return this.visible; }
    getBounds() { return this.bounds; }
    setBounds(value) { this.bounds = { ...value }; }
    setIgnoreMouseEvents() {}
    loadURL() { return Promise.resolve(); }
    show() { this.visible = true; this.emit('show'); }
    showInactive() { this.visible = true; }
    hide() { this.visible = false; }
    focus() {}
    destroy() { this.dead = true; this.emit('closed'); }
  }
  const shortcut = {
    register(key, callback) { if (registrations.has(key)) return false; registrations.set(key, callback); return true; },
    unregister(key) { registrations.delete(key); },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'setTimeout', source)(id => id === 'electron'
    ? { BrowserWindow: Window, globalShortcut: shortcut, screen: { getDisplayMatching: () => ({ scaleFactor: 1.5 }) } }
    : require(path.resolve(path.dirname(root), id)), module,
  (callback, delay) => { assert.equal(delay, 0); timers.push(callback); });
  function create(index) {
    const state = { basis: index * 1000, builds: 0, restores: 0, owned: new Set() };
    const context = { virtualBounds: { x: state.basis, y: 0, width: 800, height: 600 }, displays: [{ id: index, x: state.basis, y: 0, width: 800, height: 600 }] };
    const own = win => { if (!state.owned.has(win)) { assert.ok(windows.includes(win)); assert.equal(win.owner, undefined); win.owner = index; state.owned.add(win); } assert.equal(win.owner, index); };
    const service = module.exports.createAreaPickerService({
      captureService: { async buildAreaPickerContext() { state.builds++; return context; }, getVirtualDisplayBounds() { return { x: state.basis, y: 0 }; } },
      isQuitting: () => false, loadRenderer: own,
      windowManager: { getSettingsWindow: () => null, getChatWindow: () => null, getMainWindow: () => null,
        keepWindowOnTop: own, scheduleKeepWindowOnTop: own, scheduleWindowStackOnTop() { state.restores++; } },
    });
    return { service, state, context };
  }
  return { create, timers, registrations };
}
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function complete(service, action, selection, registrations) {
  if (action === 'submit') service.submitAreaPickerSelection(selection);
  else if (action === 'cancel') service.cancelAreaPickerSelection();
  else if (action === 'dispose') service.dispose();
  else if (action === 'closed') service.getAreaPickerWindow().destroy();
  else if (action === 'escape') { assert.ok(registrations.has('Esc')); registrations.get('Esc')(); }
  else { let prevented = false; service.getAreaPickerWindow().emit('close', { preventDefault() { prevented = true; } }); assert.equal(prevented, true); }
}
async function run(firstAction, secondAction, loading, reverse) {
  const f = fixture(loading), peers = [f.create(0), f.create(1)];
  const promises = peers.map(p => p.service.openNativeAreaPickerWindow());
  const results = []; promises.forEach((promise, i) => promise.then(value => { results[i] = { value }; }));
  await settle();
  assert.equal(f.registrations.size, 1, 'Shared Esc belongs to first successful registrant');
  const repeated = peers.map(p => p.service.openNativeAreaPickerWindow());
  const borderOptions = peers.map(() => ({ mode: 'area', cropRect: { x: 10, y: 20, width: 80, height: 60 } }));
  for (const [i, p] of peers.entries()) {
    assert.equal(p.state.builds, 1); assert.equal(p.service.getAreaPickerContext(), p.context);
    const win = p.service.getAreaPickerWindow(); win.loading = false; win.webContents.emit('did-finish-load'); win.emit('ready-to-show');
    assert.equal(win.messages.at(-1)[1], p.context);
    p.service.syncPersistentAreaBorderFromSettingsAction({ type: 'preview-capture-options', options: borderOptions[i] });
  }
  const borders = peers.map(p => p.service.getPersistentAreaBorderWindow());
  assert.notEqual(borders[0], borders[1]);
  assert.notEqual(peers[0].service.getAreaPickerWindow(), peers[1].service.getAreaPickerWindow());
  borderOptions[0].cropRect.x = 30; peers[0].state.basis += 100; peers[0].service.refreshPersistentAreaBorder();
  assert.equal(borders[0].bounds.x, 130); assert.equal(borders[1].bounds.x, 1010);
  peers[0].service.syncPersistentAreaBorderFromSettingsAction({ type: 'stop-screen-capture' });
  assert.equal(borders[0].visible, false); assert.equal(borders[1].visible, true);
  const selections = [{ marker: 'first' }, { marker: 'second' }], order = reverse ? [1, 0] : [0, 1];
  const actions = [firstAction, secondAction];
  for (const [step, i] of order.entries()) {
    complete(peers[i].service, actions[i], selections[i], f.registrations); await settle();
    const expected = actions[i] === 'submit' ? selections[i] : null;
    assert.equal(results[i].value, expected); assert.equal(await repeated[i], expected);
    if (step === 0) {
      const other = 1 - i; assert.equal(results[other], undefined, 'Other selection remains pending');
      assert.equal(peers[other].service.getAreaPickerContext(), peers[other].context);
      assert.equal(peers[other].service.getAreaPickerWindow().visible, true);
      assert.equal(borders[other].dead, false);
      if (i === 1) assert.equal(f.registrations.size, 1, 'Failed second registration cannot unregister first owner');
    }
    assert.equal(peers[i].state.restores, 0);
    assert.equal(f.timers.length, 1); f.timers.shift()();
    assert.equal(peers[i].state.restores, 1);
    if (step === 0) assert.equal(peers[1 - i].state.restores, 0);
  }
  for (const p of peers) p.service.dispose();
  assert.equal(f.registrations.size, 0); assert.equal(f.timers.length, 0);
  for (const border of borders) assert.equal(border.dead, true);
  for (const p of peers) { assert.equal(p.service.getPersistentAreaBorderWindow(), null); assert.equal(p.state.restores, 1); }
  await settle();
}
async function main() {
  let cases = 0;
  for (const first of ['submit', 'cancel', 'escape', 'close', 'closed', 'dispose'])
  for (const second of ['submit', 'cancel', 'close', 'closed', 'dispose'])
  for (const loading of [false, true]) for (const reverse of [false, true]) { await run(first, second, loading, reverse); cases++; }
  console.log('Area picker multi-instance integration passed: ' + cases + ' interleaved real-root cases; shared Esc contention, window/context/result/border/timer isolation; controlled Electron.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
