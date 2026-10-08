const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const readerFile = path.resolve(__dirname, '../electron/capture/nativeReaders.cjs');
const { createCaptureNativeReaders } = require(readerFile);
const results = require('../electron/capture/nativeResults.cjs');
const filters = require('../electron/captureSourceFilters.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['getNativeDisplayBounds', 'getNativeWindowCaptureSources', 'getNativeScreenPreviewMap'];
let oldFactory;
if (baseline) {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  const declarations = names.map(name => root.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name).getText(ast)).join('\n');
  oldFactory = new Function('dependencies', `const { process, runTemporaryPowerShellScript, execFile,
    getNativeDisplayBoundsPowerShellScript, getNativeWindowCaptureSourcesPowerShellScript, getNativeScreenPreviewPowerShellScript,
    parseNativeDisplayBounds, readNativeResultList, parseNativeScreenPreviews, getOwnCaptureWindowTitleSet, buildFilteredWindowCaptureSources } = dependencies;
    ${declarations}\nreturn { ${names.join(',')} };`);
}

async function run(name, parameter, platform, mode, original) {
  const trace = []; let release;
  const stdout = JSON.stringify([{ deviceName: 'Screen', width: 800, height: 600, displayId: '1', thumbnail: 'preview',
    id: 'window:normal', name: 'Other app', type: 'window' },
    { id: 'window:empty', name: 'Empty image', type: 'window', width: 800, height: 600, thumbnail: '' }]);
  const argument = name === names[1] ? parameter === 'default' ? undefined : parameter === 'null' ? null
    : parameter === 'false' ? { includeThumbnails: false } : parameter === 'true' ? { includeThumbnails: true }
    : { get includeThumbnails() { trace.push(['thumbnail-getter']); if (parameter === 'getter-error') throw Error('getter-error'); return false; } }
    : name === names[2] ? parameter === 'default' ? undefined : parameter === 'null' ? null
      : parameter === 'empty' ? [] : parameter === 'object' ? {} : parameter === 'mixed' ? [null, { id: 1 }] : [{ id: '1' }]
      : undefined;
  const dependencies = { ...results, ...filters, process: { platform },
    getNativeDisplayBoundsPowerShellScript() { trace.push(['display-script']); if (mode === 'script-error') throw Error(mode); return 'display script'; },
    getNativeWindowCaptureSourcesPowerShellScript(options) {
      if (argument !== undefined) assert.strictEqual(options, argument);
      trace.push(['window-script', parameter]); if (mode === 'script-error') throw Error(mode); return 'window script';
    },
    getNativeScreenPreviewPowerShellScript(displays) { trace.push(['preview-script', displays]); if (mode === 'script-error') throw Error(mode); return 'preview script'; },
    runTemporaryPowerShellScript(script, options) {
      trace.push(['temporary', script, options]);
      if (mode === 'runner-sync') throw Error(mode);
      if (mode === 'runner-reject') return Promise.reject(Error(mode));
      if (mode === 'deferred') return new Promise(resolve => { release = () => resolve(stdout); });
      return Promise.resolve(stdout);
    },
    execFile(command, args, options, callback) {
      trace.push(['exec', command, args, options]);
      if (mode === 'command-sync') throw Error(mode);
      if (mode === 'deferred') { release = () => callback(null, stdout); return; }
      callback(mode === 'command-error' ? Error(mode) : null, stdout);
    },
    getOwnCaptureWindowTitleSet() { trace.push(['own']); if (mode === 'own-error') throw Error(mode); return new Set(); },
  };
  const api = original ? oldFactory(dependencies) : createCaptureNativeReaders(dependencies);
  assert.deepEqual(trace, [], 'Creating native readers has no native or window queries');
  const request = api[name](argument);
  if (release) { assert.ok(!trace.some(x => x[0] === 'own')); trace.push(['release']); release(); }
  const result = await request;
  if (platform !== 'win32') assert.deepEqual(trace, []);
  if (name === names[1] && result.length) {
    assert.ok(result.some(x => x.id === 'window:empty'), 'Native windows still permit empty thumbnails');
    const options = trace.find(x => x[0] === 'exec')[3];
    assert.equal(options.timeout, ['false', 'getter'].includes(parameter) ? 1800 : 4500);
    assert.equal(options.maxBuffer, 12 * 1024 * 1024);
  }
  return { trace, value: result instanceof Map ? [...result] : result };
}

function structure() {
  const text = fs.readFileSync(readerFile, 'utf8'), ast = ts.createSourceFile(readerFile, text, ts.ScriptTarget.Latest, true);
  assert.ok(text.split('\n').length <= 300);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) assert.ok(ast.getLineAndCharacterOfPosition(node.end).line
      - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!baseline) return;
  const before = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const root = before.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  for (const name of names) {
    const old = root.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name);
    const moved = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name);
    assert.deepEqual(moved.body.statements.slice(1).map(n => n.getText(ast)), old.body.statements.map(n => n.getText(before)));
  }
  function retained(source, original) {
    const ast = ts.createSourceFile(rootFile, source, ts.ScriptTarget.Latest, true);
    const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
    return root.body.statements.filter(n => !n.getText(ast).startsWith('const runTemporaryPowerShellScript =') && (original
      ? !(ts.isFunctionDeclaration(n) && names.includes(n.name.text))
      : !n.getText(ast).startsWith('const { getNativeDisplayBounds, getNativeWindowCaptureSources, getNativeScreenPreviewMap } =')))
      .map(n => n.getText(ast));
  }
  const current = fs.readFileSync(rootFile, 'utf8'); assert.deepEqual(retained(current, false), retained(baseline, true));
  assert.ok(current.indexOf('const runTemporaryPowerShellScript =') < current.indexOf('= createCaptureNativeReaders('));
  assert.ok(current.indexOf('= createCaptureNativeReaders(') < current.indexOf('= createNativeDisplayCache('));
}

async function main() {
  structure(); let cases = 0;
  const parameters = { [names[0]]: ['default'], [names[1]]: ['default', 'null', 'false', 'true', 'getter', 'getter-error'],
    [names[2]]: ['default', 'null', 'empty', 'object', 'mixed', 'valid'] };
  for (const name of names) for (const parameter of parameters[name]) for (const platform of ['win32', 'linux'])
    for (const mode of ['normal', 'script-error', 'runner-sync', 'runner-reject', 'command-sync', 'command-error', 'own-error', 'deferred']) {
      const actual = await run(name, parameter, platform, mode, false);
      if (baseline) assert.deepEqual(actual, await run(name, parameter, platform, mode, true)); cases++;
    }
  console.log(`Capture native readers passed: ${cases} platform/options/failure/deferred scenarios and unchanged execution bodies.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
