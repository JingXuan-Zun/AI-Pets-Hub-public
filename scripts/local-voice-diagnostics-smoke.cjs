const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const backendSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeBackendAssembly.cjs'), 'utf8');
const { createLocalVoiceRuntimeDiagnostics } = require('../electron/localVoiceRuntimeDiagnostics.cjs');
const { createLocalVoiceRuntimeStatusUtils } = require('../electron/localVoiceRuntimeStatusUtils.cjs');
const command = require('../electron/localVoiceRuntimeCommandUtils.cjs');
const execution = require('../electron/localVoiceRuntimeExecutionUtils.cjs');
const modes = require('../electron/localVoiceRuntimeModeUtils.cjs');
const processUtils = require('../electron/localVoiceRuntimeProcessUtils.cjs');
const { uniqueStrings } = require('../electron/localVoiceRuntimePathUtils.cjs');
const rootSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntime.cjs'), 'utf8');
const assemblySource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeSupportAssembly.cjs'), 'utf8');
const names = ['resolveBasePythonRuntime', 'probeModeRuntime', 'getHealth'];

function loadBaseline(file) {
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const found = new Map();
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) found.set(node.name.text, node.getText());
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(found.size, 3);
  return (dependencies) => new Function(...Object.keys(dependencies),
    `${names.map((name) => found.get(name)).join('\n')}; return { ${names.join(',')} };`,
  )(...Object.values(dependencies));
}

function commandResult(type, candidate, base) {
  const error = new Error(type === 'enoent' ? 'missing_executable' : 'command_failure');
  if (type === 'enoent') error.code = 'ENOENT';
  if (type === 'throw') throw error;
  if (type === 'enoent' || type === 'fail') return { ok: false, error, stdout: '', stderr: type === 'fail' ? 'failure text' : '' };
  if (type === 'empty') return { ok: true, stdout: '  ', stderr: '', error: null };
  if (type === 'badjson') return { ok: true, stdout: '{bad', stderr: '', error: null };
  if (base) return { ok: true, stdout: type === 'blank-base' ? '' : 'banner\nactual-python.exe\n', stderr: '', error: null };
  return { ok: true, error: null, stderr: '', stdout: JSON.stringify({
    executable: candidate.executable, python_version: '3.11', device: type === 'gpu' ? 'cuda' : 'cpu',
    detected_packages: ['torch'], missing_packages: type === 'missing-package' ? ['torchaudio'] : [],
    import_error: type === 'import-error' ? "No module named 'voice_dependency'" : '',
  }) };
}

function createHarness(plans, assetsPresent, fault, baseline) {
  const trace = [];
  const candidates = Object.fromEntries(['base', 'tts', 'stt'].map((mode) => [mode,
    plans[mode].map((type, index) => ({ executable: `${mode}-${index}.exe`, args: [], mode, type }))]));
  const assets = { catalog: { rootPath: assetsPresent ? 'voice-root' : null },
    ttsModel: assetsPresent ? { path: 'tts-model' } : null, sttModel: assetsPresent ? { path: 'stt-model' } : null,
    reference: assetsPresent ? { path: 'reference' } : null,
    referenceAudioPath: assetsPresent ? 'reference.wav' : '', referenceTextFromFiles: '', referenceTextFromAudioFileName: '' };
  const getModeRuntimeCandidates = (settings, mode) => {
    trace.push(['candidates', mode, settings]); return candidates[mode];
  };
  const status = createLocalVoiceRuntimeStatusUtils({
    buildJsonError: processUtils.buildJsonError, buildReferenceTextCacheKey: (...args) => args.join('|'),
    describeRuntimeCandidate: (candidate) => candidate.executable,
    extractMissingModuleName: processUtils.extractMissingModuleName, getModeRuntimeCandidates,
    readPersistedReferenceText: (key) => { trace.push(['reference-cache', key]); return ''; },
    runtimeRoot: 'runtime-root', uniqueStrings,
  });
  const dependencies = { ...command, ...execution, ...modes, ...status,
    getModeRuntimeCandidates,
    getFallbackRuntimeCandidates: (settings) => { trace.push(['base-candidates', settings]); return candidates.base; },
    getSharedOptions: () => { trace.push(['options']); return { cwd: 'cwd', env: { VOICE: '1' } }; },
    spawnCommand: async (candidate, args, options) => {
      trace.push(['spawn', candidate.executable, args, options]); return commandResult(candidate.type, candidate, true);
    },
    runInlinePythonScript: async (candidate, script, options) => {
      trace.push(['inline', candidate.mode, candidate.executable,
        crypto.createHash('sha256').update(script).digest('hex'), options]);
      return commandResult(candidate.type, candidate, false);
    },
    describeRuntimeEnvironment: () => ({ kind: 'test', message: 'test environment' }),
    markBrokenModeRuntimeCandidate: (mode, candidate, error) => trace.push(['broken', mode, candidate.executable, error.message]),
    writeRuntimeLog: (message, details) => {
      trace.push(['log', message, details]);
      if (fault === 'start-log' && message.startsWith('Checking')) throw new Error('start-log_failure');
      if (fault === 'end-log' && message.endsWith('completed')) throw new Error('end-log_failure');
    },
    resolveAssetSelection: (settings) => {
      trace.push(['assets', settings]); if (fault === 'assets') throw new Error('assets_failure'); return assets;
    },
  };
  return { api: baseline ? baseline(dependencies) : createLocalVoiceRuntimeDiagnostics(dependencies), trace, candidates };
}

