// "导出诊断信息" (2026-11-05): the released app writes no log file, so when something goes wrong
// for someone else there was nothing to look at. This writes one text file the user picks a place
// for: versions, system, which model service (host only), update state, the voice runtime
// location, installed plugin names and the last runtime log lines (kept in memory anyway).
// No chat text, no keys: user names in paths become <user>, key- and token-like strings are
// masked, and the file says to look it over before sending it.

const fs = require('fs');
const os = require('os');
const path = require('path');

const SECRET_PATTERNS = [
  /\b(sk|pk|rk|ak)-[A-Za-z0-9_-]{8,}/gu,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/giu,
  /\b(?:api[_-]?key|access[_-]?token|token|secret|password|passwd|authorization)\b(\s*[:=]\s*)("?)[^\s",}]{4,}/giu,
  /\b[A-Fa-f0-9]{32,}\b/gu,
  /\bAIza[0-9A-Za-z_-]{20,}/gu,
];

/** User names in paths and anything that looks like a key or token. */
function redactDiagnosticsText(text, { homeDir = os.homedir(), userName = os.userInfo().username } = {}) {
  let out = String(text ?? '');
  const homeName = path.win32.basename(homeDir.replace(/\//gu, '\\'));
  const homes = [homeDir.replace(/\\/gu, '\\\\'), homeDir, homeDir.replace(/\\/gu, '/')].filter(Boolean);
  // Each spelling keeps its own separators: C:\Users\<user>, C:/Users/<user>.
  for (const home of homes) out = out.split(home).join(`${home.slice(0, home.length - homeName.length)}<user>`);
  if (userName && userName.length >= 3) out = out.replace(new RegExp(`([\\\\/])${userName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}([\\\\/])`, 'giu'), '$1<user>$2');
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (match, ...groups) => (typeof groups[0] === 'string' && /^\s*[:=]\s*$/u.test(groups[0]) ? `${match.split(groups[0])[0]}${groups[0]}${groups[1] || ''}***` : '***'));
  }
  return out;
}

