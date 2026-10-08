const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sessionSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeSessionAssembly.cjs'), 'utf8');
const { createRequire } = require('node:module');
const ts = require('typescript');
const backendSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeBackendAssembly.cjs'), 'utf8');
const modulePath = path.join(__dirname, '../electron/localVoiceRuntimeSupportAssembly.cjs');
const source = fs.readFileSync(modulePath, 'utf8');
const { createLocalVoiceSupportAssembly } = require(modulePath);
const groups = [
  ['getFallbackRuntimeCandidates', 'getModeRuntimeCandidates'],
  ['buildLocalVoiceHealth', 'buildUnavailableModeProbeResult', 'normalizeModeProbeRuntime'],
  ['resolveBasePythonRuntime', 'getHealth'], ['ensureReferenceTextPrepared'],
];
const exportsList = [...groups[0], ...groups[2], ...groups[3]];
const factoryNames = ['createLocalVoiceRuntimeCandidateUtils', 'createLocalVoiceRuntimeStatusUtils',
  'createLocalVoiceRuntimeDiagnostics', 'createLocalVoiceRuntimeReferenceTextUtils'];

function loadBaseline(file) {
  const root = fs.readFileSync(file, 'utf8');
  const a = root.indexOf('  const {\n    getFallbackRuntimeCandidates,'), b = root.indexOf('  const { warmup }', a);
  assert.ok(a >= 0 && b > a);
  return context => new Function(...Object.keys(context),
    `${root.slice(a, b)} return { ${exportsList.join(', ')} };`,
  )(...Object.values(context));
}

