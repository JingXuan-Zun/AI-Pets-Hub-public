const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createDeepSeekHarnessCapabilityBridge } = require('./deepseekHarnessCapabilityBridge.cjs');
const { runDeepSeekHarnessProcess } = require('./deepseekHarnessProcessRunner.cjs');
const { prepareDeepSeekHarnessCapabilityProfile } = require('./deepseekHarnessProfile.cjs');

const DEFAULT_TIMEOUT_MS = 300_000;
const RUNNER_FILE_NAME = 'deepseek-harness-runner.py';
const PLUGIN_FILE_NAME = 'deepseekHarnessCapabilityPlugin.mjs';

function normalizeError(error) { return error instanceof Error ? error.message : String(error); }
function resolvePythonCommand(preferred) {
  const value = String(preferred || '').trim();
  return value ? { command: value, args: [] } : { command: process.platform === 'win32' ? 'py' : 'python3', args: process.platform === 'win32' ? ['-3'] : [] };
}
function execPython(python, args, options = {}) {
  return new Promise((resolve) => {
    execFile(python.command, [...python.args, ...args], { env: options.env, timeout: options.timeoutMs ?? 8000, windowsHide: true }, (error, stdout, stderr) => resolve({ error: error ? normalizeError(error) : '', stderr: String(stderr || ''), stdout: String(stdout || '') }));
  });
}
function resolveConfiguredDirectory(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) return { error: `DeepSeek Harness requires a ${label}.`, path: '' };
  const resolved = path.resolve(normalized);
  return fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()
    ? { error: '', path: resolved }
    : { error: `DeepSeek Harness ${label} does not exist.`, path: '' };
}