async function runHealth(plans, settings, assets, fault, baseline) {
  const h = createHarness(plans, assets, fault, baseline);
  let result;
  try { result = { status: 'fulfilled', value: await h.api.getHealth(settings) }; }
  catch (error) { result = { status: 'rejected', error: { name: error.name, message: error.message } }; }
  const inline = h.trace.filter(([event]) => event === 'inline');
  const firstStt = inline.findIndex(([, mode]) => mode === 'stt');
  if (firstStt >= 0) assert.ok(inline.slice(firstStt).every(([, mode]) => mode === 'stt'));
  assert.equal(h.trace.some(([event]) => event === 'spawn'), false);
  if (!fault) {
    assert.equal(result.status, 'fulfilled');
    assert.ok(['ready', 'missing-runtime', 'missing-assets', 'missing-dependencies'].includes(result.value.status));
    const missingExecutables = [...h.candidates.tts, ...h.candidates.stt].filter((candidate) => candidate.type === 'enoent');
    for (const candidate of missingExecutables) assert.equal(h.trace.some(([event, , executable]) => event === 'broken' && executable === candidate.executable), false);
  } else assert.equal(result.error.message, `${fault}_failure`);
  return { trace: h.trace, result };
}

async function runBase(plan, baseline) {
  const h = createHarness({ base: plan, tts: [], stt: [] }, false, null, baseline);
  let result;
  try {
    const runtime = await h.api.resolveBasePythonRuntime({ key: 'base' });
    assert.ok(h.candidates.base.includes(runtime.candidate));
    assert.equal(runtime.executable, runtime.candidate.type === 'blank-base' ? runtime.candidate.executable : 'actual-python.exe');
    result = { status: 'fulfilled', value: runtime };
  } catch (error) { result = { status: 'rejected', message: error.message }; }
  return { trace: h.trace, result };
}

function checkStructure() {
  const file = path.join(__dirname, '../electron/localVoiceRuntimeDiagnostics.cjs');
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.split('\n').length <= 300);
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) assert.ok(node.getText().split('\n').length <= 50);
    ts.forEachChild(node, visit);
  }
  visit(source);
  for (const name of names) assert.doesNotMatch(rootSource, new RegExp(`async function ${name}\\(`));
  assert.match(rootSource, /createLocalVoiceBackendAssembly\(\{/u);
  assert.match(backendSource, /createLocalVoiceSupportAssembly\(\{/u);
  assert.match(assemblySource, /const \{ resolveBasePythonRuntime, getHealth \} = createLocalVoiceRuntimeDiagnostics\(\{/u);
}

async function main() {
  checkStructure();
  const baseline = process.argv[2] ? loadBaseline(process.argv[2]) : null;
  const plans = [['ok'], ['gpu'], ['missing-package'], ['enoent', 'ok'], ['fail', 'ok'],
    ['badjson', 'ok'], ['import-error', 'ok'], [], ['enoent', 'fail', 'empty'], ['throw', 'ok']];
  let count = 0;
  for (const tts of plans) for (const stt of plans) {
    for (const settings of [undefined, null, { ttsProvider: 'local', sttProvider: 'local' },
      { ttsProvider: 'local', sttProvider: 'api' }, { ttsProvider: 'api', sttProvider: 'api' }]) {
      for (const assets of [false, true]) {
        const config = { base: [], tts, stt };
        const actual = await runHealth(config, settings, assets);
        if (baseline) assert.deepEqual(actual, await runHealth(config, settings, assets, null, baseline));
        count++;
      }
    }
  }
  for (const plan of [[], ['ok'], ['blank-base'], ['enoent', 'ok'], ['fail', 'ok'], ['throw', 'ok'], ['enoent', 'fail']]) {
    const actual = await runBase(plan);
    if (baseline) assert.deepEqual(actual, await runBase(plan, baseline));
    count++;
  }
  for (const fault of ['start-log', 'assets', 'end-log']) {
    const config = { base: [], tts: ['ok'], stt: ['ok'] };
    const actual = await runHealth(config, {}, true, fault);
    if (baseline) assert.deepEqual(actual, await runHealth(config, {}, true, fault, baseline));
    count++;
  }
  console.log(`local voice diagnostics: ${count} health/base-runtime/failure scenarios passed${baseline ? ' against baseline' : ''}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
