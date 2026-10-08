const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const geometryFile = path.resolve(__dirname, '../electron/capture/areaGeometry.cjs');
const titleFile = path.resolve(__dirname, '../electron/capture/windowTitles.cjs');
const { createCaptureAreaGeometry } = require(geometryFile);
const { createOwnCaptureWindowTitleReader } = require(titleFile);
const { normalizeCaptureSourceTitle } = require('../electron/captureSourceFilters.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['getAreaPickerThumbnailSize', 'getVirtualWorkAreaBounds', 'getVirtualDisplayBounds'];
let oldGeometry, oldTitles;
if (baseline) {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  const declaration = name => root.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name).getText(ast);
  oldGeometry = new Function('dependencies', `const { screen, getFullDisplayBounds, getTargetDisplay,
    AREA_PICKER_MAX_PREVIEW_WIDTH, AREA_PICKER_MAX_PREVIEW_HEIGHT } = dependencies;
    ${names.map(declaration).join('\n')}\nreturn { ${names.join(',')} };`);
  oldTitles = new Function('dependencies', `const { BrowserWindow, normalizeCaptureSourceTitle } = dependencies;
    ${declaration('getOwnCaptureWindowTitleSet')}\nreturn getOwnCaptureWindowTitleSet;`);
}

function display(id, scale, kind) {
  const bounds = { x: id === 1 ? -1920 : 0, y: -100, width: kind === 'huge' ? 8000 : kind === 'zero' ? 0 : 1920,
    height: kind === 'huge' ? 6000 : 1080 };
  return { id, scaleFactor: scale, bounds: kind === 'work-only' ? undefined : bounds,
    workArea: { ...bounds, y: -50, height: kind === 'huge' ? 5900 : 1040 } };
}

function runGeometry(name, kind, scale, inputKind, failure, original) {
  const trace = [];
  const primary = display(1, scale, kind), second = display(2, 1.5, kind);
  const displays = kind === 'empty' ? [] : [primary, second];
  let target = primary;
  const screen = {
    getAllDisplays() { assert.strictEqual(this, screen); trace.push(['all']); if (failure === 'all') throw Error('all'); return displays; },
    getPrimaryDisplay() { assert.strictEqual(this, screen); trace.push(['primary']); if (failure === 'primary') throw Error('primary'); return primary; },
  };
  const dependencies = { screen, AREA_PICKER_MAX_PREVIEW_WIDTH: 5120, AREA_PICKER_MAX_PREVIEW_HEIGHT: 2880,
    getFullDisplayBounds(value) { trace.push(['bounds', value.id]); if (failure === 'bounds') throw Error('bounds'); return value.bounds || value.workArea; },
    getTargetDisplay() { trace.push(['target', target.id]); if (failure === 'target') throw Error('target'); return target; },
  };
  const api = original ? oldGeometry(dependencies) : createCaptureAreaGeometry(dependencies);
  assert.deepEqual(trace, [], 'Geometry construction must not query displays');
  const input = inputKind === 'default' ? undefined : inputKind === 'null' ? null : inputKind === 'empty' ? []
    : inputKind === 'object' ? {} : [second];
  const outputs = [];
  for (const nextTarget of [primary, second]) {
    target = nextTarget;
    try {
      const value = api[name](input);
      outputs.push({ value, sameTarget: value.display === target });
      if (name === names[0] && kind === 'huge') assert.ok(value.width <= 5120 && value.height <= 2880);
      if (name === names[1] && displays.length) assert.strictEqual(value.display, target, 'Read the current target on every call');
    } catch (error) { outputs.push({ error: error.message }); }
  }
  return { outputs, trace };
}

function runTitles(kind, failure, original) {
  const trace = []; let revision = 0;
  const values = kind === 'duplicates' ? [' App ', 'app', '', 'APP', '中文 窗口'] : kind === 'odd' ? [null, 0, {}, '桌面宠物'] : ['Other app'];
  const windows = [null, { isDestroyed() { trace.push(['dead']); return true; } },
    ...values.map((title, index) => ({
      isDestroyed() { trace.push(['live', index]); if (failure === 'destroyed') throw Error('destroyed'); return false; },
      getTitle() { trace.push(['title', index, revision]); if (failure === 'title') throw Error('title'); return revision ? 'Changed' : title; },
    }))];
  const BrowserWindow = { getAllWindows() {
    assert.strictEqual(this, BrowserWindow); trace.push(['windows']); if (failure === 'windows') throw Error('windows');
    return kind === 'empty' ? [] : windows;
  } };
  const dependencies = { BrowserWindow, normalizeCaptureSourceTitle(value) {
    trace.push(['normalize', value]); if (failure === 'normalize') throw Error('normalize'); return normalizeCaptureSourceTitle(value);
  } };
  const read = original ? oldTitles(dependencies) : createOwnCaptureWindowTitleReader(dependencies);
  assert.deepEqual(trace, [], 'Title reader construction must not enumerate windows');
  const outputs = [];
  for (revision = 0; revision < 2; revision++) {
    try { outputs.push([...read()]); } catch (error) { outputs.push({ error: error.message }); }
  }
  if (!failure && kind === 'duplicates') assert.deepEqual(outputs[0], ['app', '中文 窗口']);
  if (!failure && kind !== 'empty') assert.deepEqual(outputs[1], ['changed']);
  return { trace, outputs };
}

