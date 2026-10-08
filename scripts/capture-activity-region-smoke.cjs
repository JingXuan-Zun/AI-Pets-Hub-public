const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const activityFile = path.resolve(__dirname, '../electron/capture/activityRegion.cjs');
const { createCaptureActivityRegion } = require(activityFile);
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['clampAreaScale', 'getTargetDisplay', 'updateActivityRegion'];
let oldFactory;
if (baseline) {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  const declarations = names.map(name => root.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name).getText(ast)).join('\n');
  oldFactory = new Function('dependencies', `const { screen } = dependencies;
    let activityRegionConfig = { displayId: 'primary', areaScale: 55 };
    ${declarations}\nreturn { ${names.join(',')} };`);
}

function configFor(kind, trace) {
  if (kind === 'null') return null; if (kind === 'undefined') return undefined;
  if (kind === 'number') return 42; if (kind === 'string') return '2'; if (kind === 'array') return [];
  if (kind.startsWith('scale:')) return { areaScale: Number(kind.slice(6)) };
  if (kind === 'symbol') return { displayId: '2', areaScale: Symbol('scale') };
  if (kind === 'empty') return {};
  if (kind === 'whitespace') return { displayId: ' 2 ', areaScale: '60' };
  if (kind === 'blank') return { displayId: ' ', areaScale: null };
  if (kind === 'numeric-id') return { displayId: 2, areaScale: true };
  if (kind === 'missing') return { displayId: 'missing', areaScale: false };
  if (kind === 'primary') return { displayId: 'primary', areaScale: 50 };
  if (kind === 'valid') return { displayId: '2', areaScale: 70 };
  let idReads = 0;
  return {
    get displayId() { trace.push(['display-getter', ++idReads]); if (kind === 'id-error' && idReads === 2) throw Error('id-error'); return '2'; },
    get areaScale() { trace.push(['scale-getter']); if (kind === 'scale-error') throw Error('scale-error'); return '75.6'; },
  };
}

function run(kind, displayMode, failure, original) {
  const trace = [];
  const primary = { id: 1 }, second = { id: displayMode === 'string-id' ? '2' : 2 };
  const screen = {
    getAllDisplays() { assert.strictEqual(this, screen); trace.push(['all']); if (failure === 'all') throw Error('all'); return displayMode === 'empty' ? [] : [primary, second]; },
    getPrimaryDisplay() { assert.strictEqual(this, screen); trace.push(['primary']); if (failure === 'primary') throw Error('primary'); return primary; },
  };
  const create = original ? oldFactory : createCaptureActivityRegion;
  const first = create({ screen }), other = create({ screen });
  assert.deepEqual(trace, [], 'Creating activity state must not query displays');
  for (const name of names) assert.notStrictEqual(first[name], other[name], 'Each service keeps distinct method identities');
  const outcomes = [];
  function attempt(label, action) {
    try { const value = action(); outcomes.push({ label, value }); return value; }
    catch (error) { outcomes.push({ label, error: error.message }); }
  }
  attempt('update', () => first.updateActivityRegion(configFor(kind, trace)));
  attempt('target', () => first.getTargetDisplay());
  attempt('other', () => other.updateActivityRegion(null));
  const snapshot = attempt('snapshot', () => first.updateActivityRegion(null));
  if (snapshot) { snapshot.config.displayId = 'mutated'; snapshot.config.areaScale = -1; }
  attempt('after-copy-mutation', () => first.updateActivityRegion(null));
  attempt('second-update', () => first.updateActivityRegion({ displayId: '2', areaScale: 55 }));
  attempt('new-target', () => first.getTargetDisplay());
  const current = outcomes.find(x => x.label === 'after-copy-mutation')?.value;
  if (current) assert.notEqual(current.config.displayId, 'mutated');
  assert.deepEqual(outcomes.find(x => x.label === 'other').value.config, { displayId: 'primary', areaScale: 55 });
  if (kind === 'symbol' || kind === 'scale-error') assert.equal(current.config.displayId, '2', 'A later scale error preserves the prior ID update');
  return { outcomes, trace };
}

function runClamp(value, original) {
  const create = original ? oldFactory : createCaptureActivityRegion;
  const api = create({ screen: {} });
  try { return { value: api.clampAreaScale(value) }; } catch (error) { return { error: error.message }; }
}

function runRoot(original) {
  const primary = { id: 1 }, second = { id: 2 }, trace = [];
  const screen = { getAllDisplays() { trace.push(['all']); return [primary, second]; }, getPrimaryDisplay() { trace.push(['primary']); return primary; } };
  const loaded = new Map();
  function load(file) {
    if (loaded.has(file)) return loaded.get(file).exports;
    const module = { exports: {} }; loaded.set(file, module);
    new Function('require', 'module', 'exports', file === rootFile && original ? baseline : fs.readFileSync(file, 'utf8'))(name => {
      if (name === 'electron') return { screen, app: {}, BrowserWindow: {}, desktopCapturer: {} };
      if (name === 'child_process') return {}; if (name === 'fs') return {}; if (name === 'path') return path;
      assert.ok(name.startsWith('./')); return load(path.resolve(path.dirname(file), name));
    }, module, module.exports); return module.exports;
  }
  const { createCaptureService } = load(rootFile); const first = createCaptureService(), secondService = createCaptureService();
  const output = [Object.keys(first), first.updateActivityRegion({ displayId: '2', areaScale: 102 }), first.getTargetDisplay(), secondService.getTargetDisplay()];
  assert.strictEqual(output[2], second); assert.strictEqual(output[3], primary);
  first.dispose(); output.push(first.updateActivityRegion(null), first.getTargetDisplay()); secondService.dispose();
  return { output, trace };
}

function structure() {
  if (!baseline) return;
  function retained(source, original) {
    const ast = ts.createSourceFile(rootFile, source, ts.ScriptTarget.Latest, true);
    const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
    return root.body.statements.filter(n => original ? !(ts.isFunctionDeclaration(n) && names.includes(n.name.text))
      && !n.getText(ast).startsWith('let activityRegionConfig =')
      : !n.getText(ast).startsWith('const { clampAreaScale, getTargetDisplay, updateActivityRegion } =')).map(n => n.getText(ast));
  }
  assert.deepEqual(retained(fs.readFileSync(rootFile, 'utf8'), false), retained(baseline, true));
}

function main() {
  structure(); let cases = 0;
  const kinds = ['null', 'undefined', 'number', 'string', 'array', 'empty', 'whitespace', 'blank', 'numeric-id', 'missing', 'primary', 'valid',
    'getter', 'id-error', 'scale-error', 'symbol', 'scale:-1', 'scale:0', 'scale:29', 'scale:30', 'scale:55.5', 'scale:100', 'scale:101', 'scale:NaN'];
  for (const kind of kinds) for (const displays of ['normal', 'string-id', 'empty']) for (const failure of ['', 'all', 'primary']) {
    const actual = run(kind, displays, failure, false); if (baseline) assert.deepEqual(actual, run(kind, displays, failure, true)); cases++;
  }
  for (const value of [undefined, null, false, true, '', '60.4', -1, 0, 29, 30, 55.5, 100, 101, NaN, Infinity, {}, Symbol('scale')]) {
    const actual = runClamp(value, false); if (baseline) assert.deepEqual(actual, runClamp(value, true)); cases++;
  }
  const actual = runRoot(false); if (baseline) assert.deepEqual(actual, runRoot(true)); cases++;
  console.log(`Capture activity region passed: ${cases} update/target/getter/error/isolation and controlled-root scenarios.`);
}
main();
