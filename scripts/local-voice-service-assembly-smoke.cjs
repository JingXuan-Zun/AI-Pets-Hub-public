const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sessionSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeSessionAssembly.cjs'), 'utf8');
const { createRequire } = require('node:module');
const ts = require('typescript');
const modulePath = path.join(__dirname, '../electron/localVoiceRuntimeServiceAssembly.cjs');
const source = fs.readFileSync(modulePath, 'utf8');
const { createLocalVoiceServiceAssembly } = require(modulePath);
const groups = [['warmup'], ['ensureVenv', 'installModeDependencies'], ['installDependencies'], ['synthesize'], ['transcribe']];
const exportsList = ['warmup', 'installDependencies', 'synthesize', 'transcribe'];
const factoryNames = ['createLocalVoiceRuntimeWarmup', 'createLocalVoiceInstallSteps', 'createLocalVoiceInstaller',
  'createLocalVoiceSynthesis', 'createLocalVoiceTranscription'];

function loadBaseline(file) {
  const root = fs.readFileSync(file, 'utf8');
  const a = root.indexOf('  const { warmup }'), b = root.indexOf("  cleanupGeneratedAudioCache('startup');", a);
  assert.ok(a >= 0 && b > a);
  return context => new Function(...Object.keys(context),
    `let transcriptionSequence = 0; ${root.slice(a, b)} return { ${exportsList.join(', ')} };`,
  )(...Object.values(context));
}

function controlled(context, failIndex, baseline) {
  let nextId;
  const trace = [], tokens = new Map(), failure = new Error('assembly failed');
  const factories = Object.fromEntries(factoryNames.map((name, index) => [name, input => {
    const normalized = {};
    for (const [key, value] of Object.entries(input)) {
      const expectedKey = key;
      if (key === 'nextTranscriptionRequestId') { assert.equal(typeof value, 'function'); nextId = value; normalized[key] = key; continue; }
      assert.equal(value, tokens.get(key) ?? context[expectedKey], `dependency identity: ${name}.${key}`);
      normalized[key] = tokens.has(key) ? `output:${key}` : expectedKey;
    }
    trace.push([name, normalized]);
    if (index === failIndex) throw failure;
    return Object.fromEntries(groups[index].map(key => {
      const token = () => key; tokens.set(key, token); return [key, token];
    }));
  }]));
  let result;
  try {
    if (baseline) result = baseline({ ...context, ...factories });
    else {
      const loaded = { exports: {} };
      const realRequire = createRequire(modulePath);
      new Function('require', 'module', source)(name => {
        if (/localVoiceRuntime(Warmup|InstallSteps|Installer|Synthesis|Transcription)/.test(name)) return factories;
        return realRequire(name);
      }, loaded);
      result = loaded.exports.createLocalVoiceServiceAssembly(context);
    }
    assert.deepEqual(Object.keys(result), exportsList);
    for (const [key, value] of Object.entries(result)) assert.equal(value, tokens.get(key));
  } catch (error) {
    assert.equal(error, failure); result = { failed: true };
  }
  assert.equal(trace.length, failIndex < 0 ? 5 : failIndex + 1);
  if (failIndex < 0) assert.deepEqual([nextId(), nextId()], ['stt-1', 'stt-2']);
  return { trace, result: result.failed ? result : Object.keys(result) };
}

