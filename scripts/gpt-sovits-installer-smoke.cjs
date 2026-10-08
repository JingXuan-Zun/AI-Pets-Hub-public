const assert = require('node:assert/strict');
const {
  GPT_SOVITS_COMMIT, RUNTIME_REQUIREMENTS, TORCH_INDEX_URLS, buildGptSovitsInstallSteps,
} = require('../electron/gptSovitsInstallPlan.cjs');
const { createGptSovitsInstaller } = require('../electron/gptSovitsInstaller.cjs');

let cases = 0;
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); cases++; };
const paths = { home: 'H', venvDir: 'H/venv', venvPython: 'H/venv/Scripts/python.exe', sourceDir: 'H/GPT-SoVITS' };

// Plan: venv only when missing, torch index follows the device, pinned commit, Windows substitutions.
const fresh = buildGptSovitsInstallSteps({ paths, installScript: 'inst.py', device: 'auto', venvExists: false });
check(fresh.map((step) => step.id), ['check-python', 'venv', 'pip', 'torch', 'requirements', 'source', 'models'], 'fresh steps');
check(fresh.find((step) => step.id === 'torch').args.slice(-2), ['--index-url', TORCH_INDEX_URLS.cuda], 'cuda torch by default');
check(buildGptSovitsInstallSteps({ paths, installScript: 'inst.py', device: 'cpu', venvExists: true }).map((s) => s.id).includes('venv'), false, 'existing venv reused');
check(buildGptSovitsInstallSteps({ paths, installScript: 'inst.py', device: 'cpu', venvExists: true }).find((s) => s.id === 'torch').args.slice(-1), [TORCH_INDEX_URLS.cpu], 'cpu torch');
check(fresh.find((step) => step.id === 'source').args.slice(-1), [GPT_SOVITS_COMMIT], 'pinned commit');
check([RUNTIME_REQUIREMENTS.includes('jieba_fast'), RUNTIME_REQUIREMENTS.includes('pyopenjtalk-plus'), RUNTIME_REQUIREMENTS.some((r) => r.startsWith('onnxruntime-gpu'))], [false, true, false], 'windows substitutions');
check(fresh.filter((step) => step.runner === 'base').map((step) => step.id), ['check-python', 'venv'], 'base runner only before venv');

function makeInstaller({ failStep = null, healthStatus = 'stopped', venvReady = true } = {}) {
  const calls = [];
  const logs = [];
  let cleared = 0;
  const install = createGptSovitsInstaller({
    paths, projectRoot: '.', writeLog: (message) => logs.push(message), getSharedEnv: () => ({}),
    ensureInstallScript: () => 'inst.py',
    python: { getCandidate: () => (venvReady ? { executable: 'venv-py' } : null), clearProbeCache: () => { cleared++; } },
    getHealth: async () => ({ status: healthStatus, error: 'health says no' }),
    runCommand: async (candidate, args, options) => {
      const id = args.includes('source') ? 'source' : args.includes('models') ? 'models' : args.includes('torch==2.7.0') ? 'torch' : args[0] === '-c' ? 'check' : args[1];
      calls.push([candidate.executable, id]);
      const ownScriptLine = { source: '正在下载推理代码...', models: '正在下载预训练模型...' }[id];
      options.onStdoutLine(ownScriptLine ?? `Requirement already satisfied: x in C:\\secret\\site-packages (${id})`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { ok: id !== failStep, stdout: '', stderr: 'boom', exitCode: id === failStep ? 1 : 0 };
    },
  });
  return { install, calls, logs, getCleared: () => cleared };
}

(async () => {
  const progressEvents = [];
  const ok = makeInstaller();
  const [first, second] = await Promise.all([
    ok.install({ gptSovitsDevice: 'auto' }, { onProgress: (p) => progressEvents.push(p) }),
    ok.install({ gptSovitsDevice: 'auto' }),
  ]);
  check(first === second, true, 'concurrent installs share one run');
  check([first.ok, first.error, ok.getCleared()], [true, null, 1], 'success clears probe cache');
  check(ok.calls.map(([, id]) => id), ['check', 'venv', 'pip', 'torch', 'pip', 'source', 'models'], 'all steps ran in order');
  check(ok.calls.slice(2).every(([executable]) => executable === 'venv-py'), true, 'post-venv steps use the venv python');
  check(first.messages.some((line) => line.includes('secret')), false, 'raw pip output stays out of user progress');
  check(first.messages.includes('正在下载推理代码...'), true, 'install script lines are shown');
  check(ok.logs.some((line) => line.includes('secret')), true, 'raw pip output kept in log');
  check(progressEvents.at(-1).stage, 'completed', 'final progress stage');

  const failing = makeInstaller({ failStep: 'torch' });
  const failed = await failing.install({});
  check([failed.ok, failed.error], [false, '安装 PyTorch 显卡版（约 3.3GB，耗时较长）失败，请检查网络后重试。'], 'failure message names the step');
  check(failing.calls.map(([, id]) => id).includes('source'), false, 'stops at first failure');
  check(failing.getCleared(), 0, 'no cache clear on failure');

  const unhealthy = await makeInstaller({ healthStatus: 'missing-source' }).install({});
  check([unhealthy.ok, unhealthy.error], [false, 'health says no'], 'post-install health gate');
  const noVenv = await makeInstaller({ venvReady: false }).install({});
  check([noVenv.ok, noVenv.error], [false, '独立运行环境创建失败。'], 'missing venv candidate');

  console.log(`GPT-SoVITS installer passed: ${cases} cases`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
