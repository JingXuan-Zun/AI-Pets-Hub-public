const { getPythonCandidates, pathExists } = require('./localVoiceRuntimePathUtils.cjs');
const { createInstallProgressReporter, formatSpawnFailure } = require('./localVoiceRuntimeCommandUtils.cjs');
const path = require('path');
const { BASE_PYTHON_CHECK, PIP_MIRROR_INDEX_URL, buildGptSovitsInstallSteps } = require('./gptSovitsInstallPlan.cjs');
const { ensurePortablePython, portablePythonPaths } = require('./gptSovitsPortablePython.cjs');

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
  // PyPI is slow or unreachable from some networks (China): one more try through a mirror.
  if (step.pipMirrorRetry) {
    progress.push('换一个下载源再试一次...');
    const retry = await runCommand(candidate, [...step.args, '--index-url', PIP_MIRROR_INDEX_URL], {
      cwd: paths.home,
      env: getSharedEnv(),
      onStdoutLine: (line) => writeLog(`GPT-SoVITS install (mirror): ${line}`),
      onStderrLine: (line) => writeLog(`GPT-SoVITS install stderr (mirror): ${line}`),
    });
    if (retry.ok) return null;
    writeLog('GPT-SoVITS install step failed on the mirror too', { step: step.id, detail: formatSpawnFailure(retry) });
  }
  return step.id === 'check-python' ? '需要 Python 3.10–3.12，请检查内置 Python 运行环境。' : `${step.label.replace(/\.+$/u, '')}失败，请检查网络后重试。`;
}

/**
 * The Python that creates the venv: the first candidate that really is 3.10–3.12; when there is
 * none, a portable one is downloaded next to the runtime (gptSovitsPortablePython.cjs).
 */
async function resolveBasePython({ candidates, runCommand, getSharedEnv, paths, progress, writeLog, ensurePortable }) {
  const runtimeRoot = path.dirname(paths.home);
  const portable = portablePythonPaths(runtimeRoot).executable;
  const ordered = [{ label: 'portable', executable: portable, args: [] }, ...candidates];
  for (const candidate of ordered) {
    if (candidate.label === 'portable' && !pathExists(portable)) continue;
    const result = await runCommand(candidate, ['-c', BASE_PYTHON_CHECK], {
      cwd: paths.home, env: getSharedEnv(), onStderrLine: () => undefined, onStdoutLine: () => undefined,
    });
    if (result.ok) return candidate;
  }
  const executable = await ensurePortable({ runtimeRoot, onProgress: (line) => progress.push(line), writeLog });
  return { label: 'portable', executable, args: [] };
}

/** Only needed while the venv does not exist yet; returns { candidate } or { error }. */
async function pickBasePython(context, progress) {
  const { paths, projectRoot, writeLog } = context;
  if (pathExists(paths.venvPython)) return { candidate: null };
  try {
    return {
      candidate: await resolveBasePython({
        candidates: getPythonCandidates('', { projectRoot }),
        ensurePortable: context.ensurePortablePython ?? ensurePortablePython,
        getSharedEnv: context.getSharedEnv,
        paths,
        progress,
        runCommand: context.runCommand,
        writeLog,
      }),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
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
    progress.setStage('running');
    const base = await pickBasePython(context, progress);
    if (base.error) return buildResult(progress, false, base.error);
    const baseCandidate = base.candidate;
    const stepContext = {
      ...context,
      getBaseCandidate: () => baseCandidate ?? getPythonCandidates('', { projectRoot })[0] ?? null,
      getVenvCandidate: () => python.getCandidate(),
    };
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

module.exports = { createGptSovitsInstaller, resolveBasePython };
