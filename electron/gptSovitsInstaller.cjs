const { getPythonCandidates, pathExists } = require('./localVoiceRuntimePathUtils.cjs');
const { createInstallProgressReporter, formatSpawnFailure } = require('./localVoiceRuntimeCommandUtils.cjs');
const { buildGptSovitsInstallSteps } = require('./gptSovitsInstallPlan.cjs');

const NOT_INSTALLED_STATUSES = new Set(['missing-runtime', 'missing-dependencies', 'missing-source']);

function buildResult(progress, ok, error = null) {
  progress.setError(error);
  progress.setStage(ok ? 'completed' : 'failed');
  return { ok, executable: null, messages: progress.getMessages(), error, missingPackages: [] };
}

async function runStep(context, step, progress) {
  const { getBaseCandidate, getVenvCandidate, runCommand, getSharedEnv, paths, writeLog } = context;
  const candidate = step.runner === 'base' ? getBaseCandidate() : getVenvCandidate();
  if (!candidate) {
    return step.runner === 'base' ? '未找到可用的 Python 3.10–3.12 运行环境。' : '独立运行环境创建失败。';
  }
  progress.push(step.label);
  // Only our install script prints user-facing lines; raw pip output (paths, package internals) stays in the log.
  const userFacingOutput = step.id === 'source' || step.id === 'models';
  const result = await runCommand(candidate, step.args, {
    cwd: paths.home,
    env: getSharedEnv(),
    onStdoutLine: (line) => (userFacingOutput ? progress.push(line) : writeLog(`GPT-SoVITS install: ${line}`)),
    onStderrLine: (line) => writeLog(`GPT-SoVITS install stderr: ${line}`),
  });
  if (result.ok) return null;
  writeLog('GPT-SoVITS install step failed', { step: step.id, detail: formatSpawnFailure(result) });
  return step.id === 'check-python' ? '需要 Python 3.10–3.12，请检查内置 Python 运行环境。' : `${step.label.replace(/\.+$/u, '')}失败，请检查网络后重试。`;
}

// Installs the isolated venv, torch, dependencies, pinned source and pretrained assets; one run at a time.
function createGptSovitsInstaller(context) {
  const { paths, projectRoot, ensureInstallScript, python, getHealth, writeLog } = context;
  let running = null;

  async function install(settings, options = {}) {
    const progress = createInstallProgressReporter(options.onProgress, (message) => writeLog(`GPT-SoVITS install: ${message}`));
    progress.push('准备安装 GPT-SoVITS 运行环境...');
    const steps = buildGptSovitsInstallSteps({
      paths, installScript: ensureInstallScript(), device: settings?.gptSovitsDevice, venvExists: pathExists(paths.venvPython),
    });
    const stepContext = {
      ...context,
      getBaseCandidate: () => getPythonCandidates('', { projectRoot })[0] ?? null,
      getVenvCandidate: () => python.getCandidate(),
    };
    progress.setStage('running');
    for (const step of steps) {
      const error = await runStep(stepContext, step, progress);
      if (error) return buildResult(progress, false, error);
    }
    python.clearProbeCache();
    const health = await getHealth(settings);
    if (NOT_INSTALLED_STATUSES.has(health.status)) {
      return buildResult(progress, false, health.error);
    }
    progress.push('GPT-SoVITS 运行环境安装完成。');
    return buildResult(progress, true);
  }

  return (settings, options) => {
    if (!running) {
      running = install(settings, options).finally(() => {
        running = null;
      });
    }
    return running;
  };
}

module.exports = { createGptSovitsInstaller };