// Log fields that can carry what the user or the character said, character names, or what a
// tool was given (typed text, search words). Only their names stay.
const CONTENT_FIELDS = /\b(text|window|windowTitle|activeTitle|petName|petNames|roleName|characterName|goal|query|prompt|transcript|reply|content|caption|title|preview|input|userInput|outgoingText|summary|keyword)\b: (.*?)(?=, [A-Za-z][A-Za-z0-9_]*: |\}\s*$|$)/gu;
const TOOL_ARGUMENTS = /\b([a-z][a-z0-9_]*)\{"[^}]*\}?/giu;

/** One runtime log line with the words people said or typed taken out. */
function redactLogLine(line) {
  return String(line)
    .replace(TOOL_ARGUMENTS, '$1{…}')
    .replace(CONTENT_FIELDS, '$1: <略>');
}

function readText(file, maxBytes = 20_000) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    return text.length > maxBytes ? `…（前面省略）\n${text.slice(-maxBytes)}` : text;
  } catch {
    return '';
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function hostOf(url) {
  try {
    return new URL(String(url)).host;
  } catch {
    return '';
  }
}

/** Only fields that help find a problem; never keys, never chat or persona text. */
function summarizeSettings(config) {
  const settings = config?.config?.settings ?? config?.settings ?? {};
  const pets = config?.config?.desktopPets ?? config?.desktopPets;
  return {
    apiHost: hostOf(settings.customApiUrl) || '(未填)',
    characterCount: Array.isArray(pets) ? pets.length : undefined,
    llmModel: settings.llmProvider === 'gemini' ? settings.llmModel : settings.customModelName,
    llmProvider: settings.llmProvider,
    memoryDepth: settings.memoryDepth,
    ttsProvider: settings.ttsProvider ?? settings.voiceProvider,
    webSearchEnabled: settings.webSearchEnabled,
  };
}

function summarizeMcp(mcpConfig) {
  const servers = mcpConfig?.servers ?? mcpConfig?.mcpServers;
  const list = Array.isArray(servers) ? servers.map((server) => [server?.id, server]) : servers && typeof servers === 'object' ? Object.entries(servers) : [];
  return list.map(([id, server]) => `${id}${server?.disabled ? '（已关）' : ''}`).join('、') || '（没有）';
}

function buildDiagnosticsReport({ app, displays = [], logLines = [], mcpConfig = null, now = new Date(), persistedConfig = null, userDataDir }) {
  const update = readJson(path.join(userDataDir, 'app-updates', 'state.json'));
  const sections = [
    'AI Pets Hub 诊断信息',
    `导出时间：${now.toISOString()}`,
    '这个文件不含聊天内容和密钥；路径里的用户名已换成 <user>。发给别人之前可以先打开看一遍。',
    '',
    '== 版本和系统 ==',
    `软件版本：${global.__appUpdateBoot?.version ?? app.getVersion()}（安装包 ${app.getVersion()}${app.isPackaged ? '' : '，开发版'}）`,
    `Electron ${process.versions.electron} · Chrome ${process.versions.chrome} · Node ${process.versions.node}`,
    `系统：${os.type()} ${os.release()} ${os.arch()} · 内存 ${Math.round(os.totalmem() / 1024 ** 3)} GB · CPU ${os.cpus()?.[0]?.model ?? '?'} ×${os.cpus()?.length ?? '?'}`,
    `语言：${app.getLocale?.() ?? ''} · 屏幕：${displays.map((display) => `${display.size?.width}x${display.size?.height}@${display.scaleFactor}${display.primary ? '（主）' : ''}`).join('，') || '?'}`,
    '',
    '== 设置摘要 ==',
    JSON.stringify(summarizeSettings(persistedConfig), null, 1),
    '',
    '== 插件（MCP） ==',
    summarizeMcp(mcpConfig),
    '',
    '== 软件更新 ==',
    update ? JSON.stringify({ active: update.active, attempts: update.attempts, autoDownload: update.autoDownload, bad: update.bad, good: update.good, pending: update.pending }, null, 1) : '（没有更新记录）',
    readText(path.join(userDataDir, 'app-updates', 'boot-errors.log'), 8_000) ? `启动错误：\n${readText(path.join(userDataDir, 'app-updates', 'boot-errors.log'), 8_000)}` : '启动错误：没有',
    '',
    '== 语音运行环境 ==',
    readText(path.join(userDataDir, 'voice-runtime-location.json'), 4_000) || '（没有记录）',
    '',
    `== 最近的运行日志（${logLines.length} 条，旧的在前） ==`,
    ...[...logLines].reverse().map(redactLogLine),
  ];
  return redactDiagnosticsText(sections.join('\n'));
}

function registerDiagnosticsExport({ app, dialog, getMainWindow, ipcMain, log, getLogLines, loadMcpConfig, loadPersistedConfig, screen }) {
  ipcMain.handle('desktop-pet:export-diagnostics', async () => {
    try {
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/gu, '');
      const choice = await dialog.showSaveDialog(getMainWindow?.() ?? undefined, {
        defaultPath: path.join(app.getPath('downloads'), `ai-pets-hub-diagnostics-${stamp}.txt`),
        filters: [{ extensions: ['txt'], name: '文本文件' }],
        title: '导出诊断信息',
      });
      if (choice.canceled || !choice.filePath) return { cancelled: true, ok: false };
      const report = buildDiagnosticsReport({
        app,
        displays: (screen?.getAllDisplays?.() ?? []).map((display) => ({ ...display, primary: display.id === screen.getPrimaryDisplay?.().id })),
        logLines: getLogLines?.() ?? [],
        mcpConfig: (() => { try { return loadMcpConfig?.()?.config ?? null; } catch { return null; } })(),
        persistedConfig: (() => { try { return loadPersistedConfig?.() ?? null; } catch { return null; } })(),
        userDataDir: app.getPath('userData'),
      });
      fs.writeFileSync(choice.filePath, report, 'utf8');
      log?.('diagnostics exported', { bytes: Buffer.byteLength(report) });
      return { ok: true, path: choice.filePath };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
  });
}

module.exports = { buildDiagnosticsReport, redactDiagnosticsText, redactLogLine, registerDiagnosticsExport, summarizeSettings };
