const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const modes = require('../electron/localVoiceRuntimeModeUtils.cjs');
const command = require('../electron/localVoiceRuntimeCommandUtils.cjs');
const { createLocalVoiceInstallSteps } = require('../electron/localVoiceRuntimeInstallSteps.cjs');
const rootSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntime.cjs'), 'utf8');
const assemblySource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeServiceAssembly.cjs'), 'utf8');

function loadBaseline(file) {
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf('  async function ensureVenv(');
  const end = text.indexOf('  async function installDependencies(', start);
  assert.ok(start >= 0 && end > start);
  return (dependencies) => new Function(...Object.keys(dependencies),
    `${text.slice(start, end)}; return { ensureVenv, installModeDependencies };`,
  )(...Object.values(dependencies));
}

function resultFor(outcome, error) {
  if (outcome === 'throw') throw error;
  return { ok: outcome === 'success', stdout: '', stderr: outcome === 'exit' ? 'pip failed' : '',
    exitCode: outcome === 'success' ? 0 : 1, error: outcome === 'error' ? error : null };
}

async function runVenv(config, baseline) {
  const { mode, initialDir, initialPython, recreate, cleanup, outcome, createsPython, fault } = config;
  const trace = [];
  const runtimeRoot = path.join(__dirname, 'controlled-voice-runtime');
  const envDir = modes.getModeEnvDirectory(runtimeRoot, mode);
  const envPythonPath = modes.getModeEnvPythonPath(runtimeRoot, mode);
  const error = new Error('controlled_failure');
  const state = { dir: initialDir, python: initialPython };
  const fail = (stage) => { if (fault === stage) throw error; };
  const baseRuntime = { candidate: { executable: 'base-python.exe', args: ['-u'] } };
  const progress = { push(message) { trace.push(['progress', message]); fail('progress'); } };
  const dependencies = { ...modes, ...command, runtimeRoot,
    pathExists: (target) => {
      trace.push(['exists', target]); fail('exists');
      assert.ok(target === envDir || target === envPythonPath);
      return target === envDir ? state.dir : state.python;
    },
    removeDirectorySafe: (target, root) => {
      assert.equal(target, envDir); assert.equal(root, runtimeRoot);
      trace.push(['remove', target, root]); fail('remove');
      if (cleanup) { state.dir = false; state.python = false; }
    },
    ensureDir: (target) => { assert.equal(target, runtimeRoot); trace.push(['ensure-dir', target]); fail('ensure'); },
    getSharedOptions: () => { trace.push(['options']); fail('options'); return { cwd: runtimeRoot, env: { TEST: '1' } }; },
    spawnCommand: async (candidate, args, options) => {
      assert.equal(candidate, baseRuntime.candidate);
      assert.deepEqual(args, ['-m', 'venv', envDir, '--without-pip']);
      trace.push(['spawn', candidate, args, options.cwd, options.env]);
      options.onStdoutLine('stdout line'); options.onStderrLine('stderr line');
      const result = resultFor(outcome, error);
      if (result.ok) { state.dir = true; state.python = createsPython; }
      return result;
    },
  };
  const api = baseline ? baseline(dependencies) : createLocalVoiceInstallSteps(dependencies);
  const options = recreate === undefined ? undefined : { get recreate() { trace.push(['recreate', recreate]); return recreate; } };
  let result;
  try {
    const runtime = await api.ensureVenv(baseRuntime, mode, progress, options);
    assert.deepEqual(runtime, { candidate: { label: `venv-${mode}`, executable: envPythonPath, args: [] }, executable: envPythonPath });
    assert.notEqual(runtime.candidate, baseRuntime.candidate);
    result = { status: 'fulfilled', runtime };
  } catch (caught) { result = { status: 'rejected', message: caught.message, sameError: caught === error }; }
  return { trace, result, state };
}

