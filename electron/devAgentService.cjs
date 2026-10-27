const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// The development agent the characters hand coding work to: Claude Code run headless
// (`claude -p … --output-format json`) inside a project folder the user listed. It may edit
// files there (acceptEdits) and run only the check commands the user allowed for that folder.
// One task at a time; every task is confirmed by the user in chat before it starts.

const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
// Pages the settings may open for the user: where each provider hands out API keys.
const KEY_PAGE_URLS = new Set(['https://platform.deepseek.com/api_keys']);
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const STATUS_TIMEOUT_MS = 30 * 1000;

function isFile(filePath) {
  try { return fs.statSync(filePath).isFile(); } catch { return false; }
}

function isDirectory(filePath) {
  try { return fs.statSync(filePath).isDirectory(); } catch { return false; }
}

/** Newest claude.exe under a folder, looking a few levels down (versioned install folders). */
function newestExecutableUnder(root, depth) {
  const found = [];
  const walk = (dir, level) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === 'claude.exe') {
        try { found.push({ full, mtime: fs.statSync(full).mtimeMs }); } catch { /* skip */ }
      } else if (entry.isDirectory() && level < depth) {
        walk(full, level + 1);
      }
    }
  };
  walk(root, 0);
  return found.sort((left, right) => right.mtime - left.mtime)[0]?.full ?? null;
}

/**
 * The Claude Code executable: the path set in settings, a standalone install, or the copy
 * bundled with the Claude desktop app (its folder changes with every update).
 */
function resolveClaudeExecutable(customPath, env = process.env) {
  if (customPath && isFile(customPath)) return customPath;
  const home = env.USERPROFILE || os.homedir();
  const standalone = path.join(home, '.local', 'bin', 'claude.exe');
  if (isFile(standalone)) return standalone;
  for (const dir of String(env.PATH || '').split(path.delimiter)) {
    const candidate = path.join(dir, 'claude.exe');
    if (dir && isFile(candidate)) return candidate;
  }
  const localAppData = env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  return newestExecutableUnder(path.join(localAppData, 'Claude-Data'), 4);
}

function runClaude(executable, args, { cwd, timeoutMs, env }) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const child = spawn(executable, args, { cwd, env: { ...process.env, ...(env || {}) }, windowsHide: true });
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ error: `超过 ${Math.round(timeoutMs / 60000)} 分钟没做完，已停止。`, stdout, timedOut: true });
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { if (stdout.length < MAX_OUTPUT_BYTES) stdout += chunk; });
    child.stderr.on('data', (chunk) => { if (stderr.length < MAX_OUTPUT_BYTES) stderr += chunk; });
    child.on('error', (error) => finish({ error: error.message, stdout }));
    child.on('close', (code) => finish({ code, stderr, stdout }));
  });
}

/** The JSON Claude Code prints with --output-format json, or null. */
function parseClaudeJson(stdout) {
  const text = String(stdout || '').trim();
  const start = text.indexOf('{');
  if (start < 0) return null;
  try { return JSON.parse(text.slice(start)); } catch { return null; }
}

const SESSION_ID_PATTERN = /^[0-9a-f-]{8,64}$/iu;
// Same rule as the settings page: a plain command prefix, nothing that chains another command.
const ALLOWED_COMMAND_PATTERN = /^[\w .:/\\=@+,-]{1,120}$/u;

/** --allowedTools rules letting the shell tool (Bash, or PowerShell on Windows) run only commands that start with one of these. */
function allowedCommandArgs(commands) {
  const rules = (Array.isArray(commands) ? commands : [])
    .map((command) => String(command || '').trim())
    .filter((command) => ALLOWED_COMMAND_PATTERN.test(command))
    .slice(0, 10)
    .flatMap((command) => [`Bash(${command}:*)`, `PowerShell(${command}:*)`]);
  return rules.length ? ['--allowedTools', ...rules] : [];
}
// What Claude Code prints when a session to resume no longer exists (deleted, other machine).
const MISSING_SESSION_PATTERN = /No conversation found/iu;