function controlled(context, failIndex, baseline) {
  const trace = [], tokens = new Map(), failure = new Error('assembly failed');
  const factories = Object.fromEntries(factoryNames.map((name, index) => [name, input => {
    const normalized = {};
    for (const [key, value] of Object.entries(input)) {
      const expectedKey = key;
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
        if (/localVoiceRuntime(CandidateUtils|StatusUtils|Diagnostics|ReferenceTextUtils)/.test(name)) return factories;
        return realRequire(name);
      }, loaded);
      result = loaded.exports.createLocalVoiceSupportAssembly(context);
    }
    assert.deepEqual(Object.keys(result), exportsList);
    for (const [key, value] of Object.entries(result)) assert.equal(value, tokens.get(key));
  } catch (error) {
    assert.equal(error, failure); result = { failed: true };
  }
  assert.equal(trace.length, failIndex < 0 ? 4 : failIndex + 1);
  return { trace, result: result.failed ? result : Object.keys(result) };
}

async function realIsolation() {
  const paths = require('../electron/localVoiceRuntimePathUtils.cjs');
  const processUtils = require('../electron/localVoiceRuntimeProcessUtils.cjs');
  const modeUtils = require('../electron/localVoiceRuntimeModeUtils.cjs');
  const instances = [];
  for (const tag of ['A', 'B']) {
    const cache = new Map(), broken = new Map(), trace = [];
    const bad = { label: 'bad', executable: 'bad.exe', args: [] };
    const good = { label: 'good', executable: 'good.exe', args: [] };
    const modes = { tts: { label: 'venv-tts', executable: 'tts.exe', args: [] },
      stt: { label: 'venv-stt', executable: 'stt.exe', args: [] } };
    broken.set('tts:venv-tts', { message: 'controlled existing failure' });
    const settings = { localVoiceRuntimePath: ' configured ', ttsProvider: 'local', sttProvider: 'local' };
    const assets = { catalog: { rootPath: 'controlled-models' }, ttsModel: { path: 'tts' }, sttModel: { path: 'stt' }, reference: { path: 'ref' },
      referenceAudioPath: 'audio.wav', referenceTextFromFiles: '', referenceTextFromAudioFileName: '' };
    const api = createLocalVoiceSupportAssembly({ ...processUtils, ...modeUtils,
      uniqueStrings: paths.uniqueStrings, describeRuntimeCandidate: candidate => candidate.label,
      getPythonCandidates: value => { assert.equal(value, 'configured'); return [bad, good]; },
      getModeCandidate: (_, mode) => modes[mode], runtimeRoot: 'runtime', projectRoot: 'project',
      getBrokenModeRuntimeCandidate: (mode, candidate) => broken.get(mode + ':' + candidate.label),
      markBrokenModeRuntimeCandidate: (mode, candidate, error) => broken.set(mode + ':' + candidate.label, { message: error.message }),
      buildReferenceTextCacheKey: () => 'reference-key', referenceTextCache: cache,
      readPersistedReferenceText: () => 'reference-' + tag,
      persistReferenceText: () => { throw new Error('unexpected reference write'); },
      getConfiguredReferenceText: () => ({ referenceText: '', source: 'configured' }),
      getSharedOptions: () => ({ cwd: 'runtime' }), describeRuntimeEnvironment: () => ({ kind: 'test', message: 'controlled' }),
      resolveAssetSelection: () => assets, writeRuntimeLog: (...args) => trace.push(['log', ...args]),
      spawnCommand: async candidate => {
        trace.push(['base', candidate.label]);
        return candidate === bad ? { ok: false, stderr: 'base failure', stdout: '' } : { ok: true, stdout: 'resolved.exe' };
      },
      runInlinePythonScript: async candidate => {
        trace.push(['probe', candidate.label]);
        return candidate === bad ? { ok: false, stderr: 'probe failure', stdout: '' } : { ok: true,
          stdout: JSON.stringify({ missing_packages: [], detected_packages: [], executable: candidate.executable, device: 'cpu' }) };
      },
    });
    assert.deepEqual(trace, []);
    assert.deepEqual(api.getModeRuntimeCandidates(settings, 'tts'), [bad, good]);
    const base = await api.resolveBasePythonRuntime(settings);
    assert.equal(base.candidate, good); assert.equal(base.executable, 'resolved.exe');
    const health = await api.getHealth(settings);
    assert.equal(health.status, 'ready'); assert.equal(health.ttsReady, true); assert.equal(health.sttReady, true);
    assert.deepEqual(trace.filter(item => item[0] === 'base').map(item => item[1]), ['bad', 'good']);
    assert.deepEqual(trace.filter(item => item[0] === 'probe').map(item => item[1]), ['bad', 'good', 'venv-stt']);
    const input = { assetSelection: assets, settings, requestId: tag,
      runRunnerCommand: () => { throw new Error('unexpected worker request'); } };
    const first = await api.ensureReferenceTextPrepared(input);
    assert.deepEqual(first, { referenceText: 'reference-' + tag, source: 'persistent-cache' });
    const second = await api.ensureReferenceTextPrepared(input);
    assert.deepEqual(second, { referenceText: 'reference-' + tag, source: 'cache' });
    assert.equal(cache.get('reference-key'), 'reference-' + tag);
    instances.push({ cache, broken });
  }
  instances[0].cache.clear();
  assert.equal(instances[1].cache.get('reference-key'), 'reference-B');
  assert.notEqual(instances[0].broken, instances[1].broken);
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
  assert.match(root, /createLocalVoiceBackendAssembly\(\{/);
  assert.match(backendSource, /createLocalVoiceSupportAssembly\(\{/);
  for (const name of factoryNames) assert.ok(!root.includes(`${name}(`));
  assert.match(root, /createLocalVoiceSessionAssembly\(\{/u);
  assert.match(sessionSource, /createLocalVoiceRuntimeState\(\)/u);
  assert.match(stateSource, /const referenceTextCache = new Map\(\)/);
}

async function main() {
  structure();
  const baseline = process.argv[2] ? loadBaseline(process.argv[2]) : null;
  for (const suffix of ['A', 'B']) {
    const context = Object.fromEntries(['describeRuntimeCandidate', 'getBrokenModeRuntimeCandidate', 'getModeCandidate',
      'getModeLabel', 'getPythonCandidates', 'projectRoot', 'runtimeRoot', 'writeRuntimeLog', 'buildJsonError',
      'buildReferenceTextCacheKey', 'extractMissingModuleName', 'readPersistedReferenceText', 'uniqueStrings',
      'spawnCommand', 'runInlinePythonScript', 'getSharedOptions', 'describeRuntimeEnvironment',
      'markBrokenModeRuntimeCandidate', 'resolveAssetSelection', 'getConfiguredReferenceText',
      'persistReferenceText', 'referenceTextCache'].map(name => [name, { name, suffix }]));
    for (const failIndex of [-1, 0, 1, 2, 3]) {
      const actual = controlled(context, failIndex);
      if (baseline) assert.deepEqual(actual, controlled(context, failIndex, baseline));
    }
  }
  await realIsolation();
  console.log('local voice support assembly: 10 dependency/order/failure cases and real two-instance candidate/health/reference integration passed' + (baseline ? ' against baseline' : ''));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