async function runInstall(config, baseline) {
  const { mode, versions, failIndex, outcome, fault } = config;
  const trace = [];
  const steps = modes.getInstallSteps(mode, versions);
  const baseRuntime = { candidate: { executable: 'base-python.exe', args: [] } };
  const runtime = { executable: 'isolated-python.exe' };
  const error = new Error('step_failure');
  let index = 0;
  const progress = { push(message) {
    trace.push(['progress', message]);
    if (fault === 'progress') throw error;
  } };
  const dependencies = { ...modes, ...command,
    getSharedOptions: () => {
      trace.push(['options']); if (fault === 'options') throw error;
      return { cwd: 'runtime-root', env: { TEST: '1' } };
    },
    spawnCommand: async (candidate, args, options) => {
      const current = index++;
      assert.equal(candidate, baseRuntime.candidate);
      assert.deepEqual(args, ['-m', 'pip', '--python', runtime.executable, ...steps[current].installArgs]);
      trace.push(['spawn', candidate, args, options.cwd, options.env]);
      options.onStdoutLine(`stdout-${current}`); options.onStderrLine(`stderr-${current}`);
      return resultFor(current === failIndex ? outcome : 'success', error);
    },
  };
  const api = baseline ? baseline(dependencies) : createLocalVoiceInstallSteps(dependencies);
  let result;
  try { assert.equal(await api.installModeDependencies(baseRuntime, runtime, mode, progress, versions), undefined); result = { status: 'fulfilled' }; }
  catch (caught) { result = { status: 'rejected', message: caught.message, sameError: caught === error }; }
  if (!fault) assert.equal(index, failIndex < 0 ? steps.length : failIndex + 1);
  return { trace, result };
}

function checkStructure() {
  const file = path.join(__dirname, '../electron/localVoiceRuntimeInstallSteps.cjs');
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.split('\n').length <= 300);
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) assert.ok(node.getText().split('\n').length <= 50);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.doesNotMatch(rootSource, /async function (ensureVenv|installModeDependencies)\(/u);
  assert.match(rootSource, /createLocalVoiceServiceAssembly\(\{/u);
  assert.match(assemblySource, /createLocalVoiceInstallSteps\(\{\s*runtimeRoot, pathExists, ensureDir, spawnCommand, getSharedOptions,/u);
}

async function main() {
  checkStructure();
  const baseline = process.argv[2] ? loadBaseline(process.argv[2]) : null;
  let venvCount = 0, installCount = 0;
  for (const mode of ['tts', 'stt']) for (const initialDir of [false, true]) for (const initialPython of [false, true]) {
    for (const recreate of [undefined, false, 'force']) for (const cleanup of [false, true]) {
      for (const outcome of ['success', 'exit', 'error', 'throw']) for (const createsPython of [false, true]) {
        const config = { mode, initialDir, initialPython, recreate, cleanup, outcome, createsPython };
        const actual = await runVenv(config);
        if (baseline) assert.deepEqual(actual, await runVenv(config, baseline));
        venvCount++;
      }
    }
  }
  for (const mode of ['tts', 'stt']) for (const versions of [undefined,
    { torchVersion: '2.6.0+cu124', torchaudioVersion: '2.6.0+cu124' },
    { torchVersion: '2.6.0+cpu', torchaudioVersion: '2.6.0+cpu' }]) {
    const steps = modes.getInstallSteps(mode, versions);
    for (let failIndex = -1; failIndex < steps.length; failIndex++) {
      for (const outcome of failIndex < 0 ? ['success'] : ['exit', 'error', 'throw']) {
        const config = { mode, versions, failIndex, outcome };
        const actual = await runInstall(config);
        if (baseline) assert.deepEqual(actual, await runInstall(config, baseline));
        installCount++;
      }
    }
  }
  for (const fault of ['exists', 'remove', 'ensure', 'options', 'progress']) {
    const config = { mode: 'tts', initialDir: fault === 'remove', initialPython: false,
      recreate: true, cleanup: true, outcome: 'success', createsPython: true, fault };
    const actual = await runVenv(config);
    assert.equal(actual.result.sameError, true);
    if (baseline) assert.deepEqual(actual, await runVenv(config, baseline));
    venvCount++;
  }
  for (const fault of ['options', 'progress']) {
    const config = { mode: 'tts', failIndex: -1, outcome: 'success', fault };
    const actual = await runInstall(config);
    assert.equal(actual.result.sameError, true);
    if (baseline) assert.deepEqual(actual, await runInstall(config, baseline));
    installCount++;
  }
  console.log(`local voice install steps: ${venvCount} venv and ${installCount} install/order/error scenarios passed${baseline ? ' against baseline' : ''}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