function createDeepSeekHarnessRuntimeService({ localFileSystemService, log, runnerRoot } = {}) {
  const root = path.resolve(runnerRoot || path.join(os.tmpdir(), 'ai-pets-hub-runtime'));
  const activeRuns = new Map();
  function getRunnerPath() {
    fs.mkdirSync(root, { recursive: true });
    const runnerPath = path.join(root, RUNNER_FILE_NAME);
    if (!fs.existsSync(runnerPath)) {
      fs.writeFileSync(runnerPath, fs.readFileSync(path.join(__dirname, RUNNER_FILE_NAME)));
    }
    return runnerPath;
  }
  function getCapabilityPluginPath() {
    fs.mkdirSync(root, { recursive: true });
    const pluginPath = path.join(root, PLUGIN_FILE_NAME);
    fs.copyFileSync(path.join(__dirname, PLUGIN_FILE_NAME), pluginPath);
    return pluginPath;
  }
  function prepareCapabilityProfile(request = {}) {
    const dshHome = resolveConfiguredDirectory(request.dshHome, 'DSH_HOME');
    if (dshHome.error) return { error: dshHome.error, ok: false };
    try {
      const profilePath = prepareDeepSeekHarnessCapabilityProfile({
        dshHome: dshHome.path,
        pluginPath: getCapabilityPluginPath(),
      });
      return { ok: true, profilePath };
    } catch (error) { return { error: normalizeError(error), ok: false }; }
  }
  async function probe(request = {}) {
    const python = resolvePythonCommand(request.pythonPath);
    const result = await execPython(python, ['-c', "import importlib.metadata as m,sys; print('PYTHON='+sys.version.split()[0]); print('SDK='+m.version('deepseek-harness-sdk'))"]);
    const sdkVersion = result.stdout.match(/^SDK=(.+)$/mu)?.[1]?.trim() || null;
    return { available: Boolean(sdkVersion), error: sdkVersion ? null : (result.error || result.stderr || 'deepseek-harness-sdk not installed'), pythonVersion: result.stdout.match(/^PYTHON=(.+)$/mu)?.[1]?.trim() || null, sdkVersion };
  }
  async function checkUpdate(request = {}) {
    const python = resolvePythonCommand(request.pythonPath);
    const result = await execPython(python, ['-m', 'pip', 'index', 'versions', 'deepseek-harness-sdk', '--disable-pip-version-check'], { timeoutMs: 15000 });
    const latestVersion = result.stdout.match(/AVAILABLE VERSIONS:\s*([^\s,]+)/iu)?.[1] || result.stdout.match(/latest:\s*([^\s,]+)/iu)?.[1] || null;
    return { checked: Boolean(latestVersion), error: latestVersion ? null : (result.error || result.stderr || 'Unable to query SDK versions.'), latestVersion };
  }
  async function validateSetup(request = {}) {
    const workspace = resolveConfiguredDirectory(request.workspace, 'Workspace');
    const dshHome = resolveConfiguredDirectory(request.dshHome, 'DSH_HOME');
    if (workspace.error || dshHome.error) {
      return { error: workspace.error || dshHome.error, ok: false, checks: { directories: false } };
    }
    const probeResult = await probe({ pythonPath: request.pythonPath });
    if (!probeResult.available) {
      return { error: probeResult.error || 'deepseek-harness-sdk not installed', ok: false, checks: { directories: true, sdk: false } };
    }
    try {
      const profile = prepareCapabilityProfile({ dshHome: dshHome.path });
      const pluginPath = getCapabilityPluginPath();
      const python = resolvePythonCommand(request.pythonPath);
      const runnerPath = getRunnerPath();
      const initProbe = await execPython(python, ['-c', [
        'from deepseek_harness import DeepSeekHarness',
        'import os,sys',
        "h=DeepSeekHarness(provider='deepseek-official',model=os.environ.get('DSH_MODEL','deepseek-v4-flash'),cwd=os.environ['DSH_WORKSPACE'],dsh_home=os.environ['DSH_HOME'],profile='sdk-minimal',patches=(os.environ['DSH_CAPABILITY_PROFILE_PATCH'],),env={'AI_PETS_HARNESS_BRIDGE_TOKEN':'setup-probe','AI_PETS_HARNESS_BRIDGE_URL':'http://127.0.0.1:1'},initialize_timeout_seconds=12)",
        'h.start()',
        "print('HARNESS_INIT_OK')",
        'h.close()',
      ].join(';')], {
        timeoutMs: 18_000,
        env: {
          ...process.env,
          DSH_CAPABILITY_PROFILE_PATCH: profile.profilePath,
          DSH_HOME: dshHome.path,
          DSH_MODEL: String(request.model || 'deepseek-v4-flash'),
          DSH_WORKSPACE: workspace.path,
          AI_PETS_HARNESS_RUNNER_PATH: runnerPath,
        },
      });
      const runtimeInitialized = initProbe.stdout.includes('HARNESS_INIT_OK');
      return {
        checks: { directories: true, sdk: true, profile: Boolean(profile.ok), plugin: fs.existsSync(pluginPath), runtimeInitialized },
        error: runtimeInitialized ? null : (initProbe.error || initProbe.stderr || 'Harness runtime initialization failed.'),
        ok: Boolean(profile.ok && fs.existsSync(pluginPath) && runtimeInitialized),
        profilePath: profile.profilePath,
        sdkVersion: probeResult.sdkVersion,
      };
    } catch (error) {
      return { error: normalizeError(error), ok: false, checks: { directories: true, sdk: true, profile: false } };
    }
  }
  async function run(request = {}) {
    const setup = await validateSetup(request);
    if (!setup.ok) return { error: setup.error || 'DeepSeek Harness 受控运行环境尚未就绪。', ok: false };
    if (!String(request.apiKey || '').trim()) return { error: 'DeepSeek Harness API Key 未配置。', ok: false };
    const workspace = resolveConfiguredDirectory(request.workspace, 'Workspace');
    const dshHome = resolveConfiguredDirectory(request.dshHome, 'DSH_HOME');
    if (workspace.error || dshHome.error) return { error: workspace.error || dshHome.error, ok: false };
    const profile = prepareCapabilityProfile({ dshHome: dshHome.path });
    if (!profile.ok || !localFileSystemService) return profile.ok ? { error: 'capability-bridge-unavailable', ok: false } : profile;
    const bridge = await createDeepSeekHarnessCapabilityBridge({ localFileSystemService, workspace: workspace.path });
    try {
      const python = resolvePythonCommand(request.pythonPath);
      const environment = { ...process.env, AI_PETS_HARNESS_BRIDGE_TOKEN: bridge.token, AI_PETS_HARNESS_BRIDGE_URL: bridge.url, DEEPSEEK_API_KEY: String(request.apiKey || ''), DSH_CAPABILITY_PROFILE_PATCH: profile.profilePath, DSH_HOME: dshHome.path, DSH_MODEL: String(request.model || 'deepseek-v4-flash'), DSH_WORKSPACE: workspace.path, ...(request.baseUrl ? { DEEPSEEK_BASE_URL: String(request.baseUrl) } : {}) };
      const processRun = runDeepSeekHarnessProcess({ command: python.command, commandArgs: python.args, cwd: workspace.path, env: environment, runnerPath: getRunnerPath(), timeoutMs: DEFAULT_TIMEOUT_MS, userGoal: request.userGoal });
      const runId = String(request.requestId || request.sessionId || '').trim();
      if (runId && typeof processRun.cancel === 'function') activeRuns.set(runId, processRun.cancel);
      const result = await processRun;
      if (runId) activeRuns.delete(runId);
      log?.('deepseek harness task finished', { ok: result.ok });
      return result;
    } finally { await bridge.close(); }
  }
  function cancel(request = {}) {
    const runId = String(request.requestId || request.sessionId || '').trim();
    const cancelProcess = activeRuns.get(runId);
    if (!cancelProcess) return { cancelled: false, ok: true };
    cancelProcess();
    activeRuns.delete(runId);
    return { cancelled: true, ok: true };
  }
  return { cancel, checkUpdate, getCapabilityPluginPath, getRunnerPath, prepareCapabilityProfile, probe, run, validateSetup };
}

module.exports = { createDeepSeekHarnessRuntimeService };