function rootRun(kind, scale, original) {
  const trace = [], primary = display(1, scale, kind), second = display(2, 1.5, kind);
  const electron = { app: {}, BrowserWindow: {}, desktopCapturer: {}, screen: {
    getAllDisplays() { trace.push(['all']); return kind === 'empty' ? [] : [primary, second]; },
    getPrimaryDisplay() { trace.push(['primary']); return primary; },
  } };
  const modules = new Map();
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    new Function('require', 'module', 'exports', 'process', 'Date', file === rootFile && original ? baseline : fs.readFileSync(file, 'utf8'))(id => {
      if (id === 'electron') return electron;
      if (id === 'child_process') return { execFile() { throw Error('Unexpected native call'); } };
      if (id === 'fs') return {};
      if (id === 'path') return path;
      assert.ok(id.startsWith('./')); return load(path.resolve(path.dirname(file), id));
    }, module, module.exports, { platform: 'linux' }, { now: () => 100 });
    return module.exports;
  }
  const { createCaptureService } = load(rootFile); const first = createCaptureService(), other = createCaptureService();
  const output = [Object.keys(first), first.getVirtualDisplayBounds(), first.getVirtualWorkAreaBounds()];
  output.push(first.updateActivityRegion({ displayId: '2', areaScale: 70 }), first.getVirtualWorkAreaBounds(), other.getVirtualWorkAreaBounds());
  if (kind !== 'empty') { assert.strictEqual(output[4].display, second); assert.strictEqual(output[5].display, primary); }
  output.push(first.updateActivityRegion({ displayId: 'missing' }), first.getVirtualWorkAreaBounds());
  first.dispose(); other.dispose(); return { output, trace };
}

function structure() {
  for (const file of [geometryFile, titleFile]) {
    const text = fs.readFileSync(file, 'utf8'), ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    assert.ok(text.split('\n').length <= 300);
    function visit(node) {
      if (ts.isFunctionLike(node) && node.body) assert.ok(ast.getLineAndCharacterOfPosition(node.end).line
        - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50);
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  if (!baseline) return;
  function retained(source, original) {
    const ast = ts.createSourceFile(rootFile, source, ts.ScriptTarget.Latest, true);
    const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
    return root.body.statements.filter(n => original ? !(ts.isFunctionDeclaration(n) && [...names, 'getOwnCaptureWindowTitleSet'].includes(n.name.text))
      : !n.getText(ast).startsWith('const { getAreaPickerThumbnailSize, getVirtualWorkAreaBounds, getVirtualDisplayBounds } =')
        && !n.getText(ast).startsWith('const getOwnCaptureWindowTitleSet =')).map(n => n.getText(ast));
  }
  assert.deepEqual(retained(fs.readFileSync(rootFile, 'utf8'), false), retained(baseline, true));
}

function main() {
  structure(); let cases = 0;
  for (const name of names) for (const kind of ['normal', 'empty', 'work-only', 'huge', 'zero'])
    for (const scale of [0, -1, 1, 1.25, 2, NaN, '1.5']) for (const input of ['default', 'null', 'empty', 'object', 'explicit'])
      for (const failure of ['', 'all', 'primary', 'bounds', 'target']) {
        const actual = runGeometry(name, kind, scale, input, failure, false);
        if (baseline) assert.deepEqual(actual, runGeometry(name, kind, scale, input, failure, true)); cases++;
      }
  for (const kind of ['normal', 'empty', 'duplicates', 'odd']) for (const failure of ['', 'windows', 'destroyed', 'title', 'normalize']) {
    const actual = runTitles(kind, failure, false); if (baseline) assert.deepEqual(actual, runTitles(kind, failure, true)); cases++;
  }
  for (const kind of ['normal', 'empty', 'work-only']) for (const scale of [1, 1.25, 2]) {
    const actual = rootRun(kind, scale, false); if (baseline) assert.deepEqual(actual, rootRun(kind, scale, true)); cases++;
  }
  console.log(`Capture area geometry and titles passed: ${cases} geometry/title/live-state/controlled-root scenarios.`);
}
main();
