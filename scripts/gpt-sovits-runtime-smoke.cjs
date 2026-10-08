const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { createGptSovitsHealth, GPT_SOVITS_STATUS_MESSAGES } = require('../electron/gptSovitsHealth.cjs');
const { createGptSovitsStartup } = require('../electron/gptSovitsStartup.cjs');
const { createGptSovitsProcess } = require('../electron/gptSovitsProcess.cjs');
const { parseProbeOutput } = require('../electron/gptSovitsPython.cjs');

let cases = 0;
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); cases++; };

function makeModelsRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-sovits-runtime-'));
  const dir = path.join(root, 'voice');
  fs.mkdirSync(path.join(dir, 'refs'), { recursive: true });
  ['g.ckpt', 's.pth', 'refs/n.wav'].forEach((rel) => fs.writeFileSync(path.join(dir, rel), 'x'));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    version: 'v2ProPlus', gpt: 'g.ckpt', sovits: 's.pth', emotions: { neutral: { wav: 'refs/n.wav', text: '你好' } },
  }));
  return root;
}

function startHealthServer(statusBody) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(statusBody));
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function healthCases(modelsRoot) {
  const python = (overrides = {}) => ({
    getCandidate: () => ({ executable: 'py' }), hasSource: () => true,
    probeRuntime: async () => ({ ok: true, missingPackages: [], cudaAvailable: true, error: null }), ...overrides,
  });
  const run = (py, settings = {}, root = modelsRoot) => createGptSovitsHealth({ python: py, getModelsRoot: () => root })(
    { gptSovitsApiUrl: 'http://127.0.0.1:1', ...settings },
  );
  check((await run(python({ getCandidate: () => null }))).status, 'missing-runtime', 'no venv');
  check((await run(python({ probeRuntime: async () => ({ ok: true, missingPackages: ['torch'], cudaAvailable: false }) }))).missingPackages, ['torch'], 'missing deps');
  check((await run(python({ probeRuntime: async () => ({ ok: false, missingPackages: [], error: 'C:\\secret\\path' }) }))).error, GPT_SOVITS_STATUS_MESSAGES['missing-dependencies'], 'probe failure hides details');
  check((await run(python({ hasSource: () => false }))).status, 'missing-source', 'no source');
  check((await run(python(), {}, null)).status, 'missing-model', 'no models root');
  check((await run(python(), { gptSovitsModelId: 'other' })).status, 'missing-model', 'unknown selected model');
  const noGpu = python({ probeRuntime: async () => ({ ok: true, missingPackages: [], cudaAvailable: false }) });
  check((await run(noGpu)).status, 'no-gpu', 'auto without cuda');
  check((await run(noGpu, { gptSovitsDevice: 'cpu' })).status, 'stopped', 'explicit cpu allowed');
  const stopped = await run(python());
  check([stopped.status, stopped.modelId, stopped.models.length, stopped.available], ['stopped', 'voice', 1, false], 'stopped with model');
  // An alphabetically earlier lite pack must not take over when nothing is selected.
  const liteDir = path.join(modelsRoot, 'a-lite');
  fs.mkdirSync(path.join(liteDir, 'refs'), { recursive: true });
  fs.writeFileSync(path.join(liteDir, 'refs', 'n.wav'), 'x');
  fs.writeFileSync(path.join(liteDir, 'manifest.json'), JSON.stringify({ version: 'v2ProPlus', emotions: { neutral: { wav: 'refs/n.wav', text: '你好' } } }));
  check((await run(python())).modelId, 'voice', 'no selection prefers the trained pack');
  check((await run(python(), { gptSovitsModelId: 'a-lite' })).modelId, 'a-lite', 'explicit lite selection honored');
  fs.rmSync(liteDir, { recursive: true, force: true });
  const server = await startHealthServer({ status: 'ok' });
  try {
    const ready = await run(python(), { gptSovitsApiUrl: `http://127.0.0.1:${server.address().port}` });
    check([ready.status, ready.available, ready.running, ready.error], ['ready', true, true, null], 'ready');
  } finally {
    server.close();
  }
}

async function startupCases() {
  const calls = [];
  let health = { status: 'stopped', available: false };
  let running = null;
  const processControl = {
    start: async (_url, settings) => { calls.push(`start:${settings.gptSovitsDevice ?? 'auto'}`); await new Promise((r) => setTimeout(r, 20)); running = settings.gptSovitsDevice ?? 'auto'; health = { status: 'ready', available: true }; },
    stop: () => { calls.push('stop'); running = null; },
    getRunningDevice: () => running,
  };
  const ensureStarted = createGptSovitsStartup({ getHealth: async () => health, processControl });
  const [first, second] = await Promise.all([ensureStarted({}), ensureStarted({})]);
  check([first.started, second.started, calls], [true, true, ['start:auto']], 'concurrent callers share one start');
  check((await ensureStarted({})).started, false, 'already running');
  await ensureStarted({ gptSovitsDevice: 'cpu' });
  check(calls, ['start:auto', 'stop', 'start:cpu'], 'device change restarts');
  health = { status: 'no-gpu', available: false, error: GPT_SOVITS_STATUS_MESSAGES['no-gpu'] };
  await assert.rejects(ensureStarted({}), { message: GPT_SOVITS_STATUS_MESSAGES['no-gpu'] }); cases++;
}

