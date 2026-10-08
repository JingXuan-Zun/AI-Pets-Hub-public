const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const utils = require('../electron/localVoiceRuntimeInstallUtils.cjs');
const modes = require('../electron/localVoiceRuntimeModeUtils.cjs');
const commands = require('../electron/localVoiceRuntimeCommandUtils.cjs');
const paths = require('../electron/localVoiceRuntimePathUtils.cjs');
const processes = require('../electron/localVoiceRuntimeProcessUtils.cjs');
const { createLocalVoiceInstaller } = require('../electron/localVoiceRuntimeInstaller.cjs');
const modulePath = path.join(__dirname, '../electron/localVoiceRuntimeInstaller.cjs');

function loadBaseline(file) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('  async function installDependencies(');
  const end = source.indexOf('  async function synthesize(', start);
  assert.ok(start >= 0 && end > start);
  return (context) => new Function(...Object.keys(context),
    `${source.slice(start, end)}; return { installDependencies };`,
  )(...Object.values(context));
}

async function run(config, baseline) {
  const trace = [], error = new Error('controlled_install_error');
  const base = { executable: 'base.exe', candidate: { executable: 'base.exe', args: ['-u'] } };
  const runtimes = { tts: { executable: 'tts.exe' }, stt: { executable: 'stt.exe' } };
  let faulted = false, healthCalls = 0, progressCalls = 0;
  const fail = (stage) => {
    if (!faulted && config.fault === stage) { faulted = true; throw error; }
  };
  const settings = config.nullSettings ? null : { ttsProvider: 'api', sttProvider: 'api', sentinel: 42 };
  const broken = new Map([['old', 'broken']]);
  const context = { ...utils, ...modes, ...commands, ...paths, ...processes,
    brokenModeRuntimeCandidates: broken,
    writeRuntimeLog(message) { trace.push(['log', message]); fail(`log:${message}`); },
    resolveBasePythonRuntime: async (input) => {
      assert.equal(input, settings ?? input);
      if (!settings) assert.deepEqual(input, {});
      trace.push(['base', input]); fail('base'); return base;
    },
    getSharedOptions() { trace.push(['options']); fail('options'); return { cwd: 'controlled' }; },
    runInlinePythonScript: async (candidate, script, options) => {
      assert.equal(candidate, base.candidate); assert.match(script, /metadata.version/);
      assert.deepEqual(options, { cwd: 'controlled' }); trace.push(['probe']); fail('probe');
      if (config.probe === 'exit') return { ok: false };
      return { ok: true, stdout: config.probe === 'invalid' ? 'bad json' : JSON.stringify(config.probe === 'custom'
        ? { torch: ' 2.6.0+cpu ', torchaudio: '2.6.0+cpu' } : {}) };
    },
    ensureVenv: async (runtime, mode, progress, options) => {
      assert.equal(runtime, base); assert.deepEqual(options, { recreate: true });
      trace.push(['venv', mode]); fail(`venv:${mode}`); progress.push(`created ${mode}`); return runtimes[mode];
    },
    installModeDependencies: async (runtime, target, mode, progress, versions) => {
      assert.equal(runtime, base); assert.equal(target, runtimes[mode]);
      trace.push(['install', mode, versions]); fail(`install:${mode}`); progress.push(`installed ${mode}`);
    },
    getHealth: async (input) => {
      assert.deepEqual(input, { ...(settings ?? {}), ttsProvider: 'local', sttProvider: 'local' });
      trace.push(['health', ++healthCalls]); fail('health');
      if (config.healthAlwaysFails) throw error;
      return { executable: config.executable, missingPackages: config.missing ? ['missing.module'] : [] };
    },
  };
  const installer = baseline ? baseline(context) : createLocalVoiceInstaller(context);
  const options = { onProgress(value) {
    trace.push(['progress', value]); fail(`progress:${++progressCalls}`);
  } };
  let result;
  try { result = await installer.installDependencies(settings, config.noOptions ? undefined : options); }
  catch (caught) { result = { rejected: true, sameError: caught === error, message: caught.message }; }
  const calls = trace.filter((item) => ['venv', 'install'].includes(item[0]));
  const expected = [['venv', 'tts'], ['install', 'tts'], ['venv', 'stt'], ['install', 'stt']];
  assert.deepEqual(calls.map((item) => item.slice(0, 2)), expected.slice(0, calls.length));
  if (!config.fault && !config.healthAlwaysFails) {
    assert.equal(result.ok, !config.missing); assert.equal(healthCalls, 1);
    assert.equal(trace.filter((item) => item[0] === 'progress').at(-1)?.[1].stage,
      config.noOptions ? undefined : config.missing ? 'failed' : 'completed');
  }
  return { result, trace, broken: [...broken], faulted };
}

function checkStructure() {
  const source = fs.readFileSync(modulePath, 'utf8');
  assert.ok(source.split('\n').length <= 300);
  const ast = ts.createSourceFile(modulePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && node.body) {
      const first = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line;
      const last = ast.getLineAndCharacterOfPosition(node.end).line;
      assert.ok(last - first + 1 <= 50, `function exceeds budget at ${first + 1}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const assemblySource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeServiceAssembly.cjs'), 'utf8');
  const root = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntime.cjs'), 'utf8');
  assert.doesNotMatch(root, /async function installDependencies\(/);
  assert.match(root, /createLocalVoiceServiceAssembly\(\{/u);
  assert.match(assemblySource, /createLocalVoiceInstaller\(\{/);
}

async function main() {
  checkStructure();
  const baseline = process.argv[2] ? loadBaseline(process.argv[2]) : null;
  let count = 0;
  async function check(config) {
    const actual = await run(config);
    if (baseline) assert.deepEqual(actual, await run(config, baseline));
    count++;
  }
  for (const missing of [false, true]) for (const executable of [null, 'health.exe']) {
    for (const probe of ['fallback', 'custom', 'invalid', 'exit']) for (const nullSettings of [false, true]) {
      for (const noOptions of [false, true]) await check({ missing, executable, probe, nullSettings, noOptions });
    }
  }
  for (const fault of ['base', 'options', 'probe', 'venv:tts', 'install:tts', 'venv:stt', 'install:stt', 'health',
    'log:Starting local voice dependency installation',
    'log:Install progress: Local voice isolated runtimes installed successfully.']) {
    for (const missing of [false, true]) await check({ fault, missing, executable: null });
  }
  for (let i = 1; i <= 24; i++) for (const missing of [false, true]) {
    await check({ fault: `progress:${i}`, missing, executable: 'health.exe' });
  }
  await check({ healthAlwaysFails: true });
  await check({ healthAlwaysFails: true, fault: 'install:tts' });
  console.log(`local voice installer: ${count} result/order/progress/failure scenarios passed${baseline ? ' against baseline' : ''}`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
