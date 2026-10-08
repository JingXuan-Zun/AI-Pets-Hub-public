const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const { createDesktopInputPowerShellRunner } = require('../electron/desktopInputPowerShellRunner.cjs');
const rootFile = path.resolve(__dirname, '../electron/desktopInputService.cjs');
const file = path.resolve(__dirname, '../electron/desktopInputPowerShellRunner.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const runnerBaseline = baseline?.includes('function createDesktopInputPowerShellRunner(');
const digest = value => crypto.createHash('sha256').update(String(value)).digest('hex');
let oldFactory;
if (baseline) {
  if (runnerBaseline) {
    const module = { exports: {} };
    new Function('module', baseline)(module);
    oldFactory = module.exports.createDesktopInputPowerShellRunner;
  } else {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'runPowerShellScript');
  oldFactory = new Function('dependencies', 'const { Buffer, execFile, mkdtempSync, rmSync, writeFileSync, tmpdir, join, DESKTOP_INPUT_TIMEOUT_MS } = dependencies;\n' + node.getText(ast) + '\nreturn runPowerShellScript;');
  }
}
async function run(script, timeout, mode, stdout, original, cleanupThrows = false) {
  const trace = []; let callback, joinCount = 0, large = false;
  const failure = Error(mode);
  const deps = { DESKTOP_INPUT_TIMEOUT_MS: 5000,
    Buffer: { from(value, encoding) {
      trace.push(['encode', encoding]); if (mode === 'encode') throw failure;
      const buffer = Buffer.from(value, encoding), stringify = buffer.toString;
      buffer.toString = function (encoding) {
        assert.strictEqual(this, buffer); trace.push(['stringify', encoding]);
        if (mode === 'stringify') throw failure;
        const value = stringify.call(this, encoding); large = value.length > 24000; return value;
      }; return buffer;
    } },
    tmpdir() { trace.push(['tmpdir']); if (mode === 'tmpdir') throw failure; return 'C:\\controlled'; },
    join(...args) {
      trace.push(['join', args]); joinCount++;
      if (mode === 'join-prefix' && joinCount === 1 || mode === 'join-file' && joinCount === 2) throw failure;
      return path.win32.join(...args);
    },
    mkdtempSync(prefix) { trace.push(['mkdir', prefix]); if (mode === 'mkdir') throw failure; return 'C:\\controlled\\desktop-pet-input-fixture'; },
    writeFileSync(target, value, encoding) {
      trace.push(['write', target, digest(value), encoding]); assert.strictEqual(value, script); assert.equal(encoding, 'utf8');
      if (mode === 'write') throw failure;
    },
    rmSync(target, options) {
      trace.push(['remove', target, options]); assert.equal(target, 'C:\\controlled\\desktop-pet-input-fixture');
      assert.deepEqual(options, { recursive: true, force: true });
      if (cleanupThrows) throw Error('secondary cleanup failure');
      if (mode === 'cleanup' || mode === 'callback-cleanup') throw failure;
    },
    execFile(command, args, options, done) {
      assert.equal(command, 'powershell.exe');
      assert.deepEqual(args.slice(0, 3), ['-NoProfile', '-ExecutionPolicy', 'Bypass']);
      if (large) { assert.equal(args[3], '-File'); assert.equal(args[4], 'C:\\controlled\\desktop-pet-input-fixture\\input.ps1'); }
      else { assert.equal(args[3], '-EncodedCommand'); assert.equal(args[4], Buffer.from(script, 'utf16le').toString('base64')); }
      assert.deepEqual(options, { encoding: 'utf8', timeout: timeout === undefined ? 5000 : timeout, windowsHide: true });
      trace.push(['exec', command, [...args.slice(0, 4), digest(args[4])], options]);
      if (mode === 'exec-sync') throw failure; callback = done;
    },
  };
  const create = original ? oldFactory : createDesktopInputPowerShellRunner;
  const read = create(deps); assert.equal(trace.length, 0, 'Factory has no external effects');
  let promise;
  try { promise = read(script, timeout); }
  catch (error) {
    if (script === null && mode !== 'encode') assert.equal(error.code, 'ERR_INVALID_ARG_TYPE');
    else assert.strictEqual(error, failure);
    assert.ok(!trace.some(row => row[0] === 'exec'));
    assert.equal(trace.filter(row => row[0] === 'remove').length,
      !original && large && ['join-file', 'write'].includes(mode) ? 1 : 0,
      'Preparation failure must clean the directory once allocation succeeded');
    return { trace, kind: 'sync', error: [error.name, error.message] };
  }
  assert.ok(promise instanceof Promise); let settled = false;
  const outcome = promise.then(value => { settled = true; return { value }; }, error => { settled = true; assert.strictEqual(error, failure); return { error: [error.name, error.message] }; });
  if (callback) {
    await Promise.resolve(); assert.equal(settled, false);
    callback(mode === 'callback' || mode === 'callback-cleanup' ? failure : null, stdout);
  }
  const result = await outcome;
  if (result.error) assert.equal(result.error[1], mode);
  else assert.strictEqual(result.value, stdout, 'stdout identity is preserved');
  const removed = trace.filter(row => row[0] === 'remove').length;
  assert.equal(removed, large && (callback || !original && mode === 'exec-sync') ? 1 : 0,
    'Callback completion and synchronous launch failure clean prepared files');
  if (mode === 'cleanup' && callback) assert.ok(!result.error, 'Cleanup failure is ignored');
  return { trace, kind: 'promise', result };
}
function rootScenario(original, mode = 'normal', cleanupThrows = false) {
  const trace = [], loaded = new Map();
  function load(file) {
    if (loaded.has(file)) return loaded.get(file).exports;
    const module = { exports: {} }; loaded.set(file, module);
    const useBaseline = original && file === (runnerBaseline ? path.resolve(__dirname, '../electron/desktopInputPowerShellRunner.cjs') : rootFile);
    new Function('require', 'module', 'exports', 'process', useBaseline ? baseline : fs.readFileSync(file, 'utf8'))(id => {
      if (id.startsWith('./')) return load(path.resolve(path.dirname(file), id));
      if (id === 'child_process') return { execFile(command, args, options, callback) {
        trace.push(['exec', command, args[3], options]);
        if (mode === 'exec-sync') throw Error(mode);
        callback(null, '{"ok":true,"marker":"controlled"}');
      } };
      if (id === 'fs') return { mkdtempSync(prefix) { trace.push(['mkdir', prefix]); return 'C:\\controlled\\root-fixture'; },
        writeFileSync(target, script, encoding) { trace.push(['write', target, digest(script), encoding]); if (mode === 'write') throw Error(mode); },
        rmSync(target, options) { trace.push(['remove', target, options]); if (cleanupThrows) throw Error('secondary cleanup failure'); } };
      if (id === 'os') return { tmpdir: () => 'C:\\controlled' };
      if (id === 'path') return { join(...args) {
        if (mode === 'join-file' && args[1] === 'input.ps1') throw Error(mode);
        return path.win32.join(...args);
      } };
      throw Error(id);
    }, module, module.exports, { platform: 'win32' }); return module.exports;
  }
  const api = load(rootFile).createDesktopInputService();
  return api.executeDesktopInput({ action: 'type_text', text: '中文+{}'.repeat(4000) }).then(value => {
    assert.equal(value.action, 'type_text');
    if (mode === 'normal') { assert.equal(value.ok, true); assert.equal(value.marker, 'controlled'); }
    else { assert.equal(value.ok, false); assert.equal(value.error, mode); }
    assert.equal(trace.at(-1)[0], 'remove');
    assert.equal(trace.filter(row => row[0] === 'remove').length, 1);
    return { value, trace };
  });
}
function structure() {
  const text = fs.readFileSync(file, 'utf8'), tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  assert.ok(text.split('\n').length <= 300);
  for (const n of tree.statements.filter(ts.isFunctionDeclaration)) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
  if (!baseline || runnerBaseline) return;
  function retained(source, original) {
    const ast = ts.createSourceFile(rootFile, source, ts.ScriptTarget.Latest, true);
    return ast.statements.filter(n => original ? !(ts.isFunctionDeclaration(n) && n.name.text === 'runPowerShellScript')
      : !(ts.isVariableStatement(n) && (n.getText(ast).includes("require('./desktopInputPowerShellRunner.cjs')") || n.getText(ast).includes('= createDesktopInputPowerShellRunner('))))
      .map(n => n.getText(ast));
  }
  assert.deepEqual(retained(fs.readFileSync(rootFile, 'utf8'), false), retained(baseline, true));
}
async function main() {
  structure(); let cases = 0, intentionalChanges = 0;
  const scripts = ['', '中文😀', 'a'.repeat(8999), 'a'.repeat(9000), 'a'.repeat(9001), '😀'.repeat(4501), Buffer.from('tiny'), null];
  for (const script of scripts) for (const timeout of [undefined, 0, null, 12000])
    for (const mode of ['normal', 'encode', 'stringify', 'tmpdir', 'join-prefix', 'mkdir', 'join-file', 'write', 'exec-sync', 'callback', 'cleanup', 'callback-cleanup'])
      for (const stdout of ['output', Buffer.from('raw')]) {
        const actual = await run(script, timeout, mode, stdout, false);
        if (baseline) {
          const previous = await run(script, timeout, mode, stdout, true);
          if (runnerBaseline && actual.trace.length === previous.trace.length + 1) {
            assert.ok(['join-file', 'write', 'exec-sync'].includes(mode));
            assert.equal(actual.trace.at(-1)[0], 'remove');
            assert.deepEqual({ ...actual, trace: actual.trace.slice(0, -1) }, previous);
            intentionalChanges++;
          } else assert.deepEqual(actual, previous);
        } cases++;
      }
  const actual = await rootScenario(false); if (baseline) assert.deepEqual(actual, await rootScenario(true));
  if (runnerBaseline) assert.equal(intentionalChanges, 48, 'Only the three allocated-directory failure paths change');
  for (const mode of ['join-file', 'write', 'exec-sync']) for (const cleanupThrows of [false, true]) {
    await run('a'.repeat(9001), undefined, mode, 'unused', false, cleanupThrows);
    await rootScenario(false, mode, cleanupThrows);
  }
  console.log('Desktop input PowerShell runner passed: ' + cases + ' threshold/encoding/sync/deferred/error/cleanup cases, 6 failure/cleanup-error cases and 7 real-root controlled executions.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
