const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const sourcePath = path.join(__dirname, '../electron/localVoiceRuntimeWorkerUtils.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
function scenario(config, original = false) {
  const trace = [], counts = new Map(), failure = new Error('worker utility failure');
  function call(name, args, run) {
    trace.push([name, ...args]); const count = (counts.get(name) || 0) + 1; counts.set(name, count);
    if (name === config.fail && count === config.at) throw failure;
    return run();
  }
  function load(source) {
    const module = { exports: {} };
    vm.runInNewContext(source, { module, exports: module.exports,
      require: name => name === 'path' ? { join: (...args) => call('join', args, () => path.win32.join(...args)) }
        : load(fs.readFileSync(path.join(path.dirname(sourcePath), name), 'utf8')),
    });
    return module.exports;
  }
  const normalize = value => String(value || '').replace(/\\/g, '/').toLowerCase();
  const context = {
    bundledPythonPath: config.bundled || 'C:\\bundled\\python.exe',
    projectRoot: 'C:\\Project Space', runtimeRoot: 'C:\\runtime', portableExecutableDir: config.portable ? 'C:\\portable\\app\\bin' : '',
    getModeEnvDirectory: (root, mode) => call('env', [root, mode], () => path.win32.join(root, mode)),
    normalizeComparablePath: value => call('normalize', [value], () => normalize(value)),
    isPathInside: (target, directory) => call('inside', [target, directory], () => normalize(target).startsWith(normalize(directory) + '/')),
    describeRuntimeCandidate: candidate => call('describe', [candidate], () => candidate?.label || 'system'),
    splitOutputLines: text => call('split', [text], () => text.split('\n')),
    takeTail: (lines, count) => call('tail', [lines, count], () => lines.slice(-count)),
  };
  let result, error, keys;
  try {
    const api = load(original ? baseline : fs.readFileSync(sourcePath, 'utf8')).createLocalVoiceRuntimeWorkerUtils(context);
    keys = Object.keys(api);
    if (config.operation === 'environment') result = api.describeRuntimeEnvironment(config.candidate, config.executable);
    if (config.operation === 'protocol') {
      const payload = config.payload, parsed = config.parsed, candidate = { label: 'worker' };
      const requestResult = api.buildWorkerRequestResult({ candidate }, parsed);
      assert.equal(requestResult.candidate, candidate); assert.equal(requestResult.parsed, parsed);
      result = {
        request: api.buildWorkerRequestInput('request', payload),
        payload: api.summarizeWorkerPayload(payload), response: api.summarizeWorkerResponse(parsed),
        ready: api.buildWorkerReadyLogDetails(parsed, 'fallback-model'),
        model: api.getWorkerModeModelPath(config.mode, payload), id: api.getWorkerResponseRequestId(parsed),
        runner: api.parseRunnerPayload(config.args), exit: api.buildWorkerExitReason(config.exit, config.signal),
        key: api.buildModeWorkerKey(candidate, config.mode, 'model'),
        unavailable: api.createWorkerUnavailableError(mode => call('label', [mode], () => mode.toUpperCase()), config.mode, 'reason').message,
        requestResult,
      };
    }
  } catch (e) { error = e === failure ? 'original-error' : e.message; }
  return JSON.parse(JSON.stringify({ trace, result, error, keys }));
}
function compare(config) {
  const actual = scenario(config);
  if (baseline) assert.deepEqual(actual, scenario(config, true), JSON.stringify(config));
  if (actual.error !== undefined) assert.equal(actual.error, 'original-error');
  return actual;
}
const executables = ['C:\\runtime\\tts\\python.exe', 'C:\\runtime\\stt\\python.exe',
  'C:\\Project Space\\python\\python.exe', 'C:\\Project Space\\python-runtime\\python.exe',
  'C:\\portable\\app\\bin\\python\\python.exe', 'C:\\portable\\app\\python-runtime\\python.exe',
  'C:\\portable\\python\\python.exe', 'C:\\bundled\\python.exe', 'C:\\system\\python.exe', '', 'C:\\RUNTIME\\TTS\\python.exe'];
let environments = 0, protocols = 0;
for (const portable of [true, false]) for (const label of [undefined, 'venv-tts', 'manual', 'system']) {
  for (const executable of executables) {
    compare({ operation: 'environment', portable, candidate: { label }, executable }); environments++;
  }
}
for (const fail of ['env', 'join', 'normalize', 'inside']) for (const at of [1, 2, 3, 8]) {
  compare({ operation: 'environment', portable: true, executable: 'C:\\system\\python.exe', fail, at }); environments++;
}
const payloads = [null, 42, {}, { id: 'payload-id', text: '中文', reference_text: 'reference', tts_model_path: ' tts ', stt_model_path: ' stt ', prime_only: true, language_code: ' en ' }];
const responses = [null, {}, { ok: true, id: 'response', text: 'hello', model_path: ' model ', pid: 5,
  mime_type: ' audio/wav ', runtime_device: ' cuda ', sample_rate: 24000, load_attempt_index: 1, load_attempt_total: 2,
  traceback: 'a\nb\nc\nd\ne', prompt_cache_hit: false, primed: true },
{ ok: 1, id: 3, text: 4, mime_type: ' ', runtime_device: 4, sample_rate: Infinity, load_attempt_index: '2', traceback: ' ' }];
for (const payload of payloads) for (const parsed of responses) for (const mode of ['tts', 'stt', 'other']) {
  for (const args of [null, [], ['--text', 'a', '--text', 'b', '--seed', 2, '--trailing'], ['skip', '--ignored', '--language-code', 'en']]) {
    compare({ operation: 'protocol', payload, parsed, mode, args }); protocols++;
  }
}
for (const fail of ['describe', 'split', 'tail', 'label']) for (const at of [1, 2]) {
  compare({ operation: 'protocol', payload: payloads[3], parsed: responses[2], mode: 'tts', args: [], fail, at }); protocols++;
}
const isolated = compare({ operation: 'environment', candidate: { label: 'venv-local' }, executable: executables[7] });
assert.equal(isolated.result.kind, 'isolated');
assert.equal(isolated.trace.some(t => t[0] === 'inside'), false, 'venv label short circuits directory checks');
assert.equal(compare({ operation: 'environment', candidate: { label: 'manual' }, executable: executables[7] }).result.kind, 'bundled');
assert.equal(compare({ operation: 'environment', candidate: { label: 'manual' }, executable: executables[8] }).result.kind, 'manual');
const protocol = compare({ operation: 'protocol', payload: payloads[3], parsed: responses[2], mode: 'tts', args: ['--flag'], exit: null, signal: null });
assert.equal(JSON.parse(protocol.result.request).id, 'payload-id', 'payload keeps original id override');
assert.ok(protocol.result.request.endsWith('\n'));
assert.equal(protocol.result.model, 'tts');
assert.equal(protocol.result.response.traceback, 'b | c | d | e');
assert.deepEqual(protocol.result.runner, { flag: '' });
assert.equal(protocol.result.exit, 'exit_unknown_nosignal');
for (const name of ['WorkerUtils', 'WorkerEnvironment', 'WorkerProtocol']) {
  const file = path.join(__dirname, `../electron/localVoiceRuntime${name}.cjs`), source = fs.readFileSync(file, 'utf8');
  assert.ok(source.split('\n').length <= 300);
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function walk(n) {
    if (ts.isFunctionLike(n) && n.body) assert.ok(ast.getLineAndCharacterOfPosition(n.end).line - ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1 <= 50);
    ts.forEachChild(n, walk);
  }
  walk(ast);
}
console.log(`local voice worker utils: ${environments} environment/init/error and ${protocols} payload/response/runner/error cases passed${baseline ? ' against baseline' : ''}`);
