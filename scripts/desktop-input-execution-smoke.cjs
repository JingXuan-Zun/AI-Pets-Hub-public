const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const { createDesktopInputExecutor } = require('../electron/desktopInputExecution.cjs');
const { normalizeDesktopInputAction } = require('../electron/desktopInputRules.cjs');
const rootFile = path.resolve(__dirname, '../electron/desktopInputService.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
let oldFactory;
if (baseline) {
  const tree = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const factory = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createDesktopInputService');
  const fn = factory.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'executeDesktopInput');
  oldFactory = new Function('dependencies', 'normalizeDesktopInputAction',
    'const { log, process, createNativeScreenInputRequest, createDesktopInputScript, runPowerShellScript, DESKTOP_INPUT_TIMEOUT_MS } = dependencies;\n'
    + fn.getText(tree) + '\nreturn executeDesktopInput;');
}
async function run(action, platform, mode, stdout, original) {
  const trace = [], failure = Error('controlled ' + mode), process = { platform };
  const request = { action, x: -20, y: 30 };
  const projected = { action, nativeScreenX: -20, nativeScreenY: 30 };
  const deps = { process, DESKTOP_INPUT_TIMEOUT_MS: 5000,
    log(message, details) { trace.push(['log', message, details]); if (mode === 'log') throw failure; },
    createNativeScreenInputRequest(normalized, input) {
      trace.push(['project', normalized]); assert.strictEqual(input, request);
      if (mode === 'project') throw failure; return projected;
    },
    createDesktopInputScript(normalized, input) {
      trace.push(['script', normalized]); assert.strictEqual(input, projected);
      if (mode === 'script') throw failure; return mode === 'invalid' ? null : 'controlled script';
    },
    runPowerShellScript(script, timeout) {
      trace.push(['run', script, timeout]); if (mode === 'run-sync') throw failure;
      return mode === 'run-reject' ? Promise.reject(failure) : Promise.resolve(stdout);
    },
  };
  const read = original ? oldFactory(deps, normalizeDesktopInputAction) : createDesktopInputExecutor(deps);
  assert.equal(trace.length, 0, 'Construction does not execute');
  const promise = read(request); assert.ok(promise instanceof Promise);
  try { return { value: await promise, trace }; }
  catch (error) { assert.strictEqual(error, failure); return { rejection: error.message, trace }; }
}
async function rootScenario(original, mode) {
  const trace = [], loaded = new Map(), process = { platform: 'win32' }; let directoryId = 0;
  function load(file) {
    if (loaded.has(file)) return loaded.get(file).exports;
    const module = { exports: {} }; loaded.set(file, module);
    new Function('require', 'module', 'exports', 'process', original && file === rootFile ? baseline : fs.readFileSync(file, 'utf8'))(id => {
      if (id.startsWith('./')) return load(path.resolve(path.dirname(file), id));
      if (id === 'child_process') return { execFile(command, args, options, callback) {
        trace.push(['exec', command, args[3], options]);
        if (mode === 'launch') throw Error('controlled launch');
        callback(mode === 'callback' ? Error('controlled callback') : null, mode === 'parse' ? '{broken' : '{"ok":true,"marker":"controlled"}');
      } };
      if (id === 'fs') return { mkdtempSync(prefix) { const target = 'C:\\controlled\\input-' + ++directoryId; trace.push(['mkdir', prefix, target]); return target; },
        writeFileSync(target, script, encoding) { trace.push(['write', target, crypto.createHash('sha256').update(script).digest('hex'), encoding]); },
        rmSync(target, options) { trace.push(['remove', target, options]); } };
      if (id === 'os') return { tmpdir: () => 'C:\\controlled' }; if (id === 'path') return path.win32;
      throw Error(id);
    }, module, module.exports, process);
    return module.exports;
  }
  const api = load(rootFile);
  const first = api.createDesktopInputService({ log(message, payload) { trace.push(['first-log', message, payload]); },
    screen: { dipToScreenPoint: ({ x, y }) => ({ x: x * 2, y: y * 2 }) } });
  const second = api.createDesktopInputService({ log(message, payload) { trace.push(['second-log', message, payload]); } });
  assert.deepEqual(Object.keys(first), ['executeDesktopInput', '_createNativeScreenInputRequest']);
  assert.notStrictEqual(first.executeDesktopInput, second.executeDesktopInput);
  assert.notStrictEqual(first._createNativeScreenInputRequest, second._createNativeScreenInputRequest);
  const values = [];
  for (const service of [first, second]) {
    values.push(await service.executeDesktopInput({ action: 'click', x: -20, y: 30, expectedHwnd: 123 }));
    values.push(await service.executeDesktopInput({ action: 'type_text', text: '中文+{}'.repeat(4000) }));
    values.push(await service.executeDesktopInput({ action: 'unknown' }));
  }
  process.platform = 'linux';
  values.push(await first.executeDesktopInput({ action: 'click', x: 1, y: 2 }));
  assert.equal(values.at(-1).ok, false);
  assert.ok(values.at(-1).error.includes('Windows'));
  assert.equal(trace.filter(row => row[0] === 'mkdir').length, trace.filter(row => row[0] === 'remove').length);
  return { values, trace };
}
async function main() {
  let cases = 0;
  for (const action of ['click', ' MOVE-POINTER ', 'type', 'unknown', undefined]) for (const platform of ['win32', 'linux'])
    for (const mode of ['normal', 'project', 'script', 'invalid', 'run-sync', 'run-reject', 'log'])
      for (const stdout of ['{"ok":true,"action":"upstream","extra":123}', '{"ok":false}', '', ' ', '{broken', 'null', '3', '"value"']) {
        const actual = await run(action, platform, mode, stdout, false);
        if (baseline) assert.deepEqual(actual, await run(action, platform, mode, stdout, true)); cases++;
      }
  for (const mode of ['normal', 'launch', 'callback', 'parse']) {
    const actual = await rootScenario(false, mode);
    if (baseline) assert.deepEqual(actual, await rootScenario(true, mode));
  }
  const failure = Error('request action getter');
  const read = createDesktopInputExecutor({ process: { platform: 'win32' } });
  await assert.rejects(read({ get action() { throw failure; } }), error => error === failure);
  console.log('Desktop input execution passed: ' + cases + ' platform/projection/script/process/parse/log/error cases and 4 real-root two-instance chains; controlled external APIs.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
