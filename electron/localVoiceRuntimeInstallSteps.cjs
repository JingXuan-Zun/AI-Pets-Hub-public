const { getModeLabel, getModeEnvDirectory, getModeEnvPythonPath,
  getInstallSteps } = require('./localVoiceRuntimeModeUtils.cjs');
const { formatSpawnFailure } = require('./localVoiceRuntimeCommandUtils.cjs');
const { removeDirectorySafe } = require('./localVoiceRuntimeHostUtils.cjs');

function buildIsolatedRuntime(mode, envPythonPath) {
  return {
    candidate: { label: `venv-${mode}`, executable: envPythonPath, args: [] },
    executable: envPythonPath,
  };
}

async function ensureVenv(context, baseRuntime, mode, progress, options = {}) {
  const { runtimeRoot, pathExists, removeDirectorySafe, ensureDir, spawnCommand, getSharedOptions } = context;
  const label = getModeLabel(mode);
  const envDir = getModeEnvDirectory(runtimeRoot, mode);
  const envPythonPath = getModeEnvPythonPath(runtimeRoot, mode);
  const recreate = Boolean(options.recreate);
  if (recreate && pathExists(envDir)) {
    progress.push(`Recreating ${label} isolated runtime. Cleaning old environment...`);
    removeDirectorySafe(envDir, runtimeRoot);
  }
  if (pathExists(envPythonPath)) {
    progress.push(`${label} isolated runtime already exists.`);
    return buildIsolatedRuntime(mode, envPythonPath);
  }
  ensureDir(runtimeRoot);
  progress.push(`Creating ${label} isolated runtime...`);
  const result = await spawnCommand(baseRuntime.candidate, ['-m', 'venv', envDir, '--without-pip'], {
    ...getSharedOptions(),
    onStdoutLine: (line) => progress.push(line),
    onStderrLine: (line) => progress.push(line),
  });
  if (!result.ok || !pathExists(envPythonPath)) {
    throw new Error(`${label} isolated runtime creation failed: ${formatSpawnFailure(result)}`);
  }
  progress.push(`${label} isolated runtime created.`);
  return buildIsolatedRuntime(mode, envPythonPath);
}

async function installModeDependencies(context, baseRuntime, runtime, mode, progress, preferredTorchPackages) {
  const { spawnCommand, getSharedOptions } = context;
  const steps = getInstallSteps(mode, preferredTorchPackages);
  for (const step of steps) {
    progress.push(`${step.label}...`);
    const result = await spawnCommand(baseRuntime.candidate,
      ['-m', 'pip', '--python', runtime.executable, ...step.installArgs], {
        ...getSharedOptions(),
        onStdoutLine: (line) => progress.push(line),
        onStderrLine: (line) => progress.push(line),
      });
    if (!result.ok) throw new Error(`${step.label} failed: ${formatSpawnFailure(result)}`);
  }
}

function createLocalVoiceInstallSteps(context) {
  const capabilities = { removeDirectorySafe, ...context };
  return {
    ensureVenv: ensureVenv.bind(null, capabilities),
    installModeDependencies: installModeDependencies.bind(null, capabilities),
  };
}

module.exports = { createLocalVoiceInstallSteps };
