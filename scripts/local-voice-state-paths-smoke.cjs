const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sessionSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeSessionAssembly.cjs'), 'utf8');
const ts = require('typescript');
const { createLocalVoiceRuntimeState } = require('../electron/localVoiceRuntimeState.cjs');
const { createLocalVoiceRuntimePaths } = require('../electron/localVoiceRuntimePaths.cjs');
const pathsPath = path.join(__dirname, '../electron/localVoiceRuntimePaths.cjs');
const pathsSource = fs.readFileSync(pathsPath, 'utf8');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;

function oldState(context) {
  const a = baseline.indexOf('  const referenceTextCache ='), b = baseline.indexOf('  const writeRuntimeLog =', a);
  const c = baseline.indexOf('  function createSynthesisRequest()'), d = baseline.indexOf('  function ensureRunnerScriptPath()', c);
  assert.ok(a >= 0 && b > a && c >= 0 && d > c);
  return new Function('Date', 'AbortController', `${baseline.slice(a, b)} ${baseline.slice(c, d)}
    return { referenceTextCache, modeWorkerPool, brokenModeRuntimeCandidates, activeSynthesisRequests,
      createSynthesisRequest, nextTranscriptionRequestId: () => \`stt-\${++transcriptionSequence}\` };`,
  )({ now: context.now }, function Controller() { return context.createAbortController(); });
}

function stateScenario(config, old) {
  const trace = [], error = new Error('allocation failure');
  let clockCalls = 0, controllerCalls = 0;
  const context = {
    now() { trace.push(['now', ++clockCalls]); if (config.failClock === clockCalls) throw error; return clockCalls * 100; },
    createAbortController() {
      trace.push(['controller', ++controllerCalls]); if (config.failController === controllerCalls) throw error;
      return { marker: controllerCalls, signal: { aborted: false }, abort() { this.signal.aborted = true; } };
    },
  };
  const state = old ? oldState(context) : createLocalVoiceRuntimeState(context);
  assert.deepEqual(trace, []);
  const maps = ['referenceTextCache', 'modeWorkerPool', 'brokenModeRuntimeCandidates', 'activeSynthesisRequests'];
  for (const name of maps) assert.equal(state[name].size, 0);
  assert.equal(new Set(maps.map(name => state[name])).size, 4);
  const results = [];
  for (const operation of config.operations) {
    try {
      if (operation === 'stt') results.push(['stt', state.nextTranscriptionRequestId()]);
      else {
        const request = state.createSynthesisRequest();
        assert.equal(state.activeSynthesisRequests.get(request.id), request);
        request.controller.abort(); assert.equal(request.controller.signal.aborted, true);
        results.push(['tts', request.id, request.cancelReason, request.startedAt, request.controller.marker]);
        if (config.clearActive) state.activeSynthesisRequests.clear();
      }
    } catch (caught) { results.push(['failed', caught === error, caught.message]); }
  }
  return { trace, results, active: [...state.activeSynthesisRequests.keys()] };
}

function pathScenario(config, old) {
  const trace = [], error = new Error('path failure'); let joinCalls = 0;
  const app = { marker: 'app' }, projectRoot = 'project';
  const flavor = config.flavor === 'windows' ? path.win32 : path.posix;
  const fakePath = { join(...args) {
    trace.push(['join', args]); if (++joinCalls === config.failJoin) throw error; return flavor.join(...args);
  } };
  const resolver = input => {
    assert.equal(input.app, app); assert.equal(input.projectRoot, projectRoot); trace.push(['root']);
    if (config.failRoot) throw error; return config.root;
  };
  let result;
  try {
    if (old) {
      const a = baseline.indexOf('  const runtimeRoot = resolveRuntimeRoot('), b = baseline.indexOf('  const referenceTextCache =', a);
      assert.ok(a >= 0 && b > a);
      result = new Function('path', 'resolveRuntimeRoot', '__dirname', 'app', 'projectRoot', 'GENERATED_AUDIO_CACHE_MANIFEST_FILE',
        `${baseline.slice(a, b)}; return { runtimeRoot, embeddedRunnerPath, generatedAudioCacheRoot,
          generatedAudioManifestPath, referenceTextCachePath };`,
      )(fakePath, resolver, config.directory, app, projectRoot, config.manifest);
    } else {
      const loaded = { exports: {} };
      new Function('require', 'module', '__dirname', pathsSource)(name => {
        if (name === 'path') return fakePath;
        return { resolveRuntimeRoot: resolver };
      }, loaded, config.directory);
      result = loaded.exports.createLocalVoiceRuntimePaths({ app, projectRoot, generatedAudioManifestFile: config.manifest });
    }
  } catch (caught) { result = { failed: true, sameError: caught === error, message: caught.message }; }
  return { trace, result };
}