async function realIsolation() {
  const instances = [];
  for (const tag of ['A', 'B']) {
    const active = new Map(), files = new Map(), logs = [], broken = new Map([['old', 'broken']]);
    let synthesisSequence = 0, transcriptionSequence = 0;
    const root = path.join(__dirname, 'controlled-' + tag);
    const assets = { ttsModel: null, sttModel: null, reference: null, referenceAudioPath: '' };
    const cached = { cacheHit: true, tag };
    const fileSystem = { writeFileSync: (target, data) => files.set(target, data.toString()),
      unlinkSync: target => files.delete(target) };
    const realRequire = createRequire(modulePath), loaded = { exports: {} };
    new Function('require', 'module', source)(name => {
      const real = realRequire(name);
      if (name.endsWith('localVoiceRuntimeTranscription.cjs')) return {
        createLocalVoiceTranscription: context => real.createLocalVoiceTranscription({ ...context, fs: fileSystem }),
      };
      return real;
    }, loaded);
    const context = { runtimeRoot: root, generatedAudioCacheRoot: root,
      activeSynthesisRequests: active, brokenModeRuntimeCandidates: broken,
      writeRuntimeLog: (...args) => logs.push(args),
      resolveAssetSelection: () => assets, getConfiguredReferenceText: () => ({ referenceText: '', source: 'test' }),
      warmupModeWorker: () => { throw new Error('unexpected warmup worker'); },
      ensureReferenceTextPrepared: async () => ({ referenceText: 'reference', source: 'test' }),
      requestModeWorker: () => { throw new Error('unexpected worker request'); },
      runRunnerCommand: async input => {
        assert.equal(input.mode, 'stt'); assert.equal(input.extraArgs[1], path.join(root, 'stt-input-stt-1.wav'));
        assert.equal(files.get(input.extraArgs[1]), 'audio-' + tag);
        return { ok: true, parsed: { ok: true, text: ' transcript-' + tag + ' ' } };
      },
      pathExists: () => { throw new Error('unexpected installation path read'); }, ensureDir() {},
      spawnCommand: () => { throw new Error('unexpected Python spawn'); }, getSharedOptions: () => ({}),
      resolveBasePythonRuntime: async () => { throw new Error('controlled no Python'); },
      runInlinePythonScript: () => { throw new Error('unexpected inline Python'); },
      getHealth: () => { throw new Error('unexpected health check'); },
      createSynthesisRequest() {
        const request = { id: 'tts-' + ++synthesisSequence, controller: new AbortController(), startedAt: Date.now(), cancelReason: 'active' };
        active.set(request.id, request); return request;
      },
      cleanupGeneratedAudioCacheBeforeSynthesize() {}, buildGeneratedAudioCacheKey: () => 'cache-' + tag,
      resolveGeneratedAudioCacheHit: () => cached, getGeneratedAudioCacheFilePath: () => { throw new Error('unexpected cache path'); },
      persistGeneratedAudioCache: () => { throw new Error('unexpected cache write'); },
      nextTranscriptionRequestId: () => 'stt-' + ++transcriptionSequence,
    };
    const api = loaded.exports.createLocalVoiceServiceAssembly(context);
    assert.deepEqual(logs, []); assert.equal(files.size, 0); assert.equal(active.size, 0); assert.equal(broken.size, 1);
    const warmup = await api.warmup({ ttsProvider: 'api', sttProvider: 'api' });
    assert.equal(warmup.ok, false);
    const install = await api.installDependencies({});
    assert.equal(install.ok, false); assert.equal(install.executable, null); assert.equal(broken.size, 0);
    assets.ttsModel = { path: 'tts' }; assets.reference = { path: 'reference' }; assets.referenceAudioPath = 'audio';
    assert.equal(await api.synthesize({ text: 'text-' + tag }), cached); assert.equal(active.size, 0);
    assets.sttModel = { path: 'stt' };
    assert.deepEqual(await api.transcribe({ audioBase64: Buffer.from('audio-' + tag).toString('base64') }), { text: 'transcript-' + tag });
    assert.equal(files.size, 0); assert.equal(synthesisSequence, 1); assert.equal(transcriptionSequence, 1);
    instances.push({ api, active, files, cached });
  }
  assert.notEqual(instances[0].cached, instances[1].cached);
  assert.notEqual(instances[0].active, instances[1].active);
  assert.notEqual(instances[0].files, instances[1].files);
}

function structure() {
  const stateSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeState.cjs'), 'utf8');
  assert.ok(source.split('\n').length <= 300);
  const ast = ts.createSourceFile(modulePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.body) assert.ok(
      ast.getLineAndCharacterOfPosition(node.end).line - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const root = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntime.cjs'), 'utf8');
  assert.match(root, /createLocalVoiceServiceAssembly\(\{/);
  for (const name of factoryNames) assert.ok(!root.includes(`${name}(`));
  assert.match(root, /createLocalVoiceSessionAssembly\(\{/u);
  assert.match(sessionSource, /createLocalVoiceRuntimeState\(\)/u);
  assert.match(stateSource, /const activeSynthesisRequests = new Map\(\)/);
}

async function main() {
  structure();
  const baseline = process.argv[2] ? loadBaseline(process.argv[2]) : null;
  for (const suffix of ['A', 'B']) {
    const context = Object.fromEntries(['resolveAssetSelection', 'getConfiguredReferenceText', 'writeRuntimeLog',
      'warmupModeWorker', 'ensureReferenceTextPrepared', 'runRunnerCommand', 'requestModeWorker', 'runtimeRoot',
      'pathExists', 'ensureDir', 'spawnCommand', 'getSharedOptions', 'brokenModeRuntimeCandidates',
      'resolveBasePythonRuntime', 'runInlinePythonScript', 'getHealth', 'createSynthesisRequest',
      'activeSynthesisRequests', 'cleanupGeneratedAudioCacheBeforeSynthesize', 'buildGeneratedAudioCacheKey',
      'resolveGeneratedAudioCacheHit', 'getGeneratedAudioCacheFilePath', 'generatedAudioCacheRoot', 'persistGeneratedAudioCache']
      .map(name => [name, { name, suffix }]));
    let sequence = 0; context.nextTranscriptionRequestId = () => 'stt-' + ++sequence;
    for (const failIndex of [-1, 0, 1, 2, 3, 4]) {
      const actual = controlled(context, failIndex);
      if (baseline) assert.deepEqual(actual, controlled(context, failIndex, baseline));
    }
  }
  await realIsolation();
  console.log('local voice service assembly: 12 dependency/order/failure cases and real two-instance warmup/install/synthesis/transcription integration passed' + (baseline ? ' against baseline' : ''));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
