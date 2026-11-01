const { getModeLabel, getModeEnvDirectory, getModeEnvPythonPath,
  getInstallSteps } = require('./localVoiceRuntimeModeUtils.cjs');
const { formatSpawnFailure } = require('./localVoiceRuntimeCommandUtils.cjs');
const { removeDirectorySafe } = require('./localVoiceRuntimeHostUtils.cjs');
const path = require('path');
const { describeBlockedInstall, runWatchedInstallCommand } = require('./localVoiceRuntimeInstallWatchdog.cjs');

// Where an install step writes: watched to tell a slow download from a step that stalled.
function installWatchFolders(runtimeRoot, envDir) {
  return runtimeRoot ? [path.join(runtimeRoot, 'tmp'), path.join(runtimeRoot, 'pip-cache'), envDir] : [];
}

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
  const result = await runWatchedInstallCommand({
    spawnCommand,
    candidate: baseRuntime.candidate,
    args: ['-m', 'venv', envDir, '--without-pip'],
    options: { ...getSharedOptions(), onStdoutLine: (line) => progress.push(line), onStderrLine: (line) => progress.push(line) },
    watchFolders: installWatchFolders(runtimeRoot, envDir),
    runtimeRoot,
    label: `创建${label}环境`,
  });
  if (!result.ok || !pathExists(envPythonPath)) {
    throw new Error(describeBlockedInstall(`${label} isolated runtime creation failed: ${formatSpawnFailure(result)}`, runtimeRoot));
  }
  progress.push(`${label} isolated runtime created.`);
  return buildIsolatedRuntime(mode, envPythonPath);
}

async function installModeDependencies(context, baseRuntime, runtime, mode, progress, preferredTorchPackages) {
  const { spawnCommand, getSharedOptions, runtimeRoot } = context;
  const steps = getInstallSteps(mode, preferredTorchPackages);
  for (const step of steps) {
    progress.push(`${step.label}...`);
    const result = await runWatchedInstallCommand({
      spawnCommand,
      candidate: baseRuntime.candidate,
      args: ['-m', 'pip', '--python', runtime.executable, ...step.installArgs],
      options: { ...getSharedOptions(), onStdoutLine: (line) => progress.push(line), onStderrLine: (line) => progress.push(line) },
      watchFolders: installWatchFolders(runtimeRoot, runtimeRoot ? getModeEnvDirectory(runtimeRoot, mode) : ''),
      runtimeRoot,
      label: step.label,
    });
    if (!result.ok) throw new Error(describeBlockedInstall(`${step.label} failed: ${formatSpawnFailure(result)}`, runtimeRoot));
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