async function processCases() {
  const fakeChild = () => Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(), stderr: new EventEmitter(), exitCode: null, signalCode: null, pid: undefined, kill: () => true,
  });
  const logs = [];
  let spawned = null;
  const control = createGptSovitsProcess({
    paths: { sourceDir: 'src' }, getModelsRoot: () => 'models', getCandidate: () => ({ executable: 'py', args: [] }),
    ensureServerScript: () => 'server.py', getSharedEnv: () => ({}), writeLog: (m) => logs.push(m),
    spawnProcess: (command, args, options) => { spawned = { command, args, options, child: fakeChild() }; return spawned.child; },
  });
  const server = await startHealthServer({ status: 'ok' });
  try {
    await control.start(new URL(`http://127.0.0.1:${server.address().port}/`), { gptSovitsDevice: 'cuda' });
    check([spawned.command, spawned.args.slice(0, 3), spawned.options.cwd, spawned.options.windowsHide], ['py', ['server.py', '--host', '127.0.0.1'], 'src', true], 'spawn spec');
    check(control.getRunningDevice(), 'cuda', 'running device');
  } finally {
    server.close();
  }
  control.stop();
  check(control.getRunningDevice(), null, 'stopped');
  const dying = createGptSovitsProcess({
    paths: { sourceDir: 'src' }, getModelsRoot: () => 'models', getCandidate: () => ({ executable: 'py' }),
    ensureServerScript: () => 'server.py', getSharedEnv: () => ({}), writeLog: () => undefined,
    spawnProcess: () => { const child = fakeChild(); child.exitCode = 1; return child; },
  });
  await assert.rejects(dying.start(new URL('http://127.0.0.1:1/'), {}), { message: 'GPT-SoVITS 服务启动失败。' }); cases++;
  check(dying.getRunningDevice(), null, 'failed start leaves no child');
  const noRuntime = createGptSovitsProcess({ paths: {}, getModelsRoot: () => null, getCandidate: () => null });
  await assert.rejects(noRuntime.start(new URL('http://127.0.0.1:1/'), {}), { message: 'GPT-SoVITS 运行环境尚未安装。' }); cases++;
}

async function ipcCases() {
  const { registerGptSovitsIpcHandlers } = require('../electron/gptSovitsIpcHandlers.cjs');
  const handlers = new Map();
  const logs = [];
  registerGptSovitsIpcHandlers({
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    log: (message) => logs.push(message),
    gptSovitsService: {
      getHealth: async (settings) => ({ status: 'stopped', echo: settings }),
      ensureStarted: async () => { throw new Error(GPT_SOVITS_STATUS_MESSAGES['no-gpu']); },
      listModels: () => [{ id: 'voice' }],
      installRuntime: async (_settings, options) => { options.onProgress({ stage: 'running' }); return { ok: true }; },
    },
  });
  check([...handlers.keys()], [
    'desktop-pet:get-gpt-sovits-health', 'desktop-pet:start-gpt-sovits-service', 'desktop-pet:list-gpt-sovits-models',
    'desktop-pet:install-gpt-sovits-runtime',
  ], 'ipc channels');
  const sent = [];
  const event = { sender: { isDestroyed: () => false, send: (channel, payload) => sent.push([channel, payload]) } };
  check(await handlers.get('desktop-pet:install-gpt-sovits-runtime')(event, {}), { ok: true }, 'install result');
  check(sent, [['desktop-pet:gpt-sovits-install-progress', { stage: 'running' }]], 'install progress forwarded to sender');
  check(await handlers.get('desktop-pet:get-gpt-sovits-health')({}, undefined), { status: 'stopped', echo: {} }, 'health passes settings');
  check(await handlers.get('desktop-pet:start-gpt-sovits-service')({}, {}),
    { available: false, ok: false, status: 'error', error: GPT_SOVITS_STATUS_MESSAGES['no-gpu'] }, 'start failure resolves');
  check(await handlers.get('desktop-pet:list-gpt-sovits-models')({}), { models: [{ id: 'voice' }] }, 'list models');
  check(logs, ['failed desktop-pet:start-gpt-sovits-service'], 'failure logged');
}

async function probeCacheCases() {
  const { createGptSovitsPython } = require('../electron/gptSovitsPython.cjs');
  let runs = 0;
  let stdout = '{"missing": ["torch"], "cuda": false}';
  const python = createGptSovitsPython({
    paths: { home: '.', venvPython: 'missing', sourceDir: 'missing' }, getSharedEnv: () => ({}),
    runCommand: async () => { runs++; return { ok: true, stdout }; },
  });
  const candidate = { executable: 'py' };
  await python.probeRuntime(candidate);
  await python.probeRuntime(candidate);
  check(runs, 2, 'incomplete runtime re-probed');
  stdout = '{"missing": [], "cuda": true}';
  await python.probeRuntime(candidate);
  await python.probeRuntime(candidate);
  check(runs, 3, 'clean probe cached');
  await python.probeRuntime({ executable: 'other' });
  check(runs, 4, 'cache keyed by executable');
  python.clearProbeCache();
  await python.probeRuntime({ executable: 'other' });
  check(runs, 5, 'cache clearable');
}

function probeCases() {
  check(parseProbeOutput('noise\n{"missing": [], "cuda": true}'), { missingPackages: [], cudaAvailable: true }, 'probe ok');
  check(parseProbeOutput('{"missing": ["torch"], "cuda": "yes"}'), { missingPackages: ['torch'], cudaAvailable: false }, 'probe strict cuda');
  check(parseProbeOutput('Traceback'), null, 'probe garbage');
}

(async () => {
  const modelsRoot = makeModelsRoot();
  try {
    await healthCases(modelsRoot);
    await startupCases();
    await processCases();
    await ipcCases();
    await probeCacheCases();
    probeCases();
  } finally {
    fs.rmSync(modelsRoot, { recursive: true, force: true });
  }
  console.log(`GPT-SoVITS runtime passed: ${cases} cases`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