function createDevAgentService({ log = () => undefined } = {}) {
  let running = false;

  async function status(request = {}) {
    const executable = resolveClaudeExecutable(request.executablePath);
    if (!executable) return { installed: false, ok: false, error: '没找到 Claude Code。' };
    const version = await runClaude(executable, ['--version'], { cwd: os.tmpdir(), timeoutMs: STATUS_TIMEOUT_MS });
    const versionText = String(version.stdout || '').trim().split(/\r?\n/u)[0] || '';
    if (!request.probeLogin) return { executable, installed: true, ok: true, version: versionText };
    if (!request.env) {
      // The Claude account: `auth status` answers without spending any quota.
      const auth = await runClaude(executable, ['auth', 'status', '--json'], { cwd: os.tmpdir(), timeoutMs: STATUS_TIMEOUT_MS });
      const parsedAuth = parseClaudeJson(auth.stdout);
      const loggedIn = Boolean(parsedAuth?.loggedIn);
      return { error: loggedIn ? undefined : '还没登录 Claude 账号。', executable, installed: true, loggedIn, ok: loggedIn, version: versionText };
    }
    // A compatible endpoint (e.g. DeepSeek): one tiny request tells whether the key works.
    const probe = await runClaude(executable, ['-p', 'Reply with the single word OK.', '--output-format', 'json'], { cwd: os.tmpdir(), env: request.env, timeoutMs: STATUS_TIMEOUT_MS * 2 });
    const parsed = parseClaudeJson(probe.stdout);
    const loggedIn = Boolean(parsed && !parsed.is_error);
    return {
      error: loggedIn ? undefined : (parsed?.result || probe.error || 'Claude Code 没有返回结果。'),
      executable,
      installed: true,
      loggedIn,
      ok: loggedIn,
      version: versionText,
    };
  }

  async function runTask(request = {}) {
    const prompt = String(request.prompt || '').trim();
    const workspacePath = String(request.workspacePath || '').trim();
    if (!prompt) return { ok: false, error: '需要任务内容。' };
    if (!workspacePath || !isDirectory(workspacePath)) return { ok: false, error: `项目文件夹不存在：${workspacePath || '（没填）'}` };
    if (running) return { ok: false, error: '开发助手正在做上一件事，等它做完再交新任务。' };
    const executable = resolveClaudeExecutable(request.executablePath);
    if (!executable) return { ok: false, error: '没找到 Claude Code，请先安装或在设置里填它的路径。' };
    running = true;
    const startedAt = Date.now();
    log('task started', { workspacePath });
    try {
      const timeoutMs = Number(request.timeoutMs) > 0 ? Number(request.timeoutMs) : DEFAULT_TIMEOUT_MS;
      const modelArgs = request.model ? ['--model', String(request.model)] : [];
      const baseArgs = ['-p', prompt, '--output-format', 'json', '--permission-mode', 'acceptEdits', ...modelArgs, ...allowedCommandArgs(request.allowedCommands)];
      // Continuing the same progress card resumes its session, so the assistant remembers what it already changed.
      const resumeId = SESSION_ID_PATTERN.test(String(request.resumeSessionId || '')) ? String(request.resumeSessionId) : '';
      let result = await runClaude(executable, resumeId ? [...baseArgs, '--resume', resumeId] : baseArgs, { cwd: workspacePath, env: request.env, timeoutMs });
      let resumeLost = false;
      if (resumeId && MISSING_SESSION_PATTERN.test(String(result.stdout || '') + String(result.stderr || ''))) {
        resumeLost = true;
        log('resume session missing, starting fresh');
        result = await runClaude(executable, baseArgs, { cwd: workspacePath, env: request.env, timeoutMs });
      }
      const parsed = parseClaudeJson(result.stdout);
      const durationMs = Date.now() - startedAt;
      log('task finished', { durationMs, isError: parsed?.is_error ?? null, resumed: Boolean(resumeId && !resumeLost), timedOut: Boolean(result.timedOut) });
      if (!parsed) return { durationMs, error: result.error || String(result.stderr || '').trim().slice(0, 500) || 'Claude Code 没有返回结果。', ok: false, resumeLost };
      return {
        resumed: Boolean(resumeId && !resumeLost),
        resumeLost,
        sessionId: typeof parsed.session_id === 'string' && SESSION_ID_PATTERN.test(parsed.session_id) ? parsed.session_id : undefined,
        costUsd: typeof parsed.total_cost_usd === 'number' ? parsed.total_cost_usd : undefined,
        deniedCount: Array.isArray(parsed.permission_denials) ? parsed.permission_denials.length : 0,
        durationMs,
        error: parsed.is_error ? String(parsed.result || '出错了') : undefined,
        ok: !parsed.is_error,
        result: String(parsed.result || ''),
        turns: typeof parsed.num_turns === 'number' ? parsed.num_turns : undefined,
      };
    } finally {
      running = false;
    }
  }

  /** Opens a console window running `claude auth login`; it opens the browser sign-in page. */
  function login(request = {}) {
    const executable = resolveClaudeExecutable(request.executablePath);
    if (!executable) return { ok: false, error: '没找到 Claude Code。' };
    try {
      const child = spawn('cmd.exe', ['/c', `start "Claude 登录" "${executable}" auth login --claudeai`], {
        detached: true, stdio: 'ignore', windowsVerbatimArguments: true,
      });
      child.unref();
      log('login window opened');
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  return { login, runTask, status };
}

function registerDevAgentIpcHandlers({ ipcMain, service, shell }) {
  ipcMain.handle('desktop-pet:dev-agent-status', (_event, request) => service.status(request ?? {}));
  ipcMain.handle('desktop-pet:dev-agent-run', (_event, request) => service.runTask(request ?? {}));
  ipcMain.handle('desktop-pet:dev-agent-login', (_event, request) => service.login(request ?? {}));
  ipcMain.handle('desktop-pet:dev-agent-open-key-page', async (_event, url) => {
    if (!KEY_PAGE_URLS.has(String(url))) return { ok: false, error: '不认识的地址。' };
    await shell.openExternal(String(url));
    return { ok: true };
  });
}

module.exports = { KEY_PAGE_URLS, allowedCommandArgs, createDevAgentService, parseClaudeJson, registerDevAgentIpcHandlers, resolveClaudeExecutable };