function realIsolation() {
  const first = createLocalVoiceRuntimeState(), second = createLocalVoiceRuntimeState();
  for (const name of ['referenceTextCache', 'modeWorkerPool', 'brokenModeRuntimeCandidates', 'activeSynthesisRequests']) {
    assert.notEqual(first[name], second[name]); first[name].set('sentinel', {}); assert.equal(second[name].size, 0);
  }
  const a = first.createSynthesisRequest(), b = second.createSynthesisRequest();
  assert.equal(a.id, 'tts-1'); assert.equal(b.id, 'tts-1'); assert.notEqual(a.controller, b.controller);
  a.controller.abort(); assert.equal(a.controller.signal.aborted, true); assert.equal(b.controller.signal.aborted, false);
  assert.equal(first.nextTranscriptionRequestId(), 'stt-1'); assert.equal(second.nextTranscriptionRequestId(), 'stt-1');
  assert.equal(first.createSynthesisRequest().id, 'tts-2');
  assert.equal(second.createSynthesisRequest().id, 'tts-2');
  const resolved = createLocalVoiceRuntimePaths({ app: { isPackaged: false }, projectRoot: 'controlled-project',
    generatedAudioManifestFile: 'manifest.jsonl' });
  assert.equal(resolved.generatedAudioCacheRoot, path.join(resolved.runtimeRoot, 'generated-audio-cache'));
  assert.equal(resolved.generatedAudioManifestPath, path.join(resolved.generatedAudioCacheRoot, 'manifest.jsonl'));
  assert.equal(resolved.referenceTextCachePath, path.join(resolved.runtimeRoot, 'reference-text-cache.json'));
  assert.equal(resolved.embeddedRunnerPath, path.join(__dirname, '../electron/local_voice_runner.py'));
}

function structure() {
  for (const file of ['localVoiceRuntimeState.cjs', 'localVoiceRuntimePaths.cjs']) {
    const p = path.join(__dirname, '../electron', file), s = fs.readFileSync(p, 'utf8');
    assert.ok(s.split('\n').length <= 300);
    const ast = ts.createSourceFile(p, s, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    function visit(n) {
      if (ts.isFunctionDeclaration(n) && n.body) assert.ok(
        ast.getLineAndCharacterOfPosition(n.end).line - ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1 <= 50);
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
  const root = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntime.cjs'), 'utf8');
  assert.match(root, /createLocalVoiceSessionAssembly\(\{/);
  assert.match(sessionSource, /createLocalVoiceRuntimeState\(\)/); assert.match(root, /createLocalVoiceRuntimePaths\(\{/);
  assert.doesNotMatch(root, /new Map\(|synthesisSequence|transcriptionSequence/);
  assert.ok(root.indexOf('createLocalVoiceRuntimePaths({') < root.indexOf('createLocalVoiceSessionAssembly({'));
  assert.ok(sessionSource.indexOf('createLocalVoiceRuntimeState()') < sessionSource.indexOf('createRuntimeLogger(log)'));
}

structure(); let stateCount = 0, pathCount = 0;
for (const operations of [[], ['tts'], ['stt'], ['tts', 'stt', 'tts', 'stt', 'tts'], ['stt', 'tts', 'stt', 'tts']]) {
  for (const failClock of [undefined, 1, 2]) for (const failController of [undefined, 1, 2]) for (const clearActive of [false, true]) {
    const config = { operations, failClock, failController, clearActive };
    const actual = stateScenario(config); if (baseline) assert.deepEqual(actual, stateScenario(config, true)); stateCount++;
  }
}
for (const flavor of ['windows', 'posix']) for (const root of ['', 'runtime', 'C:\\Voice Space\\运行环境']) {
  for (const directory of ['electron', 'C:\\App Space\\electron']) for (const manifest of ['manifest.jsonl', undefined]) {
    const config = { flavor, root, directory, manifest };
    const actual = pathScenario(config); if (baseline) assert.deepEqual(actual, pathScenario(config, true)); pathCount++;
  }
}
for (const failJoin of [undefined, 1, 2, 3, 4]) for (const failRoot of [false, true]) {
  const config = { flavor: 'windows', root: 'runtime', directory: 'electron', manifest: 'manifest.jsonl', failJoin, failRoot };
  const actual = pathScenario(config); if (baseline) assert.deepEqual(actual, pathScenario(config, true)); pathCount++;
}
realIsolation();
console.log(`local voice state/paths: ${stateCount} request/map and ${pathCount} path/order/error cases, real instance isolation passed${baseline ? ' against baseline' : ''}`);
