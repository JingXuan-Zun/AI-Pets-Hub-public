const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const runnerFile = path.resolve(__dirname, '../electron/capture/powerShellRunner.cjs');
const nativeReaderFile = path.resolve(__dirname, '../electron/capture/nativeReaders.cjs');
const results = require('../electron/capture/nativeResults.cjs');
const filters = require('../electron/captureSourceFilters.cjs');
const current = fs.readFileSync(rootFile, 'utf8');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
let cases = 0;
function declaration(text, name) {
  const ast = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
  const factory = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  return factory.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name).getText(ast);
}
async function runProcess(pathApi, script, optionKind, mode, original, throughRoot = false) {
  const trace = [];
  const error = mode === 'frozen-error' ? Object.freeze(new Error('process failed')) : new Error('process failed');
  const deps = {
    path: pathApi,
    app: { getPath(name) { trace.push(['getPath', name]); if (mode === 'path-error') throw Error('path'); return pathApi === path.win32 ? 'C:\\temp' : '/temp'; } },
    fs: {
      writeFileSync(...args) { trace.push(['write', ...args]); if (mode === 'write-error') throw Error('write'); },
      unlink(target, callback) { trace.push(['unlink', target]); if (mode === 'unlink-error') throw Error('unlink'); callback(mode === 'unlink-callback-error' ? Error('ignored cleanup') : null); },
    },
    execFile(command, args, options, callback) {
      trace.push(['exec', command, args, options]);
      if (mode === 'exec-throw') throw Error('exec');
      if (mode === 'deferred') { deps.release = () => callback(null, '中文 output', 'diagnostic'); return; }
      callback(['process-error', 'frozen-error'].includes(mode) ? error : null, '中文 output', 'diagnostic');
      if (mode === 'repeat') callback(Error('late error'), 'late', 'late diagnostic');
    },
  };
  const optionTrace = [];
  const options = optionKind === 'defaults' ? undefined : optionKind === 'null' ? null : optionKind === 'sta' ? { sta: true }
    : optionKind === 'zero' ? { timeout: 0, maxBuffer: 0 }
      : optionKind === 'raw' ? { sta: 'yes', timeout: null, maxBuffer: -1 }
        : { get sta() { optionTrace.push('sta'); return false; }, get timeout() { optionTrace.push('timeout'); return 37; }, get maxBuffer() { optionTrace.push('maxBuffer'); return 91; } };
  const env = { process: { pid: 42 }, Date: { now: () => 123456 }, Math: { random: () => 0.25, round: Math.round } };
  let run;
  if (throughRoot) {
    const runnerModule = { exports: {} };
    new Function('process', 'Date', 'Math', 'module', fs.readFileSync(runnerFile, 'utf8'))(env.process, env.Date, env.Math, runnerModule);
    const loaded = new Map();
    function load(file) {
      if (file === runnerFile) return runnerModule.exports;
      if (loaded.has(file)) return loaded.get(file).exports;
      const module = { exports: {} }; loaded.set(file, module);
      new Function('require', 'module', 'exports', 'process', 'Date', 'Math',
        file === rootFile ? original ? baseline : current : fs.readFileSync(file, 'utf8'))(id => {
        if (id === 'electron') return { app: deps.app };
        if (id === 'child_process') return { execFile: deps.execFile };
        if (id === 'fs') return deps.fs;
        if (id === 'path') return deps.path;
        assert.ok(id.startsWith('./')); return load(path.resolve(path.dirname(file), id));
      }, module, module.exports, env.process, env.Date, env.Math);
      return module.exports;
    }
    const { createCaptureService } = load(rootFile);
    const first = createCaptureService();
    const second = createCaptureService();
    assert.notEqual(first.runTemporaryPowerShellScript, second.runTemporaryPowerShellScript);
    run = first.runTemporaryPowerShellScript;
  } else if (original && /function runTemporaryPowerShellScript\(/.test(baseline)) {
    run = new Function('deps', 'env', `const { app, execFile, fs, path } = deps; const { process, Date, Math } = env;
      ${declaration(baseline, 'runTemporaryPowerShellScript')}; return runTemporaryPowerShellScript;`)(deps, env);
  } else {
    const module = { exports: {} };
    new Function('process', 'Date', 'Math', 'module', fs.readFileSync(runnerFile, 'utf8'))(env.process, env.Date, env.Math, module);
    run = module.exports.createCapturePowerShellRunner(deps);
    assert.notEqual(run, module.exports.createCapturePowerShellRunner(deps), 'Runner identity is per instance');
  }
  let pending;
  try { pending = run(script, options); }
  catch (error) { return { phase: 'sync', error: error.message, trace, optionTrace }; }
  if (deps.release) {
    assert.ok(!trace.some(entry => entry[0] === 'unlink')); trace.push(['release']); deps.release();
  }
  try { return { phase: 'fulfilled', value: await pending, trace, optionTrace }; }
  catch (error) { return { phase: 'rejected', error: error.message, stderr: error.stderr, trace, optionTrace }; }
}

async function runNative(name, stdout, platform, failure, original) {
  const trace = [];
  const deps = { ...results, ...filters,
    process: { platform }, Date: { now: () => 456 },
    getOwnCaptureWindowTitleSet: () => { trace.push(['own']); return new Set(['own app']); },
    getNativeDisplayBoundsPowerShellScript: () => 'display script',
    getNativeScreenPreviewPowerShellScript: displays => { trace.push(['preview-script', displays]); return 'preview script'; },
    getNativeWindowCaptureSourcesPowerShellScript: options => { trace.push(['window-script', options]); return 'window script'; },
    async runTemporaryPowerShellScript(script, options) { trace.push(['temporary', script, options]); if (failure) throw Error('process'); return stdout; },
    execFile(command, args, options, callback) { trace.push(['command', command, args, options]); callback(failure ? Error('process') : null, stdout); },
  };
  const api = original && baseline.includes('async function ' + name + '(') ? new Function('deps', `const { ${Object.keys(deps).join(',')} } = deps;
    ${declaration(original ? baseline : current, name)}
    return { run: ${name} };`)(deps)
    : { run: require(nativeReaderFile).createCaptureNativeReaders(deps)[name] };
  const options = name === 'getNativeScreenPreviewMap' ? [{ id: '1', width: 1920, height: 1080 }]
    : name === 'getNativeWindowCaptureSources' ? { includeThumbnails: false, sourceId: 'window:1' } : undefined;
  const result = await api.run(options);
  const value = result instanceof Map || result instanceof Set ? [...result] : result;
  return { value, trace };
}

async function main() {
  for (const pathApi of [path.win32, path.posix]) {
    for (const script of ['', 'Write-Output "中文"', Buffer.from('buffer script'), null]) {
      for (const option of ['defaults', 'null', 'sta', 'zero', 'raw', 'getters']) {
        for (const mode of ['normal', 'path-error', 'write-error', 'exec-throw', 'process-error', 'frozen-error', 'unlink-error', 'unlink-callback-error', 'deferred', 'repeat']) {
          const actual = await runProcess(pathApi, script, option, mode, false);
          if (baseline) assert.deepEqual(actual, await runProcess(pathApi, script, option, mode, true));
          assert.deepEqual(actual, await runProcess(pathApi, script, option, mode, false, true));
          if (baseline) assert.deepEqual(actual, await runProcess(pathApi, script, option, mode, true, true));
          if (mode === 'normal' && option !== 'null') {
            assert.equal(actual.value, '中文 output');
            const exec = actual.trace.find(entry => entry[0] === 'exec');
            assert.equal(exec[1], 'powershell.exe'); assert.equal(exec[3].windowsHide, true);
            assert.equal(exec[2].includes('-STA'), ['sta', 'raw'].includes(option));
            assert.equal(actual.trace.at(-1)[0], 'unlink');
          }
          if (mode === 'write-error' && option !== 'null') assert.equal(actual.phase, 'sync');
          if (mode === 'exec-throw' && option !== 'null') {
            assert.equal(actual.phase, 'rejected'); assert.ok(!actual.trace.some(entry => entry[0] === 'unlink'));
          }
          if (mode === 'process-error' && option !== 'null') assert.equal(actual.stderr, 'diagnostic');
          cases++;
        }
      }
    }
  }
  const outputs = [undefined, null, '', ' ', 'invalid json', 'null', 'true', '0', '"中文窗口"', '{}', '[]',
    JSON.stringify({ deviceName: 'Display 1', isPrimary: true, x: -1920.5, y: 1.5, width: 0, height: 1080.2 }),
    JSON.stringify([{ x: 'invalid', width: 'invalid', height: 1 }, { width: -1, height: 0 }]),
    JSON.stringify([' App ', 'App', '', null]),
    JSON.stringify([{ displayId: 1, thumbnail: 'one' }, { displayId: 1, thumbnail: 'two' }, { displayId: 0, thumbnail: 'skip' }]),
    JSON.stringify([{ id: 'window:1', name: 'Other app', type: 'window', thumbnail: '' }, { id: 'window:2', name: 'own app' }]),
  ];
  for (const name of ['getNativeDisplayBounds', 'getNativeScreenPreviewMap', 'getNativeWindowCaptureSources']) {
    for (const stdout of outputs) for (const platform of ['win32', 'linux']) for (const failure of [false, true]) {
      const actual = await runNative(name, stdout, platform, failure, false);
      if (baseline) assert.deepEqual(actual, await runNative(name, stdout, platform, failure, true));
      if (platform === 'linux') assert.equal(actual.trace.length, 0);
      if (failure && platform === 'win32') assert.deepEqual(actual.value, []);
      cases++;
    }
  }
  assert.equal(results.parseNativeDisplayBounds('{"width":0,"height":0}')[0].width, 1);
  assert.deepEqual([...results.parseNativeScreenPreviews('[{"displayId":1,"thumbnail":"a"},{"displayId":1,"thumbnail":"b"}]')], [['1', 'b']]);
  assert.throws(() => results.readNativeResultList('invalid json'), SyntaxError);
  for (const file of [runnerFile, nativeReaderFile, path.resolve(__dirname, '../electron/capture/nativeResults.cjs')]) {
    const text = fs.readFileSync(file, 'utf8'); assert.ok(text.split('\n').length <= 300);
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    for (const node of ast.statements.filter(ts.isFunctionDeclaration)) assert.ok(ast.getLineAndCharacterOfPosition(node.end).line
      - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50, node.name.text);
  }
  console.log(`Capture native bridge passed: ${cases} process/output scenarios; sync throws, rejections, cleanup, options, parsing and platform fallbacks.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
