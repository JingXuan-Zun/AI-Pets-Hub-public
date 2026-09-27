const { execFile, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { TextDecoder } = require('util');
const { shell } = require('electron');
const { getDetectedBrowserCandidates } = require('./browserSearchService.cjs');

const APP_INDEX_CACHE_TTL_MS = 60000;
const APP_SHORTCUT_EXTENSIONS = new Set(['.appref-ms', '.lnk', '.url']);
const APP_EXECUTABLE_EXTENSIONS = new Set(['.exe', ...APP_SHORTCUT_EXTENSIONS]);
const USER_APP_MEMORY_FILE_NAME = 'local-app-memory.v1.json';
const USER_APP_MEMORY_SCHEMA_VERSION = 1;
const USER_APP_MEMORY_MAX_ENTRIES = 200;
const FOCUS_WINDOW_TIMEOUT_MS = 2500;
const POST_LAUNCH_VERIFY_DELAY_MS = 650;
const POST_LAUNCH_VERIFY_POLL_INTERVAL_MS = 120;
// PowerShell startup is noticeably slower on a cold packaged desktop process.
// Keep the index bounded, but do not discard every Windows packaged app at the first cold-start timeout.
const PACKAGED_APP_INDEX_TIMEOUT_MS = 6000;
const PACKAGED_APP_LAUNCH_TIMEOUT_MS = 3000;
const APP_INDEX_MAX_SHORTCUT_DIRECTORIES = 220;
const APP_INDEX_MAX_SHORTCUTS = 600;
const APP_INDEX_MAX_EXECUTABLE_SCAN_DIRECTORIES = 40;
const APP_DISK_FALLBACK_MAX_ROOTS = 10;
const APP_DISK_FALLBACK_MAX_DIRECTORIES = 180;
const APP_DISK_FALLBACK_MAX_FILES = 900;
const APP_DISK_FALLBACK_MAX_DEPTH = 4;
const APP_DISK_FALLBACK_MAX_CANDIDATES = 12;
const BROWSER_CATEGORY_QUERIES = [
  '\u6d4f\u89c8\u5668',
  '\u7f51\u9875\u6d4f\u89c8\u5668',
  '\u9ed8\u8ba4\u6d4f\u89c8\u5668',
  'browser',
  'default browser',
  'internet',
  'internet browser',
  'web browser',
];

function normalizeSearchText(value) {
  return String(value || '')
    .trim()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/\s+/g, '')
    .replace(/[()[\]{}【】（）「」『』"'“”‘’·._\-—:：，。,、]/g, '')
    .toLowerCase();
}

function scoreAppNameMatch(appName, query) {
  const normalizedName = normalizeSearchText(appName);
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedName || !normalizedQuery) {
    return 0;
  }

  if (normalizedName === normalizedQuery) {
    return 100;
  }

  if (normalizedName.startsWith(normalizedQuery)) {
    return 84;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return 72;
  }

  if (normalizedQuery.includes(normalizedName)) {
    return 44;
  }

  return 0;
}

function isBrowserCategoryQuery(query) {
  const normalizedQuery = normalizeSearchText(query);
  return BROWSER_CATEGORY_QUERIES
    .map(normalizeSearchText)
    .includes(normalizedQuery);
}

function uniquePaths(paths) {
  return Array.from(new Set(paths.filter((item) => item && typeof item === 'string')));
}

function uniqueCaseInsensitive(values) {
  const seenValues = new Set();
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seenValues.has(key)) {
        return false;
      }

      seenValues.add(key);
      return true;
    });
}

function getUserAppMemoryPath(app) {
  let userDataPath = '';
  try {
    userDataPath = typeof app?.getPath === 'function' ? app.getPath('userData') : '';
  } catch {
    userDataPath = '';
  }

  return path.join(userDataPath || path.join(os.homedir(), '.ai-desktop-pet'), USER_APP_MEMORY_FILE_NAME);
}

function isSupportedLocalAppPath(appPath) {
  const extension = path.extname(appPath || '').toLowerCase();
  return APP_EXECUTABLE_EXTENSIONS.has(extension);
}

function isExistingLocalAppFile(appPath) {
  try {
    return Boolean(appPath && fs.statSync(appPath).isFile() && isSupportedLocalAppPath(appPath));
  } catch {
    return false;
  }
}

function normalizeAliasList(values) {
  const seenAliases = new Set();

  return (Array.isArray(values) ? values : [values])
    .flatMap((value) => String(value || '').split(/[,\n;；、]/u))
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = normalizeSearchText(value);
      if (!key || seenAliases.has(key)) {
        return false;
      }

      seenAliases.add(key);
      return true;
    });
}

function normalizeRememberedAppEntry(rawEntry) {
  if (!rawEntry || typeof rawEntry !== 'object') {
    return null;
  }

  const appPath = String(rawEntry.path || '').trim().replace(/^["']|["']$/g, '');
  if (!isExistingLocalAppFile(appPath)) {
    return null;
  }

  const extension = path.extname(appPath).toLowerCase();
  const defaultName = path.basename(appPath, extension);
  const name = String(rawEntry.name || defaultName).trim() || defaultName;
  const aliases = normalizeAliasList([
    name,
    defaultName,
    ...(Array.isArray(rawEntry.aliases) ? rawEntry.aliases : []),
  ]);

  return {
    aliases,
    name,
    path: appPath,
    sourceRoot: path.dirname(appPath),
    type: extension.slice(1),
    userDefined: true,
  };
}

function readRememberedApps(memoryPath) {
  try {
    const rawText = fs.readFileSync(memoryPath, 'utf8').trim();
    if (!rawText) {
      return [];
    }

    const parsed = JSON.parse(rawText);
    const rawApps = Array.isArray(parsed?.apps) ? parsed.apps : [];
    return rawApps
      .map(normalizeRememberedAppEntry)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function writeRememberedApps(memoryPath, apps) {
  const normalizedApps = apps
    .map(normalizeRememberedAppEntry)
    .filter(Boolean)
    .slice(0, USER_APP_MEMORY_MAX_ENTRIES);
  const payload = {
    version: USER_APP_MEMORY_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    apps: normalizedApps.map((appEntry) => ({
      aliases: appEntry.aliases,
      name: appEntry.name,
      path: appEntry.path,
      updatedAt: new Date().toISOString(),
    })),
  };
  const tempPath = `${memoryPath}.${process.pid}.tmp`;

  fs.mkdirSync(path.dirname(memoryPath), { recursive: true });
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8');
  fs.copyFileSync(tempPath, memoryPath);
  fs.rmSync(tempPath, { force: true });

  return normalizedApps;
}

function scoreRememberedAppMatch(appEntry, query) {
  const scores = [
    scoreAppNameMatch(appEntry.name, query),
    ...appEntry.aliases.map((alias) => scoreAppNameMatch(alias, query)),
  ];
  const normalizedQuery = normalizeSearchText(query);

  if (appEntry.aliases.some((alias) => normalizeSearchText(alias) === normalizedQuery)) {
    scores.push(120);
  }

  return Math.max(0, ...scores);
}

function getShortcutRoots(app) {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
  const roots = [
    path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(appData, 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned'),
  ];

  try {
    roots.push(app.getPath('desktop'));
  } catch {
    roots.push(path.join(os.homedir(), 'Desktop'));
  }

  try {
    roots.push(path.join(os.homedir(), 'Desktop'));
  } catch {
    // Ignore missing home directories.
  }

  return uniquePaths(roots);
}

function getTaskbarPinnedRoot() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned', 'TaskBar');
}

function getDiskFallbackRoots() {
  const roots = [
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
    process.env.LOCALAPPDATA,
    process.env.APPDATA,
    process.env.PROGRAMDATA,
    process.env.HOMEDRIVE ? `${process.env.HOMEDRIVE}\\` : '',
    path.parse(process.cwd()).root,
  ];

  if (process.platform === 'win32') {
    for (let code = 67; code <= 90 && roots.length < APP_DISK_FALLBACK_MAX_ROOTS + 12; code += 1) {
      roots.push(`${String.fromCharCode(code)}:\\`);
    }
  }

  return uniquePaths(roots)
    .filter(Boolean)
    .filter((root) => {
      try {
        return fs.statSync(root).isDirectory();
      } catch {
        return false;
      }
    })
    .slice(0, APP_DISK_FALLBACK_MAX_ROOTS);
}

function isLikelyAppContainerDirectory(name, query) {
  const normalizedName = normalizeSearchText(name);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedName) {
    return false;
  }

  return Boolean(
    normalizedQuery && (
      normalizedName.includes(normalizedQuery)
      || normalizedQuery.includes(normalizedName)
      || scoreAppNameMatch(name, query) >= 45
    ),
  ) || /^(?:program files|program files \(x86\)|games?|apps?|applications?|launchers?|tencent|riot games|steam|steamapps|steamlibrary|epic games|netease|mihoyo|hoyoplay|bilibili|wegame)$/iu.test(name);
}

function isPathInside(rootPath, candidatePath) {
  const normalizedRoot = path.resolve(rootPath || '').toLowerCase();
  const normalizedCandidate = path.resolve(candidatePath || '').toLowerCase();
  return Boolean(normalizedRoot && normalizedCandidate && (
    normalizedCandidate === normalizedRoot
    || normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`)
  ));
}

async function walkShortcutRoot(root, shortcuts, state = { directoriesVisited: 0 }, depth = 0) {
  const queue = [{ depth, root }];

  while (
    queue.length
    && state.directoriesVisited < APP_INDEX_MAX_SHORTCUT_DIRECTORIES
    && shortcuts.length < APP_INDEX_MAX_SHORTCUTS
  ) {
    const current = queue.shift();
    if (!current || current.depth > 8) {
      continue;
    }
    state.directoriesVisited += 1;

    let entries = [];
    try {
      entries = await fs.promises.readdir(current.root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (shortcuts.length >= APP_INDEX_MAX_SHORTCUTS) {
        break;
      }

      const fullPath = path.join(current.root, entry.name);

      if (entry.isDirectory()) {
        queue.push({ depth: current.depth + 1, root: fullPath });
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (!APP_SHORTCUT_EXTENSIONS.has(extension)) {
        continue;
      }

      shortcuts.push({
        name: path.basename(entry.name, extension),
        path: fullPath,
        sourceRoot: current.root,
        type: extension.slice(1),
      });
    }
  }
}

function createAppLauncherService({
  app,
  log,
  packagedAppLauncher,
  packagedAppProvider,
  screen,
  shellApi = shell,
} = {}) {
  let cachedApps = [];
  let cacheUpdatedAt = 0;
  const shortcutTargetPathCache = new Map();
  const userAppMemoryPath = getUserAppMemoryPath(app);

  function logMessage(message, details) {
    if (typeof log === 'function') {
      log(message, details);
    }
  }

  function normalizeRectLike(rect) {
    if (!rect || typeof rect !== 'object') {
      return null;
    }

    const x = Number(rect.x);
    const y = Number(rect.y);
    const width = Number(rect.width);
    const height = Number(rect.height);
    if (
      !Number.isFinite(x)
      || !Number.isFinite(y)
      || !Number.isFinite(width)
      || !Number.isFinite(height)
    ) {
      return null;
    }

    return {
      height: Math.max(0, Math.round(height)),
      width: Math.max(0, Math.round(width)),
      x: Math.round(x),
      y: Math.round(y),
    };
  }

  function nativeScreenPointToDipPoint(point) {
    if (
      screen
      && typeof screen.screenToDipPoint === 'function'
      && Number.isFinite(point?.x)
      && Number.isFinite(point?.y)
    ) {
      try {
        const convertedPoint = screen.screenToDipPoint({
          x: Math.round(point.x),
          y: Math.round(point.y),
        });
        if (
          convertedPoint
          && Number.isFinite(convertedPoint.x)
          && Number.isFinite(convertedPoint.y)
        ) {
          return {
            x: Math.round(convertedPoint.x),
            y: Math.round(convertedPoint.y),
          };
        }
      } catch (error) {
        logMessage('window coordinate conversion failed', error?.stack || error);
      }
    }

    return {
      x: Math.round(point.x),
      y: Math.round(point.y),
    };
  }

  function nativeScreenRectToDipRect(rect) {
    const nativeRect = normalizeRectLike(rect);
    if (!nativeRect) {
      return null;
    }

    const topLeft = nativeScreenPointToDipPoint({
      x: nativeRect.x,
      y: nativeRect.y,
    });
    const bottomRight = nativeScreenPointToDipPoint({
      x: nativeRect.x + nativeRect.width,
      y: nativeRect.y + nativeRect.height,
    });

    return {
      coordinateSpace: 'dip',
      height: Math.max(0, Math.round(Math.abs(bottomRight.y - topLeft.y))),
      width: Math.max(0, Math.round(Math.abs(bottomRight.x - topLeft.x))),
      x: topLeft.x,
      y: topLeft.y,
    };
  }

  function listRememberedApps() {
    return readRememberedApps(userAppMemoryPath);
  }

  function searchRememberedApps(query, options = {}) {
    const normalizedQuery = String(query || '').trim();
    const limit = Math.max(1, Math.min(20, Math.round(Number(options?.limit ?? 6))));

    if (!normalizedQuery) {
      return [];
    }

    return listRememberedApps()
      .map((item) => ({
        ...item,
        score: scoreRememberedAppMatch(item, normalizedQuery),
      }))
      .filter((item) => item.score > 0)
      .sort((first, second) => (
        second.score - first.score
        || first.name.length - second.name.length
        || first.name.localeCompare(second.name, 'zh-Hans-CN')
      ))
      .slice(0, limit);
  }

  function createDetectedBrowserAppEntries() {
    return getDetectedBrowserCandidates()
      .map((candidate) => createLocalAppEntry(candidate.browserLabel, candidate.path, 'exe', {
        aliases: [
          candidate.browserLabel,
          candidate.browserLabel === 'Chrome' ? 'Google Chrome' : '',
          candidate.browserLabel === 'Edge' ? 'Microsoft Edge' : '',
          path.basename(candidate.path || '', path.extname(candidate.path || '')),
        ],
        category: 'browser',
      }));
  }

  function sanitizeInstalledAppPath(value) {
    let text = String(value || '').trim();
    if (!text) {
      return '';
    }

    text = text
      .replace(/^["']|["']$/g, '')
      .replace(/^\s*@/u, '')
      .replace(/,-?\d+\s*$/u, '')
      .trim();

    const quotedMatch = text.match(/^"([^"]+)"/u);
    if (quotedMatch?.[1]) {
      return quotedMatch[1].trim();
    }

    const executableMatch = text.match(/^(.+?\.exe)\b/iu);
    if (executableMatch?.[1]) {
      return executableMatch[1].trim();
    }

    return text;
  }

  async function findInstalledAppExecutableInDirectory(rootPath, appName) {
    const root = sanitizeInstalledAppPath(rootPath);
    if (!root) {
      return '';
    }

    let rootStats = null;
    try {
      rootStats = fs.statSync(root);
    } catch {
      return '';
    }

    if (rootStats.isFile() && APP_EXECUTABLE_EXTENSIONS.has(path.extname(root).toLowerCase())) {
      return root;
    }

    if (!rootStats.isDirectory()) {
      return '';
    }

    const normalizedName = normalizeSearchText(appName);
    const queue = [{ depth: 0, directory: root }];
    const candidates = [];
    const visited = new Set();

    while (queue.length && candidates.length < 24) {
      if (visited.size >= APP_INDEX_MAX_EXECUTABLE_SCAN_DIRECTORIES) {
        break;
      }

      const { depth, directory } = queue.shift();
      const key = directory.toLowerCase();
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);

      let entries = [];
      try {
        entries = await fs.promises.readdir(directory, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (depth < 2 && !/^(?:logs?|cache|temp|tmp|unins|uninstall|update|updates|crash|debug)$/iu.test(entry.name)) {
            queue.push({ depth: depth + 1, directory: fullPath });
          }
          continue;
        }

        if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.exe') {
          continue;
        }

        const baseName = path.basename(entry.name, '.exe');
        const normalizedBase = normalizeSearchText(baseName);
        const score = normalizedName && normalizedBase
          ? Math.max(
            scoreAppNameMatch(baseName, appName),
            normalizedBase.includes(normalizedName) ? 80 : 0,
            normalizedName.includes(normalizedBase) ? 52 : 0,
          )
          : 1;

        candidates.push({
          path: fullPath,
          score: score
            - (/(?:unins|uninstall|update|crash|helper|service|setup|install|repair|patch)/iu.test(baseName) ? 60 : 0)
            - depth,
        });
      }
    }

    return candidates
      .sort((first, second) => second.score - first.score || first.path.length - second.path.length)[0]?.path || '';
  }

  function parseInstalledAppRegistryRows(stdout) {
    try {
      const parsed = JSON.parse(String(stdout || '[]').trim() || '[]');
      return Array.isArray(parsed) ? parsed : [parsed].filter(Boolean);
    } catch {
      return [];
    }
  }

  async function createInstalledProgramRegistryEntries() {
    if (process.platform !== 'win32') {
      return [];
    }

    const script = String.raw`
$registryRoots = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)

$items = foreach ($root in $registryRoots) {
  Get-ItemProperty -Path $root -ErrorAction SilentlyContinue |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_.DisplayName) } |
    Select-Object -First 600 -Property DisplayName, DisplayIcon, InstallLocation, Publisher
}

$items | ConvertTo-Json -Depth 4 -Compress
`;

    let rows = [];
    try {
      rows = parseInstalledAppRegistryRows(await runPowerShellScript(script, 1800));
    } catch (error) {
      logMessage('installed app registry scan failed', error?.stack || error);
      return [];
    }

    const seen = new Set();
    const entries = [];
    for (const row of rows) {
      const name = String(row?.DisplayName || '').trim();
      if (!name) {
        continue;
      }

      const displayIconPath = sanitizeInstalledAppPath(row?.DisplayIcon);
      const installLocation = sanitizeInstalledAppPath(row?.InstallLocation);
      const appPath = resolveExistingFile([
        displayIconPath,
        await findInstalledAppExecutableInDirectory(installLocation, name),
      ]);
      if (!appPath || !APP_EXECUTABLE_EXTENSIONS.has(path.extname(appPath).toLowerCase())) {
        continue;
      }

      const key = `${normalizeSearchText(name)}\n${appPath.toLowerCase()}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      entries.push(createLocalAppEntry(name, appPath, path.extname(appPath).slice(1) || 'exe', {
        aliases: [
          name,
          row?.Publisher,
          path.basename(appPath, path.extname(appPath)),
        ],
        category: 'installed-program',
      }));
    }

    return entries;
  }

  function parsePackagedAppRows(value) {
    if (Array.isArray(value)) {
      return value;
    }

    if (value && typeof value === 'object') {
      return [value];
    }

    try {
      const parsed = JSON.parse(String(value || '[]').trim() || '[]');
      return Array.isArray(parsed) ? parsed : [parsed].filter(Boolean);
    } catch {
      return [];
    }
  }

  async function createPackagedAppEntries() {
    if (process.platform !== 'win32') {
      return [];
    }

    let rows = [];
    try {
      if (typeof packagedAppProvider === 'function') {
        rows = parsePackagedAppRows(await packagedAppProvider());
      } else {
        const script = String.raw`
Get-StartApps |
  Where-Object {
    -not [string]::IsNullOrWhiteSpace($_.Name) -and
    -not [string]::IsNullOrWhiteSpace($_.AppID) -and
    ([string]$_.AppID).Contains('!')
  } |
  Select-Object -Property Name, AppID |
  ConvertTo-Json -Depth 3 -Compress
`;
        rows = parsePackagedAppRows(await runPowerShellScript(script, PACKAGED_APP_INDEX_TIMEOUT_MS));
      }
    } catch (error) {
      logMessage('packaged app index scan failed', error?.stack || error);
      return [];
    }

    const seenAppIds = new Set();
    return rows
      .map((row) => {
        const name = String(row?.Name || row?.name || '').trim();
        const appId = String(row?.AppID || row?.AppId || row?.appId || '').trim();
        const appIdKey = appId.toLowerCase();
        if (!name || !appId || !appId.includes('!') || seenAppIds.has(appIdKey)) {
          return null;
        }

        seenAppIds.add(appIdKey);
        return {
          aliases: normalizeAliasList([name, appId]),
          appId,
          category: 'packaged-app',
          name,
          path: '',
          sourceRoot: 'windows-start-apps',
          type: 'aumid',
        };
      })
      .filter(Boolean);
  }

  function scoreIndexedAppMatch(appEntry, query, options = {}) {
    const scores = [
      scoreAppNameMatch(appEntry.name, query),
      ...(Array.isArray(appEntry.aliases)
        ? appEntry.aliases.map((alias) => scoreAppNameMatch(alias, query))
        : []),
    ];

    if (appEntry.userDefined) {
      scores.push(scoreRememberedAppMatch(appEntry, query));
    }

    if (options.browserCategoryQuery && appEntry.category === 'browser') {
      scores.push(96);
    }

    return Math.max(0, ...scores);
  }

  function rememberLocalApp(request = {}) {
    const appPath = String(request?.path || request?.appPath || '').trim().replace(/^["']|["']$/g, '');
    if (!appPath || !path.isAbsolute(appPath) || !isExistingLocalAppFile(appPath)) {
      return {
        ok: false,
        error: 'App path must be an existing .exe, .lnk, .url, or .appref-ms file.',
        app: null,
      };
    }

    const extension = path.extname(appPath).toLowerCase();
    const defaultName = path.basename(appPath, extension);
    const name = String(request?.name || request?.alias || defaultName).trim() || defaultName;
    const aliases = normalizeAliasList([
      name,
      defaultName,
      request?.alias,
      ...(Array.isArray(request?.aliases) ? request.aliases : []),
    ]);
    const nextEntry = normalizeRememberedAppEntry({
      aliases,
      name,
      path: appPath,
    });

    if (!nextEntry) {
      return {
        ok: false,
        error: 'Unable to normalize app memory entry.',
        app: null,
      };
    }

    const nextPathKey = appPath.toLowerCase();
    const nextAliasKeys = new Set(nextEntry.aliases.map(normalizeSearchText));
    const preservedApps = listRememberedApps()
      .filter((entry) => {
        if (entry.path.toLowerCase() === nextPathKey) {
          return false;
        }

        return !entry.aliases.some((alias) => nextAliasKeys.has(normalizeSearchText(alias)));
      });
    const savedApps = writeRememberedApps(userAppMemoryPath, [nextEntry, ...preservedApps]);
    const savedEntry = savedApps[0] ?? nextEntry;
    cachedApps = [];
    cacheUpdatedAt = 0;
    shortcutTargetPathCache.clear();

    logMessage('local app memory saved', {
      aliases: savedEntry.aliases,
      name: savedEntry.name,
      path: savedEntry.path,
    });

    return {
      ok: true,
      app: savedEntry,
      memoryPath: userAppMemoryPath,
    };
  }

  async function buildAppIndex() {
    if (process.platform !== 'win32') {
      return [
        ...listRememberedApps(),
        ...createDetectedBrowserAppEntries(),
        ...await createInstalledProgramRegistryEntries(),
      ];
    }

    const shortcuts = [];
    await Promise.all(getShortcutRoots(app).map((root) => walkShortcutRoot(root, shortcuts)));

    return [
      ...listRememberedApps(),
      ...createDetectedBrowserAppEntries(),
      ...await createPackagedAppEntries(),
      ...await createInstalledProgramRegistryEntries(),
      ...shortcuts,
    ]
      .sort((first, second) => first.name.localeCompare(second.name, 'zh-Hans-CN'));
  }

  async function listApps(options = {}) {
    const forceRefresh = Boolean(options?.forceRefresh);
    if (
      !forceRefresh
      && cacheUpdatedAt > 0
      && Date.now() - cacheUpdatedAt <= APP_INDEX_CACHE_TTL_MS
    ) {
      return cachedApps;
    }

    cachedApps = await buildAppIndex();
    cacheUpdatedAt = Date.now();
    logMessage('local app index refreshed', { count: cachedApps.length });
    return cachedApps;
  }

  async function searchLocalApps(query, options = {}) {
    const normalizedQuery = String(query || '').trim();
    const limit = Math.max(1, Math.min(20, Math.round(Number(options?.limit ?? 6))));
    const browserCategoryQuery = isBrowserCategoryQuery(normalizedQuery);

    if (!normalizedQuery) {
      return [];
    }

    return (await listApps(options))
      .map((item) => ({
        ...item,
        score: scoreIndexedAppMatch(item, normalizedQuery, { browserCategoryQuery }),
      }))
      .filter((item) => item.score > 0)
      .sort((first, second) => (
        second.score - first.score
        || Number(Boolean(second.userDefined)) - Number(Boolean(first.userDefined))
        || first.name.length - second.name.length
        || first.name.localeCompare(second.name, 'zh-Hans-CN')
      ))
      .slice(0, limit);
  }

  async function searchDiskFallbackApps(query, options = {}) {
    const normalizedQuery = normalizeSearchText(query);
    const limit = Math.max(1, Math.min(APP_DISK_FALLBACK_MAX_CANDIDATES, Math.round(Number(options?.limit ?? 6))));
    if (!normalizedQuery || process.platform !== 'win32') {
      return [];
    }

    const maxDepth = Math.max(1, Math.min(APP_DISK_FALLBACK_MAX_DEPTH, Math.round(Number(options?.maxDepth ?? APP_DISK_FALLBACK_MAX_DEPTH))));
    const roots = getDiskFallbackRoots();
    const queue = roots.map((root) => ({ depth: 0, directory: root }));
    const visited = new Set();
    const candidates = [];
    let scannedFiles = 0;

    while (
      queue.length
      && visited.size < APP_DISK_FALLBACK_MAX_DIRECTORIES
      && scannedFiles < APP_DISK_FALLBACK_MAX_FILES
      && candidates.length < APP_DISK_FALLBACK_MAX_CANDIDATES
    ) {
      const { depth, directory } = queue.shift();
      const key = String(directory || '').toLowerCase();
      if (!key || visited.has(key)) {
        continue;
      }
      visited.add(key);

      let entries = [];
      try {
        entries = await fs.promises.readdir(directory, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (scannedFiles >= APP_DISK_FALLBACK_MAX_FILES || candidates.length >= APP_DISK_FALLBACK_MAX_CANDIDATES) {
          break;
        }

        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (
            depth < maxDepth
            && !/^(?:windows|\$recycle\.bin|system volume information|node_modules|cache|temp|tmp|logs?|debug|backup|packages?)$/iu.test(entry.name)
            && (depth < 1 || isLikelyAppContainerDirectory(entry.name, query))
          ) {
            queue.push({ depth: depth + 1, directory: fullPath });
          }
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }
        scannedFiles += 1;

        const extension = path.extname(entry.name).toLowerCase();
        if (!APP_EXECUTABLE_EXTENSIONS.has(extension)) {
          continue;
        }

        const baseName = path.basename(entry.name, extension);
        const score = Math.max(
          scoreAppNameMatch(baseName, query),
          normalizeSearchText(fullPath).includes(normalizedQuery) ? 72 : 0,
        ) - depth - (/(?:unins|uninstall|update|crash|helper|service|setup|install|repair|patch|redist|vcredist)/iu.test(baseName) ? 70 : 0);

        if (score <= 0) {
          continue;
        }

        candidates.push(createLocalAppEntry(baseName, fullPath, extension.slice(1), {
          aliases: [query, baseName],
          category: 'disk-fallback',
        }));
        candidates[candidates.length - 1].score = score;
      }
    }

    const seen = new Set();
    return candidates
      .filter((item) => {
        const key = String(item.path || '').toLowerCase();
        if (!key || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .sort((first, second) => (
        (second.score ?? 0) - (first.score ?? 0)
        || first.name.length - second.name.length
        || first.path.length - second.path.length
      ))
      .slice(0, limit);
  }

  function resolveDirectAppPath(query) {
    const normalizedQuery = String(query || '').trim().replace(/^["']|["']$/g, '');
    if (!normalizedQuery || !path.isAbsolute(normalizedQuery)) {
      return null;
    }

    let stats = null;
    try {
      stats = fs.statSync(normalizedQuery);
    } catch {
      return null;
    }

    if (!stats.isFile()) {
      return null;
    }

    const extension = path.extname(normalizedQuery).toLowerCase();
    if (!['.appref-ms', '.exe', '.lnk', '.url'].includes(extension)) {
      return null;
    }

    return {
      name: path.basename(normalizedQuery, extension),
      path: normalizedQuery,
      sourceRoot: path.dirname(normalizedQuery),
      type: extension.slice(1),
    };
  }

  function createLocalAppEntry(name, appPath, type = path.extname(appPath).slice(1) || 'exe', options = {}) {
    return {
      aliases: normalizeAliasList([
        name,
        path.basename(appPath || '', path.extname(appPath || '')),
        ...(Array.isArray(options.aliases) ? options.aliases : []),
      ]),
      category: options.category || undefined,
      name,
      path: appPath,
      sourceRoot: path.dirname(appPath),
      type,
    };
  }

  function resolveExistingFile(paths) {
    return paths.find((candidatePath) => {
      try {
        return candidatePath && fs.statSync(candidatePath).isFile();
      } catch {
        return false;
      }
    }) ?? null;
  }

  function execFileAsync(file, args, options = {}) {
    return new Promise((resolve, reject) => {
      execFile(file, args, options, (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
          return;
        }

        resolve(stdout);
      });
    });
  }

  function spawnDetachedAsync(file, args, options = {}) {
    return new Promise((resolve, reject) => {
      let child = null;
      let settled = false;
      const timeoutMs = Math.max(0, Number(options.timeoutMs) || 0);
      const spawnOptions = { ...options };
      delete spawnOptions.timeoutMs;
      let timeoutId = null;
      const settle = (callback, value) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        callback(value);
      };

      try {
        child = spawn(file, args, {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
          ...spawnOptions,
        });
      } catch (error) {
        reject(error);
        return;
      }

      child.once('error', (error) => settle(reject, error));
      child.once('spawn', () => {
        child.unref();
        settle(resolve);
      });
      if (timeoutMs > 0) {
        timeoutId = setTimeout(
          () => settle(reject, new Error('Detached process dispatch timed out.')),
          timeoutMs,
        );
      }
    });
  }

  async function readRegistryAppPath(appFileName) {
    const registryKeys = [
      `HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${appFileName}`,
      `HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${appFileName}`,
      `HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${appFileName}`,
    ];

    for (const registryKey of registryKeys) {
      try {
        const stdout = await execFileAsync('reg.exe', ['query', registryKey, '/ve'], {
          encoding: 'utf8',
          timeout: 1200,
          windowsHide: true,
        });
        const line = String(stdout || '')
          .split(/\r?\n/u)
          .find((item) => item.includes('REG_SZ'));
        const match = line?.match(/REG_SZ\s+(.+?)\s*$/u);
        const appPath = match?.[1]?.trim() ?? '';
        if (appPath && fs.existsSync(appPath)) {
          return appPath;
        }
      } catch {
        // Registry probing is only a convenience fallback.
      }
    }

    return null;
  }

  function stripPowerShellCliXml(value) {
    return String(value || '')
      .replace(/^\uFEFF/u, '')
      .replace(/#<\s*CLIXML[\s\S]*$/u, '')
      .trim();
  }

  function countTextMatches(value, pattern) {
    return (String(value || '').match(pattern) || []).length;
  }

  function decodePowerShellOutput(value) {
    if (Buffer.isBuffer(value)) {
      if (value.length === 0) {
        return '';
      }

      const utf8 = value.toString('utf8');
      if (!utf8.includes('\uFFFD') && !utf8.includes('\u0000')) {
        return utf8;
      }

      const candidates = [
        utf8,
        value.length >= 2 && value[0] === 0xff && value[1] === 0xfe
          ? value.subarray(2).toString('utf16le')
          : value.toString('utf16le'),
      ];

      try {
        candidates.push(new TextDecoder('gb18030').decode(value));
      } catch {
        // Some runtimes may not expose gb18030; utf8/utf16le still cover most cases.
      }

      return candidates
        .map((text, index) => ({
          index,
          score:
            countTextMatches(text, /\uFFFD/g) * 100
            + countTextMatches(text, /\u0000/g) * 50
            + countTextMatches(text, /[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g) * 25,
          text,
        }))
        .sort((first, second) => first.score - second.score || first.index - second.index)[0]?.text || utf8;
    }

    return String(value || '');
  }

  function compactPowerShellErrorText(value, maxLength = 900) {
    const text = stripPowerShellCliXml(decodePowerShellOutput(value))
      .replace(/\s+/g, ' ')
      .replace(/-EncodedCommand\s+[A-Za-z0-9+/=]+/g, '-EncodedCommand <redacted>')
      .trim();
    if (!text) {
      return '';
    }

    return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
  }

  async function runPowerShellScript(script, timeout = FOCUS_WINDOW_TIMEOUT_MS) {
    const prologue = [
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
      '[Console]::InputEncoding = [System.Text.Encoding]::UTF8',
      '$OutputEncoding = [System.Text.Encoding]::UTF8',
      "$ProgressPreference = 'SilentlyContinue'",
      "$InformationPreference = 'SilentlyContinue'",
      "$VerbosePreference = 'SilentlyContinue'",
    ].join('\n');
    const fullScript = `${prologue}\n${script}`;
    const encodedCommand = Buffer.from(fullScript, 'utf16le').toString('base64');
    const encodedArgs = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-OutputFormat', 'Text', '-EncodedCommand', encodedCommand];
    const shouldUseScriptFile = encodedArgs.join(' ').length > 7000;
    const scriptPath = shouldUseScriptFile
      ? path.join(os.tmpdir(), `ai-desktop-pet-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`)
      : '';
    const args = shouldUseScriptFile
      ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-OutputFormat', 'Text', '-File', scriptPath]
      : encodedArgs;

    try {
      if (shouldUseScriptFile) {
        fs.writeFileSync(scriptPath, `\uFEFF${fullScript}`, 'utf8');
      }

      const stdout = await execFileAsync(
        'powershell.exe',
        args,
        {
          encoding: 'buffer',
          timeout,
          windowsHide: true,
        },
      );
      return stripPowerShellCliXml(decodePowerShellOutput(stdout));
    } catch (error) {
      const stderr = compactPowerShellErrorText(error?.stderr);
      const stdout = compactPowerShellErrorText(error?.stdout);
      const message = compactPowerShellErrorText(error instanceof Error ? error.message : String(error));
      throw new Error(stderr || stdout || message || 'PowerShell command failed.');
    } finally {
      if (scriptPath) {
        try {
          fs.rmSync(scriptPath, { force: true });
        } catch {
          // Best-effort cleanup for temporary PowerShell files.
        }
      }
    }
  }

  function createTopLevelWindowEnumeratorPowerShell() {
    return String.raw`
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Text;
using System.Runtime.InteropServices;

public delegate bool DesktopPetTopLevelWindowEnumProc(IntPtr hWnd, IntPtr lParam);

public sealed class DesktopPetTopLevelWindowInfo {
  public long Hwnd;
  public int Pid;
  public string Title;
  public int X;
  public int Y;
  public int Width;
  public int Height;
  public int TopLevelOrder;
}

public sealed class DesktopPetFilteredWindowInfo {
  public long Hwnd;
  public int Pid;
  public string Title;
  public string[] Reasons;
}

public sealed class DesktopPetTopLevelWindowEnumerationResult {
  public DesktopPetTopLevelWindowInfo[] Windows;
  public DesktopPetFilteredWindowInfo[] FilteredOut;
  public int EnumeratedCount;
}

public static class DesktopPetTopLevelWindowEnumerator {
  public const int DWMWA_CLOAKED = 14;
  public const int GWL_EXSTYLE = -20;
  public const UInt32 WM_CLOSE = 0x0010;
  public const int WS_EX_TOOLWINDOW = 0x00000080;

  [DllImport("user32.dll")]
  public static extern bool EnumWindows(DesktopPetTopLevelWindowEnumProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern IntPtr GetShellWindow();

  [DllImport("user32.dll", SetLastError = true)]
  public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowTextLength(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out DesktopPetWindowRect rect);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [DllImport("kernel32.dll")]
  public static extern uint GetCurrentThreadId();

  [DllImport("user32.dll")]
  public static extern bool IsIconic(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsZoomed(IntPtr hWnd);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool PostMessage(IntPtr hWnd, UInt32 Msg, IntPtr wParam, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

  [DllImport("user32.dll")]
  public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

  [DllImport("user32.dll")]
  private static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);

  [DllImport("user32.dll")]
  private static extern bool SetProcessDPIAware();

  [DllImport("dwmapi.dll")]
  public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out int pvAttribute, int cbAttribute);

  private static readonly IntPtr DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = new IntPtr(-4);

  private static void TryEnableDpiAwareness() {
    try {
      if (SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)) {
        return;
      }
    } catch {
    }

    try {
      SetProcessDPIAware();
    } catch {
    }
  }

  public static DesktopPetTopLevelWindowEnumerationResult EnumerateTopLevelWindowsWithDiagnostics() {
    TryEnableDpiAwareness();
    var windows = new List<DesktopPetTopLevelWindowInfo>();
    var filteredOut = new List<DesktopPetFilteredWindowInfo>();
    var enumeratedCount = 0;
    var shellWindow = GetShellWindow();
    EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
      if (hWnd == IntPtr.Zero || hWnd == shellWindow) {
        return true;
      }

      enumeratedCount += 1;
      uint pid;
      GetWindowThreadProcessId(hWnd, out pid);
      var title = ReadWindowText(hWnd);
      var reasons = new List<string>();
      if (!IsWindow(hWnd)) reasons.Add("invalid-window");
      if (!IsWindowVisible(hWnd)) reasons.Add("not-visible");
      if (IsToolWindow(hWnd)) reasons.Add("tool-window");
      if (IsWindowCloaked(hWnd)) reasons.Add("cloaked");
      DesktopPetWindowRect candidateRect;
      if (!GetWindowRect(hWnd, out candidateRect)) {
        reasons.Add("bounds-unavailable");
      } else if (candidateRect.Right - candidateRect.Left < 1 || candidateRect.Bottom - candidateRect.Top < 1) {
        reasons.Add("invalid-bounds");
      }
      if (pid == 0) reasons.Add("missing-pid");
      if (reasons.Count > 0) {
        filteredOut.Add(new DesktopPetFilteredWindowInfo {
          Hwnd = hWnd.ToInt64(),
          Pid = unchecked((int)pid),
          Title = title,
          Reasons = reasons.ToArray(),
        });
        return true;
      }

      DesktopPetWindowRect rect;
      if (!GetWindowRect(hWnd, out rect)) {
        return true;
      }

      var width = Math.Max(0, rect.Right - rect.Left);
      var height = Math.Max(0, rect.Bottom - rect.Top);
      if (width < 1 || height < 1) {
        return true;
      }

      windows.Add(new DesktopPetTopLevelWindowInfo {
        Hwnd = hWnd.ToInt64(),
        Pid = unchecked((int)pid),
        Title = title,
        X = rect.Left,
        Y = rect.Top,
        Width = width,
        Height = height,
        TopLevelOrder = windows.Count,
      });
      return true;
    }, IntPtr.Zero);

    return new DesktopPetTopLevelWindowEnumerationResult {
      EnumeratedCount = enumeratedCount,
      FilteredOut = filteredOut.ToArray(),
      Windows = windows.ToArray(),
    };
  }

  public static DesktopPetTopLevelWindowInfo[] EnumerateTopLevelWindows() {
    return EnumerateTopLevelWindowsWithDiagnostics().Windows;
  }

  public static string ReadWindowText(IntPtr hWnd) {
    var length = Math.Max(1024, GetWindowTextLength(hWnd) + 1);
    var builder = new StringBuilder(length);
    GetWindowText(hWnd, builder, builder.Capacity);
    return builder.ToString();
  }

  private static bool IsToolWindow(IntPtr hWnd) {
    try {
      return (GetWindowLong(hWnd, GWL_EXSTYLE) & WS_EX_TOOLWINDOW) != 0;
    } catch {
      return false;
    }
  }

  private static bool IsWindowCloaked(IntPtr hWnd) {
    try {
      int cloaked;
      return DwmGetWindowAttribute(hWnd, DWMWA_CLOAKED, out cloaked, 4) == 0 && cloaked != 0;
    } catch {
      return false;
    }
  }
}

public struct DesktopPetWindowRect {
  public int Left;
  public int Top;
  public int Right;
  public int Bottom;
}
"@

function Normalize-DesktopPetText($value) {
  if ($null -eq $value) {
    return ''
  }

  return ([string]$value).Trim().ToLowerInvariant() -replace '[\s\p{P}\p{S}_]+', ''
}

function Get-DesktopPetTopLevelWindows {
  $windows = @()
  foreach ($rawWindow in @([DesktopPetTopLevelWindowEnumerator]::EnumerateTopLevelWindows())) {
    $process = $null
    $processPath = ''
    try {
      $process = Get-Process -Id ([int]$rawWindow.Pid) -ErrorAction Stop
      try { $processPath = [string]$process.Path } catch { $processPath = '' }
    } catch {
      continue
    }

    $windows += [PSCustomObject]@{
      bounds = @{
        x = [int]$rawWindow.X
        y = [int]$rawWindow.Y
        width = [int]$rawWindow.Width
        height = [int]$rawWindow.Height
      }
      executablePath = $processPath
      handle = [IntPtr]([int64]$rawWindow.Hwnd)
      hwnd = [int64]$rawWindow.Hwnd
      path = $processPath
      pid = [int]$rawWindow.Pid
      process = $process
      processName = [string]$process.ProcessName
      title = [string]$rawWindow.Title
      topLevelOrder = [int]$rawWindow.TopLevelOrder
    }
  }

  return @($windows)
}

function Get-DesktopPetTopLevelWindowDiagnostics {
  $diagnostics = [DesktopPetTopLevelWindowEnumerator]::EnumerateTopLevelWindowsWithDiagnostics()
  $filtered = @($diagnostics.FilteredOut | Select-Object -First 24 | ForEach-Object {
    [PSCustomObject]@{
      hwnd = [int64]$_.Hwnd
      pid = [int]$_.Pid
      title = [string]$_.Title
      reasons = @($_.Reasons)
    }
  })
  [PSCustomObject]@{
    enumeratedCount = [int]$diagnostics.EnumeratedCount
    filteredOut = $filtered
    windows = @(Get-DesktopPetTopLevelWindows)
  }
}
`;
  }

  async function readShortcutTargetPath(shortcutPath) {
    if (!shortcutPath || path.extname(shortcutPath).toLowerCase() !== '.lnk') {
      return null;
    }

    const cacheKey = shortcutPath.toLowerCase();
    let stat = null;
    try {
      stat = fs.statSync(shortcutPath);
    } catch {
      shortcutTargetPathCache.delete(cacheKey);
      return null;
    }

    const cached = shortcutTargetPathCache.get(cacheKey);
    if (
      cached
      && cached.mtimeMs === stat.mtimeMs
      && cached.size === stat.size
    ) {
      return cached.targetPath;
    }

    try {
      const stdout = await runPowerShellScript(String.raw`
$ErrorActionPreference = 'Stop'
$shortcutPath = @'
${JSON.stringify(shortcutPath)}
'@ | ConvertFrom-Json
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$targetPath = [string]$shortcut.TargetPath
if ([string]::IsNullOrWhiteSpace($targetPath)) {
  ''
} else {
  $targetPath
}
`, 1800);
      const targetPath = String(stdout || '').trim();
      const normalizedTargetPath = targetPath && fs.existsSync(targetPath) ? targetPath : null;
      shortcutTargetPathCache.set(cacheKey, {
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        targetPath: normalizedTargetPath,
      });
      return normalizedTargetPath;
    } catch {
      shortcutTargetPathCache.set(cacheKey, {
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        targetPath: null,
      });
      return null;
    }
  }

  function getProcessNameFromPath(appPath) {
    if (!appPath || typeof appPath !== 'string') {
      return null;
    }

    const extension = path.extname(appPath).toLowerCase();
    if (extension !== '.exe') {
      return null;
    }

    return path.basename(appPath, extension);
  }

  async function buildFocusCandidates(query, selectedApp) {
    const processNames = [];
    const titleQueries = [
      query,
      selectedApp?.name,
    ];

    if (selectedApp?.path) {
      const directProcessName = getProcessNameFromPath(selectedApp.path);
      if (directProcessName) {
        processNames.push(directProcessName);
      }

      const shortcutTargetPath = await readShortcutTargetPath(selectedApp.path);
      const shortcutProcessName = getProcessNameFromPath(shortcutTargetPath);
      if (shortcutProcessName) {
        processNames.push(shortcutProcessName);
      }
    }

    return {
      processNames: uniqueCaseInsensitive(processNames),
      titleQueries: uniqueCaseInsensitive(titleQueries).map(normalizeSearchText).filter(Boolean),
    };
  }

  async function focusExistingAppWindow(query, selectedApp, options = {}) {
    if (process.platform !== 'win32') {
      return {
        ok: false,
        reason: 'focus-existing-window-only-supported-on-windows',
      };
    }

    const requestedPid = Number(options?.pid);
    const requestedHwnd = Number(options?.hwnd ?? options?.windowHandle);
    const hasPid = Number.isFinite(requestedPid) && requestedPid > 0;
    const hasHwnd = Number.isFinite(requestedHwnd) && requestedHwnd > 0;
    const focusCandidates = await buildFocusCandidates(query, selectedApp);
    if (!hasHwnd && !hasPid && !focusCandidates.processNames.length && !focusCandidates.titleQueries.length) {
      return {
        ok: false,
        reason: 'empty-focus-candidates',
      };
    }

    const script = String.raw`
$ErrorActionPreference = 'Stop'
$processNames = @'
${JSON.stringify(focusCandidates.processNames)}
'@ | ConvertFrom-Json
$titleQueries = @'
${JSON.stringify(focusCandidates.titleQueries)}
'@ | ConvertFrom-Json
$requestedPid = ${hasPid ? Math.round(requestedPid) : 0}
$requestedHwnd = ${hasHwnd ? Math.round(requestedHwnd) : 0}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class DesktopPetWindowFocus {
  [DllImport("user32.dll")]
  public static extern bool IsIconic(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
}
"@

function Normalize-DesktopPetText($value) {
  if ($null -eq $value) {
    return ''
  }

  return ([string]$value).Trim().ToLowerInvariant() -replace '[\s\(\)\[\]\{\}"''._\-:：,，。、【】（）「」『』]+', ''
}

${createTopLevelWindowEnumeratorPowerShell()}

$normalizedProcessNames = @($processNames | ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } | Where-Object { $_ })
$normalizedTitleQueries = @($titleQueries | ForEach-Object { Normalize-DesktopPetText $_ } | Where-Object { $_ })
$windows = Get-DesktopPetTopLevelWindows
$matches = @()

foreach ($window in $windows) {
  $processName = ([string]$window.processName).Trim().ToLowerInvariant()
  $title = Normalize-DesktopPetText $window.title
  $processMatch = $normalizedProcessNames -contains $processName
  $titleMatch = $false

  foreach ($titleQuery in $normalizedTitleQueries) {
    if ($title -and $title.Contains($titleQuery)) {
      $titleMatch = $true
      break
    }
  }

  $handleMatch = ($requestedHwnd -gt 0 -and [int64]$window.hwnd -eq $requestedHwnd)
  $pidMatch = ($requestedPid -gt 0 -and [int64]$window.pid -eq $requestedPid)
  if ($handleMatch -or $pidMatch -or $processMatch -or $titleMatch) {
    $matches += [PSCustomObject]@{
      Process = $window
      Score = $(if ($handleMatch) { 10000 } elseif ($pidMatch) { 1000 } elseif ($processMatch) { 100 } else { 60 }) + [Math]::Max(0, 40 - [int]$window.topLevelOrder)
    }
  }
}

$match = $matches | Sort-Object -Property Score -Descending | Select-Object -First 1
if ($null -eq $match) {
  @{ ok = $false; reason = 'no-window-match' } | ConvertTo-Json -Depth 4 -Compress
  exit 0
}

$targetProcess = $match.Process
$handle = [IntPtr]$targetProcess.handle
if ([DesktopPetTopLevelWindowEnumerator]::IsIconic($handle)) {
  [void][DesktopPetTopLevelWindowEnumerator]::ShowWindowAsync($handle, 9)
} else {
  [void][DesktopPetTopLevelWindowEnumerator]::ShowWindowAsync($handle, 5)
}

 $targetAlive = [DesktopPetTopLevelWindowEnumerator]::IsWindow($handle)
 $focused = $false
 $foregroundHwnd = 0
 $foregroundMatchesTarget = $false
 $focusStatus = 'unverified'
for ($attempt = 0; $attempt -lt 5; $attempt++) {
  $targetAlive = [DesktopPetTopLevelWindowEnumerator]::IsWindow($handle)
  if (!$targetAlive) {
    $focusStatus = 'failed'
    break
  }

  $foregroundBeforeHandle = [DesktopPetTopLevelWindowEnumerator]::GetForegroundWindow()
  $foregroundProcessId = [uint32]0
  $foregroundThreadId = $(if ($foregroundBeforeHandle -eq [IntPtr]::Zero) { 0 } else { [DesktopPetTopLevelWindowEnumerator]::GetWindowThreadProcessId($foregroundBeforeHandle, [ref]$foregroundProcessId) })
  $currentThreadId = [DesktopPetTopLevelWindowEnumerator]::GetCurrentThreadId()
  $attached = $false
  if ($foregroundThreadId -gt 0 -and $foregroundThreadId -ne $currentThreadId) {
    $attached = [DesktopPetTopLevelWindowEnumerator]::AttachThreadInput($currentThreadId, $foregroundThreadId, $true)
  }
  try {
    $focused = [DesktopPetTopLevelWindowEnumerator]::SetForegroundWindow($handle)
  } finally {
    if ($attached) {
      [void][DesktopPetTopLevelWindowEnumerator]::AttachThreadInput($currentThreadId, $foregroundThreadId, $false)
    }
  }
  $settleDelay = @(120, 240, 400, 600, 900)[$attempt]
  Start-Sleep -Milliseconds $settleDelay
  $foregroundHandle = [DesktopPetTopLevelWindowEnumerator]::GetForegroundWindow()
  $foregroundHwnd = $(if ($foregroundHandle -eq [IntPtr]::Zero) { 0 } else { [int64]$foregroundHandle.ToInt64() })
  $foregroundMatchesTarget = ([int64]$foregroundHwnd -eq [int64]$targetProcess.hwnd)
  if ($foregroundMatchesTarget) {
    $focusStatus = 'confirmed'
    break
  }
  if ($foregroundHwnd -eq 0) {
    $focusStatus = 'unverified'
    continue
  }
  $focusStatus = 'failed'
}
@{
  ok = [bool]$foregroundMatchesTarget
  hwnd = $targetProcess.hwnd
  processName = $targetProcess.processName
  title = $targetProcess.title
  pid = $targetProcess.pid
  foregroundHwnd = $foregroundHwnd
  foregroundMatchesTarget = $foregroundMatchesTarget
  focusRequestAccepted = [bool]$focused
  focusAttempts = $attempt + 1
  focusStatus = $focusStatus
  targetAlive = $targetAlive
  reason = $(if ($foregroundMatchesTarget) { '' } elseif ($focusStatus -eq 'unverified') { "foreground query remained transient after $($attempt + 1) attempt(s); last foreground hwnd $foregroundHwnd" } else { "foreground hwnd $foregroundHwnd did not match target hwnd $($targetProcess.hwnd)" })
} | ConvertTo-Json -Depth 4 -Compress
`;

    try {
      const stdout = await runPowerShellScript(script);
      const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
      return {
        hwnd: Number.isFinite(Number(parsed?.hwnd)) ? Math.round(Number(parsed.hwnd)) : undefined,
        ok: Boolean(parsed?.ok),
        pid: Number.isFinite(Number(parsed?.pid)) ? Math.round(Number(parsed.pid)) : undefined,
        processName: typeof parsed?.processName === 'string' ? parsed.processName : undefined,
        reason: typeof parsed?.reason === 'string' ? parsed.reason : undefined,
        title: typeof parsed?.title === 'string' ? parsed.title : undefined,
        foregroundHwnd: Number.isFinite(Number(parsed?.foregroundHwnd)) ? Math.round(Number(parsed.foregroundHwnd)) : undefined,
        foregroundMatchesTarget: typeof parsed?.foregroundMatchesTarget === 'boolean' ? parsed.foregroundMatchesTarget : undefined,
        focusStatus: typeof parsed?.focusStatus === 'string' ? parsed.focusStatus : undefined,
        focusRequestAccepted: typeof parsed?.focusRequestAccepted === 'boolean' ? parsed.focusRequestAccepted : undefined,
        focusAttempts: Number.isFinite(Number(parsed?.focusAttempts)) ? Math.round(Number(parsed.focusAttempts)) : undefined,
        targetAlive: typeof parsed?.targetAlive === 'boolean' ? parsed.targetAlive : undefined,
      };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  function normalizeUriScheme(value) {
    return String(value || 'https')
      .trim()
      .replace(/:.*$/u, '')
      .toLowerCase()
      .replace(/[^a-z0-9.+-]/gu, '') || 'https';
  }

  function inferDefaultAppNameFromProgId(progId, command) {
    const text = `${progId || ''} ${command || ''}`.toLowerCase();
    if (text.includes('chrome')) {
      return 'Google Chrome';
    }

    if (text.includes('msedge') || text.includes('microsoft-edge') || text.includes('edge')) {
      return 'Microsoft Edge';
    }

    if (text.includes('firefox')) {
      return 'Firefox';
    }

    if (text.includes('brave')) {
      return 'Brave';
    }

    if (text.includes('opera')) {
      return 'Opera';
    }

    return progId || '';
  }

  function extractExecutablePathFromCommand(command) {
    const text = String(command || '').trim();
    if (!text) {
      return '';
    }

    const quotedMatch = text.match(/"([^"]+\.exe)"/iu);
    if (quotedMatch?.[1]) {
      return quotedMatch[1];
    }

    const bareMatch = text.match(/^([^\s]+\.exe)(?:\s|$)/iu);
    return bareMatch?.[1] || '';
  }

  async function getDefaultAppForUri(request = {}) {
    const uriScheme = normalizeUriScheme(request?.uriScheme || request?.scheme || request?.protocol);
    if (process.platform !== 'win32') {
      return {
        ok: false,
        error: 'Default URI app lookup is currently only implemented on Windows.',
        uriScheme,
      };
    }

    const script = String.raw`
$ErrorActionPreference = 'Stop'
$scheme = @'
${JSON.stringify(uriScheme)}
'@ | ConvertFrom-Json
$progId = ''
$command = ''
try {
  $userChoice = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\$scheme\UserChoice" -ErrorAction Stop
  $progId = [string]$userChoice.ProgId
} catch {
  $progId = ''
}

if (-not [string]::IsNullOrWhiteSpace($progId)) {
  try {
    $commandKey = Get-Item -Path "Registry::HKEY_CLASSES_ROOT\$progId\shell\open\command" -ErrorAction Stop
    $command = [string]$commandKey.GetValue('')
  } catch {
    $command = ''
  }
}

@{
  ok = -not [string]::IsNullOrWhiteSpace($progId)
  uriScheme = $scheme
  progId = $progId
  command = $command
} | ConvertTo-Json -Depth 4 -Compress
`;

    try {
      const stdout = await runPowerShellScript(script, 1800);
      const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
      const command = typeof parsed?.command === 'string' ? parsed.command : '';
      const progId = typeof parsed?.progId === 'string' ? parsed.progId : '';
      const executablePath = extractExecutablePathFromCommand(command);
      return {
        ok: Boolean(parsed?.ok),
        appName: inferDefaultAppNameFromProgId(progId, command),
        command,
        executablePath,
        progId,
        uriScheme,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        uriScheme,
      };
    }
  }

  function normalizeRunningAppWindow(rawWindow) {
    if (!rawWindow || typeof rawWindow !== 'object') {
      return null;
    }

    const pid = Number(rawWindow.pid ?? rawWindow.Id);
    const processName = String(rawWindow.processName ?? rawWindow.ProcessName ?? '').trim();
    const title = String(rawWindow.title ?? rawWindow.MainWindowTitle ?? '').trim();
    const executablePath = String(rawWindow.path ?? rawWindow.Path ?? '').trim();
    const hwnd = Number(rawWindow.hwnd ?? rawWindow.MainWindowHandle);
    const topLevelOrder = Number(rawWindow.topLevelOrder ?? rawWindow.TopLevelOrder);
    const nativeBounds = normalizeRectLike(rawWindow.nativeBounds ?? rawWindow.bounds);
    const bounds = nativeScreenRectToDipRect(nativeBounds);
    if (!Number.isFinite(pid) || (!processName && !title)) {
      return null;
    }

    return {
      bounds,
      coordinateSpace: bounds ? 'dip' : null,
      executablePath,
      active: Boolean(rawWindow.active),
      hwnd: Number.isFinite(hwnd) ? Math.round(hwnd) : null,
      nativeBounds,
      nativeCoordinateSpace: nativeBounds ? 'native-screen' : null,
      pid: Math.round(pid),
      processName,
      title,
      topLevelOrder: Number.isFinite(topLevelOrder) ? Math.round(topLevelOrder) : undefined,
      visible: typeof rawWindow.visible === 'boolean' ? rawWindow.visible : undefined,
    };
  }

  function getDisplaySnapshots() {
    try {
      if (!screen || typeof screen.getAllDisplays !== 'function') {
        return [];
      }

      const primaryDisplay = typeof screen.getPrimaryDisplay === 'function'
        ? screen.getPrimaryDisplay()
        : null;
      return screen.getAllDisplays().map((display, index) => ({
        bounds: display.bounds,
        id: String(display.id),
        index,
        internal: Boolean(display.internal),
        label: display.label || `Display ${index + 1}`,
        primary: Boolean(primaryDisplay && display.id === primaryDisplay.id),
        scaleFactor: display.scaleFactor,
        size: display.size,
        workArea: display.workArea,
      }));
    } catch {
      return [];
    }
  }

  function getRectCenter(bounds) {
    return bounds
      ? {
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2,
        }
      : null;
  }

  function containsPoint(rect, point) {
    return Boolean(rect && point
      && point.x >= rect.x
      && point.x < rect.x + rect.width
      && point.y >= rect.y
      && point.y < rect.y + rect.height);
  }

  function findDisplayForBounds(bounds) {
    const center = getRectCenter(bounds);
    return getDisplaySnapshots().find((display) => containsPoint(display.bounds, center)) ?? null;
  }

  function enrichWindowDisplay(windowInfo) {
    const display = findDisplayForBounds(windowInfo?.bounds);
    if (!display) {
      return windowInfo;
    }

    return {
      ...windowInfo,
      display: {
        bounds: display.bounds,
        id: display.id,
        index: display.index,
        label: display.label,
        primary: display.primary,
        scaleFactor: display.scaleFactor,
      },
      displayId: display.id,
      displayLabel: display.label,
      displaySource: 'best-effort-window-rect',
    };
  }

  async function listRunningApps(request = {}) {
    const query = String(request?.query || request?.target || request?.name || '').trim();
    const includeWindows = request?.includeWindows !== false;
    const limit = Math.max(1, Math.min(80, Math.round(Number(request?.limit ?? 40))));

    if (process.platform !== 'win32') {
      return {
        ok: false,
        error: 'Running app/window listing is currently only implemented on Windows.',
        query,
        apps: [],
        activeWindow: null,
        count: 0,
      };
    }

    const script = String.raw`
$ErrorActionPreference = 'Stop'
${createTopLevelWindowEnumeratorPowerShell()}

$windowDiagnostics = Get-DesktopPetTopLevelWindowDiagnostics
$foregroundHandle = [DesktopPetTopLevelWindowEnumerator]::GetForegroundWindow()
$foregroundHwnd = $(if ($foregroundHandle -eq [IntPtr]::Zero) { 0 } else { [int64]$foregroundHandle.ToInt64() })
$windows = @($windowDiagnostics.windows) | ForEach-Object {
  $windowHwnd = [int64]$_.hwnd
  [PSCustomObject]@{
    active = ($windowHwnd -eq $foregroundHwnd)
    bounds = $_.bounds
    hwnd = $windowHwnd
    pid = $_.pid
    processName = $_.processName
    title = $_.title
    path = $_.path
    topLevelOrder = $_.topLevelOrder
    visible = [DesktopPetTopLevelWindowEnumerator]::IsWindowVisible([IntPtr]([int64]$windowHwnd))
  }
} | Sort-Object -Property processName,title
@{
  enumeratedCount = $windowDiagnostics.enumeratedCount
  filteredOut = @($windowDiagnostics.filteredOut)
  windows = @($windows)
} | ConvertTo-Json -Depth 6 -Compress
`;

    try {
      const stdout = await runPowerShellScript(script, 2600);
      const parsed = JSON.parse(String(stdout || '[]').trim() || '[]');
      const rawWindows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.windows) ? parsed.windows : [];
      const windows = rawWindows
        .map(normalizeRunningAppWindow)
        .filter(Boolean)
        .map(enrichWindowDisplay);
      const activeWindow = windows.find((item) => item.active) ?? null;
      const windowEnumeration = !Array.isArray(parsed)
        ? {
            enumeratedCount: Number.isFinite(Number(parsed?.enumeratedCount)) ? Math.round(Number(parsed.enumeratedCount)) : null,
            filteredOut: Array.isArray(parsed?.filteredOut) ? parsed.filteredOut.slice(0, 24) : [],
          }
        : null;
      const normalizedQuery = normalizeSearchText(query);
      const filteredWindows = normalizedQuery
        ? windows.filter((item) => (
            normalizeSearchText(item.processName).includes(normalizedQuery)
            || normalizeSearchText(item.title).includes(normalizedQuery)
            || normalizeSearchText(item.executablePath).includes(normalizedQuery)
          ))
        : windows;

      if (includeWindows) {
        return {
          ok: true,
          apps: filteredWindows.slice(0, limit),
          activeWindow,
          count: filteredWindows.length,
          query,
          windowEnumeration,
        };
      }

      const groupedApps = [];
      const byProcessName = new Map();
      filteredWindows.forEach((item) => {
        const key = item.processName.toLowerCase();
        const current = byProcessName.get(key);
        if (!current) {
          byProcessName.set(key, {
            executablePath: item.executablePath,
            displayIds: item.displayId ? [item.displayId] : [],
            displays: item.display ? [item.display] : [],
            processName: item.processName,
            titles: item.title ? [item.title] : [],
            windowCount: 1,
          });
          return;
        }

        current.windowCount += 1;
        if (item.title && !current.titles.includes(item.title)) {
          current.titles.push(item.title);
        }
        if (item.displayId && !current.displayIds.includes(item.displayId)) {
          current.displayIds.push(item.displayId);
        }
        if (item.display && !current.displays.some((display) => display.id === item.display.id)) {
          current.displays.push(item.display);
        }
      });
      byProcessName.forEach((item) => groupedApps.push(item));

      return {
        ok: true,
        apps: groupedApps.slice(0, limit),
        activeWindow,
        count: groupedApps.length,
        query,
        windowEnumeration,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        query,
        apps: [],
        activeWindow: null,
        count: 0,
      };
    }
  }

  async function getActiveWindowInfo() {
    if (process.platform !== 'win32') {
      return {
        ok: false,
        error: 'Active window lookup is currently only implemented on Windows.',
      };
    }

    const script = String.raw`
$ErrorActionPreference = 'Stop'
${createTopLevelWindowEnumeratorPowerShell()}

$handle = [DesktopPetTopLevelWindowEnumerator]::GetForegroundWindow()
if ($handle -eq [IntPtr]::Zero) {
  @{ ok = $false; error = 'No foreground window handle.' } | ConvertTo-Json -Depth 4 -Compress
  exit 0
}

$hwnd = [int64]$handle.ToInt64()
$window = @(Get-DesktopPetTopLevelWindows | Where-Object { [int64]$_.hwnd -eq $hwnd } | Select-Object -First 1)
$source = 'top-level-window-enumerator'

if ($null -eq $window) {
  $pidValue = [uint32]0
  [void][DesktopPetTopLevelWindowEnumerator]::GetWindowThreadProcessId($handle, [ref]$pidValue)
  $process = $null
  $processPath = ''
  try {
    $process = Get-Process -Id ([int]$pidValue) -ErrorAction Stop
    try { $processPath = [string]$process.Path } catch { $processPath = '' }
  } catch {
    $process = $null
  }
  $rect = New-Object DesktopPetWindowRect
  $hasRect = [DesktopPetTopLevelWindowEnumerator]::GetWindowRect($handle, [ref]$rect)
  $window = [PSCustomObject]@{
    bounds = $(if ($hasRect) {
      @{
        x = $rect.Left
        y = $rect.Top
        width = [Math]::Max(0, $rect.Right - $rect.Left)
        height = [Math]::Max(0, $rect.Bottom - $rect.Top)
      }
    } else { $null })
    executablePath = $processPath
    hwnd = $hwnd
    path = $processPath
    pid = [int]$pidValue
    processName = $(if ($process) { [string]$process.ProcessName } else { '' })
    title = [DesktopPetTopLevelWindowEnumerator]::ReadWindowText($handle)
    topLevelOrder = -1
  }
  $source = 'foreground-window-fallback'
}

@{
  ok = $true
  active = $true
  bounds = $window.bounds
  executablePath = $window.executablePath
  hwnd = $window.hwnd
  path = $window.path
  pid = $window.pid
  processName = $window.processName
  source = $source
  title = $window.title
  topLevelOrder = $window.topLevelOrder
  visible = [DesktopPetTopLevelWindowEnumerator]::IsWindowVisible($handle)
} | ConvertTo-Json -Depth 6 -Compress
`;

    try {
      const stdout = await runPowerShellScript(script, 1800);
      const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
      const normalizedWindow = normalizeRunningAppWindow(parsed);
      return enrichWindowDisplay({
        ok: Boolean(parsed?.ok),
        active: Boolean(parsed?.active),
      bounds: normalizedWindow?.bounds ?? null,
      coordinateSpace: normalizedWindow?.coordinateSpace ?? null,
      error: typeof parsed?.error === 'string' ? parsed.error : undefined,
      executablePath: normalizedWindow?.executablePath ?? '',
      hwnd: normalizedWindow?.hwnd ?? null,
      nativeBounds: normalizedWindow?.nativeBounds ?? null,
      nativeCoordinateSpace: normalizedWindow?.nativeCoordinateSpace ?? null,
      pid: normalizedWindow?.pid ?? null,
        processName: normalizedWindow?.processName ?? '',
        source: typeof parsed?.source === 'string' ? parsed.source : undefined,
        title: normalizedWindow?.title ?? '',
        topLevelOrder: Number.isFinite(Number(parsed?.topLevelOrder)) ? Math.round(Number(parsed.topLevelOrder)) : undefined,
        visible: Boolean(parsed?.visible),
      });
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async function normalizeAppObservationEntry(item) {
    const taskbarPinnedRoot = getTaskbarPinnedRoot();
    const shortcutTargetPath = item?.path && path.extname(item.path).toLowerCase() === '.lnk'
      ? await readShortcutTargetPath(item.path)
      : null;

    return {
      aliases: Array.isArray(item?.aliases) ? item.aliases.slice(0, 12) : [],
      appId: item?.appId || undefined,
      category: item?.category || undefined,
      name: item?.name || '',
      path: item?.path || '',
      score: typeof item?.score === 'number' ? item.score : undefined,
      shortcutTargetPath: shortcutTargetPath || undefined,
      sourceRoot: item?.sourceRoot || '',
      taskbarPinned: isPathInside(taskbarPinnedRoot, item?.path || item?.sourceRoot || ''),
      type: item?.type || '',
      userDefined: Boolean(item?.userDefined),
    };
  }

  async function listInstalledApps(request = {}) {
    const query = String(request?.query || request?.target || request?.name || '').trim();
    const limit = Math.max(1, Math.min(200, Math.round(Number(request?.limit ?? 80))));
    const forceRefresh = Boolean(request?.forceRefresh);
    const apps = query
      ? await searchLocalApps(query, { forceRefresh, limit })
      : (await listApps({ forceRefresh })).slice(0, limit);

    return {
      ok: true,
      apps: await Promise.all(apps.map((item) => normalizeAppObservationEntry(item))),
      count: apps.length,
      query,
    };
  }

  async function listTaskbarPinnedApps(request = {}) {
    const query = String(request?.query || request?.target || request?.name || '').trim();
    const normalizedQuery = normalizeSearchText(query);
    const limit = Math.max(1, Math.min(80, Math.round(Number(request?.limit ?? 40))));
    const taskbarPinnedRoot = getTaskbarPinnedRoot();
    const normalizedApps = await Promise.all((await listApps({ forceRefresh: Boolean(request?.forceRefresh) }))
      .filter((item) => isPathInside(taskbarPinnedRoot, item.path || item.sourceRoot || ''))
      .map((item) => normalizeAppObservationEntry(item)));
    const apps = normalizedApps
      .filter((item) => (
        !normalizedQuery
        || normalizeSearchText(item.name).includes(normalizedQuery)
        || normalizeSearchText(item.path).includes(normalizedQuery)
        || normalizeSearchText(item.shortcutTargetPath).includes(normalizedQuery)
        || item.aliases.some((alias) => normalizeSearchText(alias).includes(normalizedQuery))
      ))
      .slice(0, limit);

    return {
      ok: true,
      apps,
      count: apps.length,
      query,
      root: taskbarPinnedRoot,
    };
  }

  function createCachedAppObservationNormalizer() {
    const normalizedEntries = new Map();
    return async (item) => {
      const key = [
        item?.path || '',
        item?.sourceRoot || '',
        item?.name || '',
        item?.type || '',
      ].join('\n').toLowerCase();

      if (normalizedEntries.has(key)) {
        return normalizedEntries.get(key);
      }

      const normalizedEntry = await normalizeAppObservationEntry(item);
      normalizedEntries.set(key, normalizedEntry);
      return normalizedEntry;
    };
  }

  function searchAppIndexForObservation(apps, query, limit) {
    const normalizedQuery = String(query || '').trim();
    const browserCategoryQuery = isBrowserCategoryQuery(normalizedQuery);
    if (!normalizedQuery) {
      return apps.slice(0, limit);
    }

    return apps
      .map((item) => ({
        ...item,
        score: scoreIndexedAppMatch(item, normalizedQuery, { browserCategoryQuery }),
      }))
      .filter((item) => item.score > 0)
      .sort((first, second) => (
        second.score - first.score
        || Number(Boolean(second.userDefined)) - Number(Boolean(first.userDefined))
        || first.name.length - second.name.length
        || first.name.localeCompare(second.name, 'zh-Hans-CN')
      ))
      .slice(0, limit);
  }

  async function listObservedInstalledAndTaskbarPinnedApps(request = {}) {
    const query = String(request?.query || request?.target || request?.name || '').trim();
    const normalizedQuery = normalizeSearchText(query);
    const limit = Math.max(1, Math.min(120, Math.round(Number(request?.limit ?? 40))));
    const installedLimit = Math.max(1, Math.min(200, limit));
    const taskbarLimit = Math.max(1, Math.min(80, limit));
    const forceRefresh = Boolean(request?.forceRefresh);
    const taskbarPinnedRoot = getTaskbarPinnedRoot();
    const appIndex = await listApps({ forceRefresh });
    const normalizeForObservation = createCachedAppObservationNormalizer();

    const installedApps = await Promise.all(searchAppIndexForObservation(appIndex, query, installedLimit)
      .map((item) => normalizeForObservation(item)));
    const normalizedTaskbarPinnedApps = await Promise.all(appIndex
      .filter((item) => isPathInside(taskbarPinnedRoot, item.path || item.sourceRoot || ''))
      .map((item) => normalizeForObservation(item)));
    const taskbarPinnedApps = normalizedTaskbarPinnedApps
      .filter((item) => (
        !normalizedQuery
        || normalizeSearchText(item.name).includes(normalizedQuery)
        || normalizeSearchText(item.path).includes(normalizedQuery)
        || normalizeSearchText(item.shortcutTargetPath).includes(normalizedQuery)
        || item.aliases.some((alias) => normalizeSearchText(alias).includes(normalizedQuery))
      ))
      .slice(0, taskbarLimit);

    return {
      installed: {
        ok: true,
        apps: installedApps,
        count: installedApps.length,
        query,
      },
      taskbarPinned: {
        ok: true,
        apps: taskbarPinnedApps,
        count: taskbarPinnedApps.length,
        query,
        root: taskbarPinnedRoot,
      },
    };
  }

  async function observeWindowsAndApps(request = {}) {
    const query = String(request?.query || request?.target || request?.name || '').trim();
    const includeInstalledApps = request?.includeInstalledApps !== false;
    const includeTaskbarPinned = request?.includeTaskbarPinned !== false;
    const includeRunningApps = request?.includeRunningApps !== false;
    const includeActiveWindow = request?.includeActiveWindow !== false;
    const includeDisplays = request?.includeDisplays !== false;
    const limit = Math.max(1, Math.min(120, Math.round(Number(request?.limit ?? 40))));
    const observedAppLists = includeInstalledApps || includeTaskbarPinned
      ? await listObservedInstalledAndTaskbarPinnedApps({ forceRefresh: request?.forceRefresh, limit, query })
      : null;
    const installed = includeInstalledApps
      ? observedAppLists.installed
      : { apps: [], count: 0, ok: true, query };
    const taskbarPinned = includeTaskbarPinned
      ? observedAppLists.taskbarPinned
      : { apps: [], count: 0, ok: true, query, root: getTaskbarPinnedRoot() };
    const running = includeRunningApps
      ? await listRunningApps({ includeWindows: true, limit, query })
      : { apps: [], count: 0, ok: true, query };
    const activeWindow = includeActiveWindow
      ? (
          running.activeWindow
            ? {
                ...running.activeWindow,
                active: true,
                ok: true,
                source: 'running-window-list',
              }
            : await getActiveWindowInfo()
        )
      : null;
    const displays = includeDisplays ? getDisplaySnapshots() : [];

    return {
      ok: Boolean(installed.ok && taskbarPinned.ok && running.ok && (activeWindow === null || activeWindow.ok !== false)),
      activeWindow,
      displays,
      installedApps: installed.apps,
      installedCount: installed.count,
      query,
      runningApps: running.apps,
      runningCount: running.count,
      taskbarPinnedApps: taskbarPinned.apps,
      taskbarPinnedCount: taskbarPinned.count,
      taskbarPinnedRoot: taskbarPinned.root,
    };
  }

  async function inspectWindowUi(request = {}) {
    if (process.platform !== 'win32') {
      return {
        controls: [],
        error: 'Window UI inspection is currently only implemented on Windows.',
        matchedControls: [],
        ok: false,
        window: null,
      };
    }

    const query = String(request?.query || request?.target || request?.name || request?.title || request?.processName || '').trim();
    const targetText = String(request?.targetText || request?.text || request?.label || '').trim();
    const targetDescription = String(request?.targetDescription || request?.description || request?.element || '').trim();
    const rawHwnd = Number(request?.hwnd || request?.windowHandle || request?.handle || 0);
    const limit = Math.max(1, Math.min(200, Math.round(Number(request?.limit ?? 80))));
    const maxDepth = Math.max(1, Math.min(10, Math.round(Number(request?.maxDepth ?? 5))));
    const payloadBase64 = Buffer.from(JSON.stringify({
      hwnd: Number.isFinite(rawHwnd) ? Math.round(rawHwnd) : 0,
      limit,
      maxDepth,
      query,
      targetDescription,
      targetText,
    }), 'utf8').toString('base64');

    const script = String.raw`
$ErrorActionPreference = 'Stop'
${createTopLevelWindowEnumeratorPowerShell()}

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName WindowsBase

$requestJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payloadBase64}'))
$request = $requestJson | ConvertFrom-Json

function Normalize-DesktopPetUiText($value) {
  if ($null -eq $value) {
    return ''
  }

  return ([string]$value).Normalize([System.Text.NormalizationForm]::FormKC).Trim().ToLowerInvariant() -replace '[\s\p{P}\p{S}_]+', ''
}

function Get-DesktopPetWindowMatchScore($window, $query) {
  $normalizedQuery = Normalize-DesktopPetUiText $query
  if ([string]::IsNullOrWhiteSpace($normalizedQuery)) {
    return 0
  }

  $parts = @(
    [string]$window.title,
    [string]$window.processName,
    [IO.Path]::GetFileNameWithoutExtension([string]$window.path),
    [string]$window.path
  )
  $best = 0
  foreach ($part in $parts) {
    $normalizedPart = Normalize-DesktopPetUiText $part
    if ([string]::IsNullOrWhiteSpace($normalizedPart)) {
      continue
    }
    if ($normalizedPart -eq $normalizedQuery) {
      $best = [Math]::Max($best, 100)
    } elseif ($normalizedPart.StartsWith($normalizedQuery)) {
      $best = [Math]::Max($best, 86)
    } elseif ($normalizedPart.Contains($normalizedQuery)) {
      $best = [Math]::Max($best, 74)
    } elseif ($normalizedQuery.Contains($normalizedPart)) {
      $best = [Math]::Max($best, 48)
    }
  }

  return $best
}

function Get-DesktopPetUiMatchScore($name, $automationId, $controlType, $targetText, $targetDescription) {
  $normalizedTarget = Normalize-DesktopPetUiText $targetText
  $normalizedDescription = Normalize-DesktopPetUiText $targetDescription
  $haystacks = @(
    Normalize-DesktopPetUiText $name,
    Normalize-DesktopPetUiText $automationId,
    Normalize-DesktopPetUiText $controlType
  ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

  $best = 0
  foreach ($haystack in $haystacks) {
    if (-not [string]::IsNullOrWhiteSpace($normalizedTarget)) {
      if ($haystack -eq $normalizedTarget) {
        $best = [Math]::Max($best, 100)
      } elseif ($haystack.StartsWith($normalizedTarget)) {
        $best = [Math]::Max($best, 86)
      } elseif ($haystack.Contains($normalizedTarget)) {
        $best = [Math]::Max($best, 78)
      } elseif ($normalizedTarget.Contains($haystack)) {
        $best = [Math]::Max($best, 50)
      }
    }

    if (-not [string]::IsNullOrWhiteSpace($normalizedDescription) -and $normalizedDescription.Contains($haystack)) {
      $best = [Math]::Max($best, 45)
    }
  }

  return $best
}

function Get-DesktopPetUiSupportedActions($element) {
  $actions = New-Object System.Collections.Generic.List[string]
  try {
    foreach ($pattern in @($element.GetSupportedPatterns())) {
      $name = [string]$pattern.ProgrammaticName
      switch -Regex ($name) {
        'InvokePattern$' { if (-not $actions.Contains('invoke')) { $actions.Add('invoke') } }
        'ValuePattern$' { if (-not $actions.Contains('value')) { $actions.Add('value') } }
        'TextPattern$' { if (-not $actions.Contains('text')) { $actions.Add('text') } }
        'SelectionItemPattern$' { if (-not $actions.Contains('select')) { $actions.Add('select') } }
        'ExpandCollapsePattern$' { if (-not $actions.Contains('expand-collapse')) { $actions.Add('expand-collapse') } }
        'TogglePattern$' { if (-not $actions.Contains('toggle')) { $actions.Add('toggle') } }
        'ScrollItemPattern$' { if (-not $actions.Contains('scroll-into-view')) { $actions.Add('scroll-into-view') } }
      }
    }
  } catch {
  }

  return @($actions)
}

function Get-DesktopPetUiSelectionState($element) {
  try {
    $pattern = $element.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
    if ($null -ne $pattern) {
      return [PSCustomObject]@{
        isSelected = [bool]$pattern.Current.IsSelected
        selectionItem = $true
      }
    }
  } catch {
  }

  return [PSCustomObject]@{
    isSelected = $null
    selectionItem = $false
  }
}

function New-DesktopPetUiControlRecord($element, $depth, $parentIndex, $targetText, $targetDescription) {
  $current = $element.Current
  $name = ''
  $automationId = ''
  $className = ''
  $controlType = ''
  $isEnabled = $false
  $isOffscreen = $false
  $isKeyboardFocusable = $false
  $hasKeyboardFocus = $false
  $rect = $null
  try { $name = [string]$current.Name } catch {}
  try { $automationId = [string]$current.AutomationId } catch {}
  try { $className = [string]$current.ClassName } catch {}
  try { $controlType = ([string]$current.ControlType.ProgrammaticName) -replace '^ControlType\.', '' } catch {}
  try { $isEnabled = [bool]$current.IsEnabled } catch {}
  try { $isOffscreen = [bool]$current.IsOffscreen } catch {}
  try { $isKeyboardFocusable = [bool]$current.IsKeyboardFocusable } catch {}
  try { $hasKeyboardFocus = [bool]$current.HasKeyboardFocus } catch {}
  try { $rect = $current.BoundingRectangle } catch {}

  $bounds = $null
  $centerX = $null
  $centerY = $null
  if ($null -ne $rect -and -not $rect.IsEmpty -and $rect.Width -gt 1 -and $rect.Height -gt 1) {
    $bounds = @{
      coordinateSpace = 'native-screen'
      height = [int][Math]::Round($rect.Height)
      source = 'ui-automation'
      width = [int][Math]::Round($rect.Width)
      x = [int][Math]::Round($rect.Left)
      y = [int][Math]::Round($rect.Top)
    }
    $centerX = [int][Math]::Round($rect.Left + ($rect.Width / 2))
    $centerY = [int][Math]::Round($rect.Top + ($rect.Height / 2))
  }

  $supportedActions = @(Get-DesktopPetUiSupportedActions $element)
  $selectionState = Get-DesktopPetUiSelectionState $element
  if ($isKeyboardFocusable -and -not $supportedActions.Contains('focus')) {
    $supportedActions += 'focus'
  }
  $matchScore = Get-DesktopPetUiMatchScore $name $automationId $controlType $targetText $targetDescription

  return [PSCustomObject]@{
    actions = $supportedActions
    automationId = $automationId
    bounds = $bounds
    centerX = $centerX
    centerY = $centerY
    className = $className
    controlType = $controlType
    depth = [int]$depth
    enabled = [bool]$isEnabled
    hasKeyboardFocus = [bool]$hasKeyboardFocus
    keyboardFocusable = [bool]$isKeyboardFocusable
    matchScore = [int]$matchScore
    name = $name
    offscreen = [bool]$isOffscreen
    parentIndex = [int]$parentIndex
    selected = $selectionState.isSelected
    selectionItem = [bool]$selectionState.selectionItem
  }
}

$limit = [Math]::Max(1, [Math]::Min(200, [int]$request.limit))
$maxDepth = [Math]::Max(1, [Math]::Min(10, [int]$request.maxDepth))
$query = [string]$request.query
$targetText = [string]$request.targetText
$targetDescription = [string]$request.targetDescription
$requestedHwnd = [int64]$request.hwnd
$windows = @(Get-DesktopPetTopLevelWindows)
$targetWindow = $null
$targetHandle = [IntPtr]::Zero

if ($requestedHwnd -ne 0) {
  $targetWindow = $windows | Where-Object { [int64]$_.hwnd -eq $requestedHwnd } | Select-Object -First 1
  $targetHandle = [IntPtr]$requestedHwnd
} elseif (-not [string]::IsNullOrWhiteSpace($query)) {
  $windowMatches = @($windows | ForEach-Object {
    $score = Get-DesktopPetWindowMatchScore $_ $query
    if ($score -gt 0) {
      $_ | Add-Member -NotePropertyName matchScore -NotePropertyValue $score -Force
      $_
    }
  })
  $targetWindow = $windowMatches | Sort-Object -Property @{ Expression = 'matchScore'; Descending = $true }, @{ Expression = 'topLevelOrder'; Ascending = $true } | Select-Object -First 1
  if ($null -ne $targetWindow -and $null -ne $targetWindow.handle) {
    $targetHandle = $targetWindow.handle
  }
} else {
  $targetHandle = [DesktopPetTopLevelWindowEnumerator]::GetForegroundWindow()
  if ($targetHandle -ne [IntPtr]::Zero) {
    $targetWindow = $windows | Where-Object { [int64]$_.hwnd -eq [int64]$targetHandle.ToInt64() } | Select-Object -First 1
  }
}

if ($null -eq $targetHandle -or $targetHandle -eq [IntPtr]::Zero) {
  @{
    controls = @()
    error = 'No matching window handle found.'
    matchedControls = @()
    ok = $false
    query = $query
    targetText = $targetText
    window = $null
  } | ConvertTo-Json -Depth 8 -Compress
  exit 0
}

$root = [System.Windows.Automation.AutomationElement]::FromHandle($targetHandle)
if ($null -eq $root) {
  @{
    controls = @()
    error = 'UI Automation could not attach to the target window.'
    matchedControls = @()
    ok = $false
    query = $query
    targetText = $targetText
    window = $targetWindow
  } | ConvertTo-Json -Depth 8 -Compress
  exit 0
}

$walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
$controls = New-Object System.Collections.ArrayList

function Add-DesktopPetUiControl($element, $depth, $parentIndex) {
  if ($controls.Count -ge $limit) {
    return -1
  }

  $record = New-DesktopPetUiControlRecord $element $depth $parentIndex $targetText $targetDescription
  $hasBounds = $null -ne $record.bounds
  $hasLabel = -not [string]::IsNullOrWhiteSpace($record.name) -or -not [string]::IsNullOrWhiteSpace($record.automationId)
  $interestingTypes = @('Window', 'Pane', 'Button', 'Edit', 'Text', 'ListItem', 'MenuItem', 'Hyperlink', 'TabItem', 'CheckBox', 'RadioButton', 'ComboBox', 'DataItem', 'TreeItem', 'Document')
  $isInteresting = $depth -eq 0 -or $interestingTypes -contains $record.controlType -or $record.actions.Count -gt 0 -or $record.matchScore -gt 0
  if (-not $isInteresting -or (-not $hasLabel -and -not $hasBounds -and $depth -gt 0)) {
    return $parentIndex
  }

  $record | Add-Member -NotePropertyName index -NotePropertyValue ([int]$controls.Count) -Force
  [void]$controls.Add($record)
  return [int]$record.index
}

function Visit-DesktopPetUiElement($element, $depth, $parentIndex) {
  if ($null -eq $element -or $controls.Count -ge $limit) {
    return
  }

  $currentIndex = Add-DesktopPetUiControl $element $depth $parentIndex
  if ($depth -ge $maxDepth) {
    return
  }

  $child = $null
  try { $child = $walker.GetFirstChild($element) } catch { $child = $null }
  while ($null -ne $child -and $controls.Count -lt $limit) {
    Visit-DesktopPetUiElement $child ($depth + 1) $currentIndex
    try { $child = $walker.GetNextSibling($child) } catch { $child = $null }
  }
}

Visit-DesktopPetUiElement $root 0 -1

$scoredControls = @($controls | Where-Object { [int]$_.matchScore -gt 0 })
$matchedControls = @($scoredControls | Sort-Object -Property @{ Expression = 'matchScore'; Descending = $true }, @{ Expression = 'depth'; Ascending = $true }, @{ Expression = 'index'; Ascending = $true } | Select-Object -First 12)

@{
  controlCount = [int]$controls.Count
  controls = @($controls)
  matchedControls = @($matchedControls)
  ok = $true
  query = $query
  targetDescription = $targetDescription
  targetText = $targetText
  window = $targetWindow
} | ConvertTo-Json -Depth 9 -Compress
`;

    try {
      const stdout = await runPowerShellScript(script, 4500);
      const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
      return {
        controlCount: Number.isFinite(Number(parsed?.controlCount)) ? Math.round(Number(parsed.controlCount)) : 0,
        controls: Array.isArray(parsed?.controls) ? parsed.controls : [],
        error: typeof parsed?.error === 'string' ? parsed.error : undefined,
        matchedControls: Array.isArray(parsed?.matchedControls) ? parsed.matchedControls : [],
        ok: Boolean(parsed?.ok),
        query,
        targetDescription,
        targetText,
        window: parsed?.window ?? null,
      };
    } catch (error) {
      return {
        controls: [],
        error: error instanceof Error ? error.message : String(error),
        matchedControls: [],
        ok: false,
        query,
        targetDescription,
        targetText,
        window: null,
      };
    }
  }

  async function invokeWindowUi(request = {}) {
    if (process.platform !== 'win32') {
      return {
        control: null,
        error: 'Window UI invoke is currently only implemented on Windows.',
        invoked: false,
        ok: false,
        uiAction: 'invoke',
        window: null,
      };
    }

    const query = String(request?.query || request?.target || request?.title || request?.processName || '').trim();
    const targetText = String(request?.targetText || request?.text || request?.label || request?.name || '').trim();
    const targetDescription = String(request?.targetDescription || request?.description || request?.element || '').trim();
    const automationId = String(request?.automationId || request?.id || '').trim();
    const controlType = String(request?.controlType || request?.type || '').trim();
    const rawUiAction = String(request?.uiAction || request?.uiaAction || request?.controlAction || request?.pattern || 'invoke').trim().toLowerCase().replace(/[-\s]+/g, '_');
    const uiAction = {
      check: 'toggle',
      click: 'invoke',
      collapse_control: 'collapse',
      expand_control: 'expand',
      focus_control: 'focus',
      invoke_pattern: 'invoke',
      keyboard_focus: 'focus',
      select_item: 'select',
      set_focus: 'focus',
      set_text: 'set_value',
      set_value_pattern: 'set_value',
      uncheck: 'toggle',
      value: 'set_value',
    }[rawUiAction] || rawUiAction || 'invoke';
    const value = request?.value ?? request?.textValue ?? request?.inputValue ?? '';
    const rawHwnd = Number(request?.hwnd || request?.windowHandle || request?.handle || 0);
    const rawX = Number(request?.x ?? request?.centerX ?? request?.fallbackX);
    const rawY = Number(request?.y ?? request?.centerY ?? request?.fallbackY);
    if (!targetText && !automationId && (!Number.isFinite(rawX) || !Number.isFinite(rawY))) {
      return {
        candidates: [],
        control: null,
        error: 'Window UI invoke needs targetText, automationId, or a native-screen point.',
        invoked: false,
        ok: false,
        query,
        targetText,
        uiAction,
        window: null,
      };
    }

    const limit = Math.max(1, Math.min(250, Math.round(Number(request?.limit ?? 120))));
    const maxDepth = Math.max(1, Math.min(10, Math.round(Number(request?.maxDepth ?? 6))));
    const payloadBase64 = Buffer.from(JSON.stringify({
      automationId,
      controlType,
      hwnd: Number.isFinite(rawHwnd) ? Math.round(rawHwnd) : 0,
      limit,
      maxDepth,
      query,
      targetDescription,
      targetText,
      uiAction,
      value,
      x: Number.isFinite(rawX) ? Math.round(rawX) : null,
      y: Number.isFinite(rawY) ? Math.round(rawY) : null,
    }), 'utf8').toString('base64');

    const script = String.raw`
$ErrorActionPreference = 'Stop'
${createTopLevelWindowEnumeratorPowerShell()}

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName WindowsBase

$requestJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payloadBase64}'))
$request = $requestJson | ConvertFrom-Json

function Normalize-DesktopPetUiText($value) {
  if ($null -eq $value) {
    return ''
  }

  return ([string]$value).Normalize([System.Text.NormalizationForm]::FormKC).Trim().ToLowerInvariant() -replace '[\s\p{P}\p{S}_]+', ''
}

function Get-DesktopPetWindowMatchScore($window, $query) {
  $normalizedQuery = Normalize-DesktopPetUiText $query
  if ([string]::IsNullOrWhiteSpace($normalizedQuery)) {
    return 0
  }

  $parts = @(
    [string]$window.title,
    [string]$window.processName,
    [IO.Path]::GetFileNameWithoutExtension([string]$window.path),
    [string]$window.path
  )
  $best = 0
  foreach ($part in $parts) {
    $normalizedPart = Normalize-DesktopPetUiText $part
    if ([string]::IsNullOrWhiteSpace($normalizedPart)) {
      continue
    }
    if ($normalizedPart -eq $normalizedQuery) {
      $best = [Math]::Max($best, 100)
    } elseif ($normalizedPart.StartsWith($normalizedQuery)) {
      $best = [Math]::Max($best, 86)
    } elseif ($normalizedPart.Contains($normalizedQuery)) {
      $best = [Math]::Max($best, 74)
    } elseif ($normalizedQuery.Contains($normalizedPart)) {
      $best = [Math]::Max($best, 48)
    }
  }

  return $best
}

function Get-DesktopPetUiTextScore($haystack, $needle) {
  $normalizedHaystack = Normalize-DesktopPetUiText $haystack
  $normalizedNeedle = Normalize-DesktopPetUiText $needle
  if ([string]::IsNullOrWhiteSpace($normalizedHaystack) -or [string]::IsNullOrWhiteSpace($normalizedNeedle)) {
    return 0
  }

  if ($normalizedHaystack -eq $normalizedNeedle) {
    return 100
  }
  if ($normalizedHaystack.StartsWith($normalizedNeedle)) {
    return 86
  }
  if ($normalizedHaystack.Contains($normalizedNeedle)) {
    return 78
  }
  if ($normalizedNeedle.Contains($normalizedHaystack)) {
    return 50
  }

  return 0
}

function Get-DesktopPetUiSupportedActions($element) {
  $actions = New-Object System.Collections.Generic.List[string]
  try {
    foreach ($pattern in @($element.GetSupportedPatterns())) {
      $name = [string]$pattern.ProgrammaticName
      switch -Regex ($name) {
        'InvokePattern$' { if (-not $actions.Contains('invoke')) { $actions.Add('invoke') } }
        'ValuePattern$' { if (-not $actions.Contains('value')) { $actions.Add('value') } }
        'TextPattern$' { if (-not $actions.Contains('text')) { $actions.Add('text') } }
        'SelectionItemPattern$' { if (-not $actions.Contains('select')) { $actions.Add('select') } }
        'ExpandCollapsePattern$' { if (-not $actions.Contains('expand-collapse')) { $actions.Add('expand-collapse') } }
        'TogglePattern$' { if (-not $actions.Contains('toggle')) { $actions.Add('toggle') } }
        'ScrollItemPattern$' { if (-not $actions.Contains('scroll-into-view')) { $actions.Add('scroll-into-view') } }
      }
    }
  } catch {
  }

  return @($actions)
}

function Get-DesktopPetUiSelectionState($element) {
  try {
    $pattern = $element.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
    if ($null -ne $pattern) {
      return [PSCustomObject]@{
        isSelected = [bool]$pattern.Current.IsSelected
        selectionItem = $true
      }
    }
  } catch {
  }

  return [PSCustomObject]@{
    isSelected = $null
    selectionItem = $false
  }
}

function Normalize-DesktopPetRequestedUiAction($value) {
  $text = (Normalize-DesktopPetUiText $value)
  switch ($text) {
    'auto' { return 'auto' }
    'invoke' { return 'invoke' }
    'click' { return 'invoke' }
    'select' { return 'select' }
    'selectitem' { return 'select' }
    'toggle' { return 'toggle' }
    'check' { return 'toggle' }
    'uncheck' { return 'toggle' }
    'expand' { return 'expand' }
    'expandcontrol' { return 'expand' }
    'collapse' { return 'collapse' }
    'collapsecontrol' { return 'collapse' }
    'focus' { return 'focus' }
    'focuscontrol' { return 'focus' }
    'setfocus' { return 'focus' }
    'keyboardfocus' { return 'focus' }
    'scroll' { return 'scroll_into_view' }
    'scrollintoview' { return 'scroll_into_view' }
    'scrollitem' { return 'scroll_into_view' }
    'scrollitemintoview' { return 'scroll_into_view' }
    'setvalue' { return 'set_value' }
    'value' { return 'set_value' }
    'settext' { return 'set_value' }
    default { return $text }
  }
}

function Test-DesktopPetUiActionSupported($record, $uiAction) {
  $actions = @($record.actions)
  switch ($uiAction) {
    'auto' { return $actions.Count -gt 0 }
    'invoke' { return $actions -contains 'invoke' }
    'select' { return $actions -contains 'select' }
    'toggle' { return $actions -contains 'toggle' }
    'expand' { return $actions -contains 'expand-collapse' }
    'collapse' { return $actions -contains 'expand-collapse' }
    'focus' { return [bool]$record.keyboardFocusable -and [bool]$record.enabled -and -not [bool]$record.offscreen }
    'scroll_into_view' { return $actions -contains 'scroll-into-view' }
    'set_value' { return $actions -contains 'value' }
    default { return $false }
  }
}

function Resolve-DesktopPetUiAction($record, $requestedAction, $value) {
  $actions = @($record.actions)
  if ($requestedAction -ne 'auto') {
    return $requestedAction
  }

  if ($actions -contains 'invoke') {
    return 'invoke'
  }
  if ($actions -contains 'select') {
    return 'select'
  }
  if ($actions -contains 'toggle') {
    return 'toggle'
  }
  if ($actions -contains 'expand-collapse') {
    return 'expand'
  }
  if ([bool]$record.keyboardFocusable) {
    return 'focus'
  }
  if ($actions -contains 'scroll-into-view') {
    return 'scroll_into_view'
  }
  if (($actions -contains 'value') -and -not [string]::IsNullOrWhiteSpace([string]$value)) {
    return 'set_value'
  }

  return ''
}

function Invoke-DesktopPetUiControlAction($record, $requestedAction, $value) {
  $resolvedAction = Resolve-DesktopPetUiAction $record $requestedAction $value
  if ([string]::IsNullOrWhiteSpace($resolvedAction) -or -not (Test-DesktopPetUiActionSupported $record $resolvedAction)) {
    return [PSCustomObject]@{
      applied = $false
      error = "Matched UI Automation control does not support action '$requestedAction'."
      method = ''
      resolvedAction = $resolvedAction
    }
  }

  try {
    switch ($resolvedAction) {
      'invoke' {
        $pattern = $record.element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
        $pattern.Invoke()
        return [PSCustomObject]@{ applied = $true; error = ''; method = 'uia-invoke-pattern'; resolvedAction = $resolvedAction }
      }
      'select' {
        $pattern = $record.element.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
        $pattern.Select()
        return [PSCustomObject]@{ applied = $true; error = ''; method = 'uia-selection-item-pattern'; resolvedAction = $resolvedAction }
      }
      'toggle' {
        $pattern = $record.element.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern)
        $pattern.Toggle()
        return [PSCustomObject]@{ applied = $true; error = ''; method = 'uia-toggle-pattern'; resolvedAction = $resolvedAction }
      }
      'expand' {
        $pattern = $record.element.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
        $pattern.Expand()
        return [PSCustomObject]@{ applied = $true; error = ''; method = 'uia-expand-collapse-pattern.expand'; resolvedAction = $resolvedAction }
      }
      'collapse' {
        $pattern = $record.element.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
        $pattern.Collapse()
        return [PSCustomObject]@{ applied = $true; error = ''; method = 'uia-expand-collapse-pattern.collapse'; resolvedAction = $resolvedAction }
      }
      'focus' {
        $record.element.SetFocus()
        return [PSCustomObject]@{ applied = $true; error = ''; method = 'uia-automation-element.set-focus'; resolvedAction = $resolvedAction }
      }
      'scroll_into_view' {
        $pattern = $record.element.GetCurrentPattern([System.Windows.Automation.ScrollItemPattern]::Pattern)
        $pattern.ScrollIntoView()
        return [PSCustomObject]@{ applied = $true; error = ''; method = 'uia-scroll-item-pattern.scroll-into-view'; resolvedAction = $resolvedAction }
      }
      'set_value' {
        if ([string]::IsNullOrWhiteSpace([string]$value)) {
          return [PSCustomObject]@{
            applied = $false
            error = 'UI Automation set_value needs a non-empty value.'
            method = 'uia-value-pattern'
            resolvedAction = $resolvedAction
          }
        }
        $pattern = $record.element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
        $pattern.SetValue([string]$value)
        return [PSCustomObject]@{ applied = $true; error = ''; method = 'uia-value-pattern'; resolvedAction = $resolvedAction }
      }
      default {
        return [PSCustomObject]@{
          applied = $false
          error = "Unsupported UI Automation action '$resolvedAction'."
          method = ''
          resolvedAction = $resolvedAction
        }
      }
    }
  } catch {
    return [PSCustomObject]@{
      applied = $false
      error = $_.Exception.Message
      method = ''
      resolvedAction = $resolvedAction
    }
  }
}

function New-DesktopPetUiControlRecord($element, $depth, $parentIndex) {
  $current = $element.Current
  $name = ''
  $currentAutomationId = ''
  $className = ''
  $currentControlType = ''
  $isEnabled = $false
  $isOffscreen = $false
  $isKeyboardFocusable = $false
  $hasKeyboardFocus = $false
  $rect = $null
  try { $name = [string]$current.Name } catch {}
  try { $currentAutomationId = [string]$current.AutomationId } catch {}
  try { $className = [string]$current.ClassName } catch {}
  try { $currentControlType = ([string]$current.ControlType.ProgrammaticName) -replace '^ControlType\.', '' } catch {}
  try { $isEnabled = [bool]$current.IsEnabled } catch {}
  try { $isOffscreen = [bool]$current.IsOffscreen } catch {}
  try { $isKeyboardFocusable = [bool]$current.IsKeyboardFocusable } catch {}
  try { $hasKeyboardFocus = [bool]$current.HasKeyboardFocus } catch {}
  try { $rect = $current.BoundingRectangle } catch {}

  $bounds = $null
  $centerX = $null
  $centerY = $null
  if ($null -ne $rect -and -not $rect.IsEmpty -and $rect.Width -gt 1 -and $rect.Height -gt 1) {
    $bounds = @{
      coordinateSpace = 'native-screen'
      height = [int][Math]::Round($rect.Height)
      source = 'ui-automation'
      width = [int][Math]::Round($rect.Width)
      x = [int][Math]::Round($rect.Left)
      y = [int][Math]::Round($rect.Top)
    }
    $centerX = [int][Math]::Round($rect.Left + ($rect.Width / 2))
    $centerY = [int][Math]::Round($rect.Top + ($rect.Height / 2))
  }

  $supportedActions = @(Get-DesktopPetUiSupportedActions $element)
  $selectionState = Get-DesktopPetUiSelectionState $element
  if ($isKeyboardFocusable -and -not $supportedActions.Contains('focus')) {
    $supportedActions += 'focus'
  }

  return [PSCustomObject]@{
    actions = $supportedActions
    automationId = $currentAutomationId
    bounds = $bounds
    centerX = $centerX
    centerY = $centerY
    className = $className
    controlType = $currentControlType
    depth = [int]$depth
    element = $element
    enabled = [bool]$isEnabled
    hasKeyboardFocus = [bool]$hasKeyboardFocus
    keyboardFocusable = [bool]$isKeyboardFocusable
    name = $name
    offscreen = [bool]$isOffscreen
    parentIndex = [int]$parentIndex
    selected = $selectionState.isSelected
    selectionItem = [bool]$selectionState.selectionItem
  }
}

function Export-DesktopPetUiControlRecord($record) {
  if ($null -eq $record) {
    return $null
  }

  return [PSCustomObject]@{
    actions = @($record.actions)
    automationId = [string]$record.automationId
    bounds = $record.bounds
    centerX = $record.centerX
    centerY = $record.centerY
    className = [string]$record.className
    controlType = [string]$record.controlType
    depth = [int]$record.depth
    enabled = [bool]$record.enabled
    hasKeyboardFocus = [bool]$record.hasKeyboardFocus
    index = [int]$record.index
    keyboardFocusable = [bool]$record.keyboardFocusable
    matchScore = [int]$record.matchScore
    name = [string]$record.name
    offscreen = [bool]$record.offscreen
    parentIndex = [int]$record.parentIndex
    selected = $record.selected
    selectionItem = [bool]$record.selectionItem
  }
}

function Get-DesktopPetUiControlRequestScore($record, $request) {
  $score = 0
  $targetText = [string]$request.targetText
  $targetDescription = [string]$request.targetDescription
  $automationId = [string]$request.automationId
  $controlType = [string]$request.controlType
  $requestedUiAction = Normalize-DesktopPetRequestedUiAction $request.uiAction
  $pointX = $request.x
  $pointY = $request.y

  if (-not [string]::IsNullOrWhiteSpace($targetText)) {
    $score = [Math]::Max($score, Get-DesktopPetUiTextScore $record.name $targetText)
    $score = [Math]::Max($score, Get-DesktopPetUiTextScore $record.automationId $targetText)
    $score = [Math]::Max($score, Get-DesktopPetUiTextScore $record.controlType $targetText)
  }
  if (-not [string]::IsNullOrWhiteSpace($targetDescription)) {
    $score = [Math]::Max($score, [int]((Get-DesktopPetUiTextScore $record.name $targetDescription) * 0.7))
    $score = [Math]::Max($score, [int]((Get-DesktopPetUiTextScore $record.automationId $targetDescription) * 0.7))
  }
  if (-not [string]::IsNullOrWhiteSpace($automationId)) {
    $score = [Math]::Max($score, (Get-DesktopPetUiTextScore $record.automationId $automationId) + 30)
  }
  if (-not [string]::IsNullOrWhiteSpace($controlType)) {
    $score = [Math]::Max($score, (Get-DesktopPetUiTextScore $record.controlType $controlType) + 10)
  }
  if ($null -ne $pointX -and $null -ne $pointY -and $null -ne $record.bounds) {
    $x = [double]$pointX
    $y = [double]$pointY
    $left = [double]$record.bounds.x
    $top = [double]$record.bounds.y
    $right = $left + [double]$record.bounds.width
    $bottom = $top + [double]$record.bounds.height
    if ($x -ge $left -and $x -le $right -and $y -ge $top -and $y -le $bottom) {
      $score = [Math]::Max($score, 92)
    } elseif ($null -ne $record.centerX -and $null -ne $record.centerY) {
      $distance = [Math]::Sqrt([Math]::Pow(([double]$record.centerX - $x), 2) + [Math]::Pow(([double]$record.centerY - $y), 2))
      if ($distance -le 48) {
        $score = [Math]::Max($score, [int](80 - $distance))
      }
    }
  }

  if (Test-DesktopPetUiActionSupported $record $requestedUiAction) {
    $score += 36
  } elseif (@($record.actions) -contains 'invoke') {
    $score += 16
  }
  if ($record.enabled) {
    $score += 8
  }
  if ($record.offscreen) {
    $score -= 80
  }

  return [int]$score
}

$limit = [Math]::Max(1, [Math]::Min(250, [int]$request.limit))
$maxDepth = [Math]::Max(1, [Math]::Min(10, [int]$request.maxDepth))
$query = [string]$request.query
$requestedHwnd = [int64]$request.hwnd
$windows = @(Get-DesktopPetTopLevelWindows)
$targetWindow = $null
$targetHandle = [IntPtr]::Zero

if ($requestedHwnd -ne 0) {
  $targetWindow = $windows | Where-Object { [int64]$_.hwnd -eq $requestedHwnd } | Select-Object -First 1
  $targetHandle = [IntPtr]$requestedHwnd
} elseif (-not [string]::IsNullOrWhiteSpace($query)) {
  $windowMatches = @($windows | ForEach-Object {
    $score = Get-DesktopPetWindowMatchScore $_ $query
    if ($score -gt 0) {
      $_ | Add-Member -NotePropertyName matchScore -NotePropertyValue $score -Force
      $_
    }
  })
  $targetWindow = $windowMatches | Sort-Object -Property @{ Expression = 'matchScore'; Descending = $true }, @{ Expression = 'topLevelOrder'; Ascending = $true } | Select-Object -First 1
  if ($null -ne $targetWindow -and $null -ne $targetWindow.handle) {
    $targetHandle = $targetWindow.handle
  }
} else {
  $targetHandle = [DesktopPetTopLevelWindowEnumerator]::GetForegroundWindow()
  if ($targetHandle -ne [IntPtr]::Zero) {
    $targetWindow = $windows | Where-Object { [int64]$_.hwnd -eq [int64]$targetHandle.ToInt64() } | Select-Object -First 1
  }
}

if ($null -eq $targetHandle -or $targetHandle -eq [IntPtr]::Zero) {
  @{
    candidates = @()
    control = $null
    error = 'No matching window handle found.'
    invoked = $false
    ok = $false
    query = $query
    window = $null
  } | ConvertTo-Json -Depth 8 -Compress
  exit 0
}

$root = [System.Windows.Automation.AutomationElement]::FromHandle($targetHandle)
if ($null -eq $root) {
  @{
    candidates = @()
    control = $null
    error = 'UI Automation could not attach to the target window.'
    invoked = $false
    ok = $false
    query = $query
    window = $targetWindow
  } | ConvertTo-Json -Depth 8 -Compress
  exit 0
}

$walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
$controls = New-Object System.Collections.ArrayList

function Add-DesktopPetUiControl($element, $depth, $parentIndex) {
  if ($controls.Count -ge $limit) {
    return -1
  }

  $record = New-DesktopPetUiControlRecord $element $depth $parentIndex
  $hasBounds = $null -ne $record.bounds
  $hasLabel = -not [string]::IsNullOrWhiteSpace($record.name) -or -not [string]::IsNullOrWhiteSpace($record.automationId)
  $interestingTypes = @('Window', 'Pane', 'Button', 'Edit', 'Text', 'ListItem', 'MenuItem', 'Hyperlink', 'TabItem', 'CheckBox', 'RadioButton', 'ComboBox', 'DataItem', 'TreeItem', 'Document')
  $isInteresting = $depth -eq 0 -or $interestingTypes -contains $record.controlType -or $record.actions.Count -gt 0
  if (-not $isInteresting -or (-not $hasLabel -and -not $hasBounds -and $depth -gt 0)) {
    return $parentIndex
  }

  $record | Add-Member -NotePropertyName index -NotePropertyValue ([int]$controls.Count) -Force
  $record | Add-Member -NotePropertyName matchScore -NotePropertyValue (Get-DesktopPetUiControlRequestScore $record $request) -Force
  [void]$controls.Add($record)
  return [int]$record.index
}

function Visit-DesktopPetUiElement($element, $depth, $parentIndex) {
  if ($null -eq $element -or $controls.Count -ge $limit) {
    return
  }

  $currentIndex = Add-DesktopPetUiControl $element $depth $parentIndex
  if ($depth -ge $maxDepth) {
    return
  }

  $child = $null
  try { $child = $walker.GetFirstChild($element) } catch { $child = $null }
  while ($null -ne $child -and $controls.Count -lt $limit) {
    Visit-DesktopPetUiElement $child ($depth + 1) $currentIndex
    try { $child = $walker.GetNextSibling($child) } catch { $child = $null }
  }
}

Visit-DesktopPetUiElement $root 0 -1

$scoredControls = @($controls | Where-Object { [int]$_.matchScore -gt 0 })
$rankedControls = @($scoredControls | Sort-Object -Property @{ Expression = 'matchScore'; Descending = $true }, @{ Expression = 'depth'; Ascending = $true }, @{ Expression = 'index'; Ascending = $true })
$targetControl = $rankedControls | Select-Object -First 1
$candidateExports = @($rankedControls | Select-Object -First 8 | ForEach-Object { Export-DesktopPetUiControlRecord $_ })

if ($null -eq $targetControl) {
  @{
    candidates = $candidateExports
    control = $null
    error = 'No matching UI Automation control found.'
    invoked = $false
    ok = $false
    query = $query
    window = $targetWindow
  } | ConvertTo-Json -Depth 8 -Compress
  exit 0
}

$requestedUiAction = Normalize-DesktopPetRequestedUiAction $request.uiAction
$actionResult = Invoke-DesktopPetUiControlAction $targetControl $requestedUiAction $request.value

if (-not $actionResult.applied) {
  @{
    candidates = $candidateExports
    control = (Export-DesktopPetUiControlRecord $targetControl)
    error = $actionResult.error
    invoked = $false
    method = $actionResult.method
    ok = $false
    query = $query
    resolvedAction = $actionResult.resolvedAction
    uiAction = $requestedUiAction
    window = $targetWindow
  } | ConvertTo-Json -Depth 8 -Compress
  exit 0
}

Start-Sleep -Milliseconds 120
$postActionControl = New-DesktopPetUiControlRecord $targetControl.element $targetControl.depth $targetControl.parentIndex
$postActionControl | Add-Member -NotePropertyName index -NotePropertyValue ([int]$targetControl.index) -Force
$postActionControl | Add-Member -NotePropertyName matchScore -NotePropertyValue ([int]$targetControl.matchScore) -Force
@{
  candidates = $candidateExports
  control = (Export-DesktopPetUiControlRecord $postActionControl)
  invoked = $true
  method = $actionResult.method
  ok = $true
  query = $query
  resolvedAction = $actionResult.resolvedAction
  uiAction = $requestedUiAction
  window = $targetWindow
} | ConvertTo-Json -Depth 8 -Compress
exit 0
`;

    try {
      const stdout = await runPowerShellScript(script, 4500);
      const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
      return {
        candidates: Array.isArray(parsed?.candidates) ? parsed.candidates : [],
        control: parsed?.control ?? null,
        error: typeof parsed?.error === 'string' ? parsed.error : undefined,
        invoked: Boolean(parsed?.invoked),
        method: typeof parsed?.method === 'string' ? parsed.method : undefined,
        ok: Boolean(parsed?.ok),
        query,
        resolvedAction: typeof parsed?.resolvedAction === 'string' ? parsed.resolvedAction : undefined,
        targetText,
        uiAction,
        window: parsed?.window ?? null,
      };
    } catch (error) {
      return {
        candidates: [],
        control: null,
        error: error instanceof Error ? error.message : String(error),
        invoked: false,
        ok: false,
        query,
        resolvedAction: undefined,
        targetText,
        uiAction,
        window: null,
      };
    }
  }

  async function focusWindow(request = {}) {
    const query = String(request?.query || request?.target || request?.title || request?.processName || request?.name || '').trim();
    const requestedPid = Number(request?.pid);
    const requestedHwnd = Number(request?.hwnd || request?.windowHandle);
    const hasPid = Number.isFinite(requestedPid) && requestedPid > 0;
    const hasHwnd = Number.isFinite(requestedHwnd) && requestedHwnd > 0;
    if (!query && !hasPid && !hasHwnd) {
      return {
        ok: false,
        error: 'Window focus target is empty.',
        query,
      };
    }

    let result = null;
    let focusResolutionAttempts = 0;
    const retryDelays = [0, 300, 1000, 3000];
    for (const retryDelay of retryDelays) {
      if (retryDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
      focusResolutionAttempts += 1;
      result = await focusExistingAppWindow(query, null, {
        hwnd: hasHwnd ? Math.round(requestedHwnd) : 0,
        pid: hasPid ? Math.round(requestedPid) : 0,
      });
      if (!/no-window-match/iu.test(String(result?.reason || result?.error || ''))) {
        break;
      }
    }
    return {
      ...result,
      focusResolutionAttempts,
      focusResolutionRetried: focusResolutionAttempts > 1,
      hwnd: result?.hwnd ?? (hasHwnd ? Math.round(requestedHwnd) : undefined),
      pid: result?.pid ?? (hasPid ? Math.round(requestedPid) : undefined),
      query,
    };
  }

  function normalizeDisplayRect(rect) {
    const x = Number(rect?.x);
    const y = Number(rect?.y);
    const width = Number(rect?.width);
    const height = Number(rect?.height);
    if (
      !Number.isFinite(x)
      || !Number.isFinite(y)
      || !Number.isFinite(width)
      || !Number.isFinite(height)
      || width <= 0
      || height <= 0
    ) {
      return null;
    }

    return {
      height: Math.round(height),
      width: Math.round(width),
      x: Math.round(x),
      y: Math.round(y),
    };
  }

  function getDisplayResultSummary(display) {
    if (!display) {
      return null;
    }

    return {
      bounds: normalizeDisplayRect(display.bounds),
      id: display.id,
      index: display.index,
      label: display.label,
      primary: display.primary,
      scaleFactor: display.scaleFactor,
      workArea: normalizeDisplayRect(display.workArea) || normalizeDisplayRect(display.bounds),
    };
  }

  function resolveMoveWindowTargetDisplay(request = {}) {
    const displays = getDisplaySnapshots();
    const requestedDisplayId = String(request?.displayId || request?.targetDisplayId || request?.screenId || '').trim();
    const requestedDisplay = String(
      request?.targetDisplay
      || request?.display
      || request?.displayTarget
      || request?.screen
      || request?.screenTarget
      || '',
    ).trim();
    const normalizedTarget = normalizeSearchText(requestedDisplay);
    const normalizedDisplayId = requestedDisplayId.toLowerCase();

    if (displays.length === 0) {
      return {
        display: null,
        displays,
        reason: 'no-display-snapshots',
      };
    }

    if (requestedDisplayId) {
      const byId = displays.find((display) => String(display.id).toLowerCase() === normalizedDisplayId);
      if (byId) {
        return { display: byId, displays, reason: 'display-id' };
      }
    }

    if (!requestedDisplay) {
      return {
        display: null,
        displays,
        reason: 'missing-target-display',
      };
    }

    if (normalizedTarget === 'primary' || normalizedTarget === normalizeSearchText('\u4e3b\u5c4f')) {
      return {
        display: displays.find((display) => display.primary) || displays[0],
        displays,
        reason: 'primary',
      };
    }

    if (
      normalizedTarget === 'secondary'
      || normalizedTarget === 'second'
      || normalizedTarget === 'external'
      || normalizedTarget === normalizeSearchText('\u526f\u5c4f')
      || normalizedTarget === normalizeSearchText('\u7b2c\u4e8c\u5c4f')
      || normalizedTarget === normalizeSearchText('\u5176\u4ed6\u5c4f')
    ) {
      return {
        display: displays.find((display) => !display.primary) || null,
        displays,
        reason: 'secondary',
      };
    }

    const numericIndex = Number(requestedDisplay);
    if (Number.isInteger(numericIndex) && numericIndex > 0) {
      const byOneBasedIndex = displays.find((display) => display.index === numericIndex - 1);
      if (byOneBasedIndex) {
        return { display: byOneBasedIndex, displays, reason: 'display-index' };
      }
    }

    const byText = displays.find((display) => {
      const idText = normalizeSearchText(display.id);
      const labelText = normalizeSearchText(display.label);
      const indexText = normalizeSearchText(`display${display.index + 1}`);
      return Boolean(
        normalizedTarget
        && (
          idText === normalizedTarget
          || labelText === normalizedTarget
          || labelText.includes(normalizedTarget)
          || normalizedTarget.includes(labelText)
          || indexText === normalizedTarget
        ),
      );
    });

    return {
      display: byText || null,
      displays,
      reason: byText ? 'display-text-match' : 'display-not-found',
    };
  }

  function normalizeWindowMoveBounds(bounds) {
    const rect = normalizeDisplayRect(bounds);
    return rect && rect.width > 0 && rect.height > 0 ? rect : null;
  }

  function createMoveWindowNativeDisplayHint(request = {}) {
    const requestedDisplayId = String(request?.displayId || request?.targetDisplayId || request?.screenId || '').trim();
    const requestedDisplay = String(
      request?.targetDisplay
      || request?.display
      || request?.displayTarget
      || request?.screen
      || request?.screenTarget
      || '',
    ).trim();
    const normalizedTarget = normalizeSearchText(requestedDisplay || requestedDisplayId);
    const numericIndex = Number(requestedDisplay);
    let targetIndex = Number.isInteger(numericIndex) && numericIndex > 0 ? numericIndex : 0;
    let targetRole = '';

    if (normalizedTarget === 'primary' || normalizedTarget === normalizeSearchText('\u4e3b\u5c4f')) {
      targetRole = 'primary';
    } else if (
      normalizedTarget === 'secondary'
      || normalizedTarget === 'second'
      || normalizedTarget === 'external'
      || normalizedTarget === normalizeSearchText('\u526f\u5c4f')
      || normalizedTarget === normalizeSearchText('\u7b2c\u4e8c\u5c4f')
      || normalizedTarget === normalizeSearchText('\u5176\u4ed6\u5c4f')
    ) {
      targetRole = 'secondary';
    }

    if (!targetRole && !targetIndex) {
      const resolvedTarget = resolveMoveWindowTargetDisplay(request);
      if (resolvedTarget.display) {
        if (resolvedTarget.display.primary) {
          targetRole = 'primary';
        } else if (resolvedTarget.displays.filter((display) => !display.primary).length === 1) {
          targetRole = 'secondary';
        } else {
          targetIndex = resolvedTarget.display.index + 1;
        }
      }
    }

    return {
      requestedDisplay: requestedDisplay || requestedDisplayId,
      targetDisplayText: targetRole || targetIndex ? '' : (requestedDisplay || requestedDisplayId),
      targetIndex,
      targetRole,
    };
  }

  async function moveWindowToDisplay(request = {}) {
    const query = String(request?.query || request?.target || request?.title || request?.processName || request?.name || '').trim();
    const rawQueryCandidates = Array.isArray(request?.queryCandidates)
      ? request.queryCandidates
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 8)
      : [];
    const browserCategoryQueryRequested = rawQueryCandidates.some(isBrowserCategoryQuery)
      || isBrowserCategoryQuery(query);
    const browserQueryCandidates = browserCategoryQueryRequested
      ? getDetectedBrowserCandidates()
        .flatMap((candidate) => [
          candidate.browserLabel,
          candidate.path ? path.basename(candidate.path, path.extname(candidate.path)) : '',
        ])
        .filter(Boolean)
      : [];
    const queryCandidates = uniqueCaseInsensitive([
      ...rawQueryCandidates,
      ...browserQueryCandidates,
    ]).slice(0, 12);
    const requestedPid = Number(request?.pid);
    const requestedHwnd = Number(request?.hwnd || request?.windowHandle);
    const hasPid = Number.isFinite(requestedPid) && requestedPid > 0;
    const hasHwnd = Number.isFinite(requestedHwnd) && requestedHwnd > 0;
    const targetHint = createMoveWindowNativeDisplayHint(request);
    const position = String(request?.position || request?.placement || 'center').trim().toLowerCase() === 'top-left'
      ? 'top-left'
      : 'center';
    const preserveSize = request?.preserveSize !== false;
    const fallbackToActiveWindow = request?.fallbackToActiveWindow !== false;

    if (!query && !queryCandidates.length && !hasPid && !hasHwnd) {
      return {
        ok: false,
        moved: false,
        error: 'Window move query is empty.',
        query,
      };
    }

    if (!targetHint.requestedDisplay && !targetHint.targetRole && !targetHint.targetIndex && !targetHint.targetDisplayText) {
      return {
        ok: false,
        moved: false,
        error: 'Target display is empty.',
        query,
        reason: 'missing-target-display',
      };
    }

    if (process.platform !== 'win32') {
      return {
        ok: false,
        moved: false,
        error: 'Window moving is currently only implemented on Windows.',
        query,
      };
    }

    const payload = {
      hwnd: hasHwnd ? Math.round(requestedHwnd) : 0,
      pid: hasPid ? Math.round(requestedPid) : 0,
      fallbackToActiveWindow,
      position,
      preserveSize,
      query,
      queryCandidates,
      targetDisplayText: targetHint.targetDisplayText,
      targetIndex: targetHint.targetIndex,
      targetRole: targetHint.targetRole,
    };
    const script = String.raw`
$ErrorActionPreference = 'Stop'
$payload = @'
${JSON.stringify(payload)}
'@ | ConvertFrom-Json
$query = [string]$payload.query
$queryCandidates = @($payload.queryCandidates | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
$requestedPid = [int64]$payload.pid
$requestedHwnd = [int64]$payload.hwnd
$fallbackToActiveWindow = [bool]$payload.fallbackToActiveWindow
$position = [string]$payload.position
$preserveSize = [bool]$payload.preserveSize
$targetRole = [string]$payload.targetRole
$targetIndex = [int]$payload.targetIndex
$targetDisplayText = [string]$payload.targetDisplayText

[Console]::InputEncoding = New-Object System.Text.UTF8Encoding -ArgumentList $false
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding -ArgumentList $false
$OutputEncoding = [Console]::OutputEncoding
Add-Type -AssemblyName System.Windows.Forms

Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Text;
using System.Runtime.InteropServices;

public delegate bool DesktopPetWindowMoveEnumWindowsProc(IntPtr hWnd, IntPtr lParam);

public struct DesktopPetWindowMoveRect {
  public int Left;
  public int Top;
  public int Right;
  public int Bottom;
}

public sealed class DesktopPetWindowMoveInfo {
  public long Hwnd;
  public int Pid;
  public string Title;
  public int X;
  public int Y;
  public int Width;
  public int Height;
  public int TopLevelOrder;
}

public static class DesktopPetWindowMove {
  public const int DWMWA_CLOAKED = 14;
  public const int GWL_EXSTYLE = -20;
  public const int SW_RESTORE = 9;
  public const int WS_EX_TOOLWINDOW = 0x00000080;

  [DllImport("user32.dll")]
  public static extern bool EnumWindows(DesktopPetWindowMoveEnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern IntPtr GetShellWindow();

  [DllImport("user32.dll", SetLastError = true)]
  public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowTextLength(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out DesktopPetWindowMoveRect rect);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [DllImport("user32.dll")]
  public static extern bool IsWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsZoomed(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

  [DllImport("user32.dll")]
  private static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);

  [DllImport("user32.dll")]
  private static extern bool SetProcessDPIAware();

  [DllImport("dwmapi.dll")]
  public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out int pvAttribute, int cbAttribute);

  private static readonly IntPtr DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = new IntPtr(-4);

  private static void TryEnableDpiAwareness() {
    try {
      if (SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)) {
        return;
      }
    } catch {
    }

    try {
      SetProcessDPIAware();
    } catch {
    }
  }

  public static DesktopPetWindowMoveInfo[] EnumerateTopLevelWindows() {
    TryEnableDpiAwareness();
    var windows = new List<DesktopPetWindowMoveInfo>();
    var shellWindow = GetShellWindow();
    EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
      if (hWnd == IntPtr.Zero || hWnd == shellWindow) {
        return true;
      }

      if (!IsWindow(hWnd) || !IsWindowVisible(hWnd) || IsToolWindow(hWnd) || IsWindowCloaked(hWnd)) {
        return true;
      }

      DesktopPetWindowMoveRect rect;
      if (!GetWindowRect(hWnd, out rect)) {
        return true;
      }

      var width = Math.Max(0, rect.Right - rect.Left);
      var height = Math.Max(0, rect.Bottom - rect.Top);
      if (width < 1 || height < 1) {
        return true;
      }

      uint pid;
      GetWindowThreadProcessId(hWnd, out pid);
      if (pid == 0) {
        return true;
      }

      windows.Add(new DesktopPetWindowMoveInfo {
        Hwnd = hWnd.ToInt64(),
        Pid = unchecked((int)pid),
        Title = ReadWindowText(hWnd),
        X = rect.Left,
        Y = rect.Top,
        Width = width,
        Height = height,
        TopLevelOrder = windows.Count,
      });
      return true;
    }, IntPtr.Zero);

    return windows.ToArray();
  }

  public static string ReadWindowText(IntPtr hWnd) {
    var length = Math.Max(1024, GetWindowTextLength(hWnd) + 1);
    var builder = new StringBuilder(length);
    GetWindowText(hWnd, builder, builder.Capacity);
    return builder.ToString();
  }

  private static bool IsToolWindow(IntPtr hWnd) {
    try {
      return (GetWindowLong(hWnd, GWL_EXSTYLE) & WS_EX_TOOLWINDOW) != 0;
    } catch {
      return false;
    }
  }

  private static bool IsWindowCloaked(IntPtr hWnd) {
    try {
      int cloaked;
      return DwmGetWindowAttribute(hWnd, DWMWA_CLOAKED, out cloaked, 4) == 0 && cloaked != 0;
    } catch {
      return false;
    }
  }
}
"@

function Normalize-DesktopPetText($value) {
  if ($null -eq $value) {
    return ''
  }

  return ([string]$value).Trim().ToLowerInvariant() -replace '[\s\p{P}\p{S}_]+', ''
}

function Test-DesktopPetWindowMatchesCandidate($processName, $title, $candidateQueries) {
  if ($null -eq $candidateQueries -or @($candidateQueries).Count -eq 0) {
    return $true
  }

  $normalizedProcess = Normalize-DesktopPetText $processName
  $normalizedTitle = Normalize-DesktopPetText $title
  foreach ($candidateQuery in $candidateQueries) {
    $normalizedQuery = Normalize-DesktopPetText $candidateQuery
    if (-not $normalizedQuery) {
      continue
    }

    if (
      $normalizedProcess -eq $normalizedQuery -or
      $normalizedTitle -eq $normalizedQuery -or
      $normalizedProcess.Contains($normalizedQuery) -or
      $normalizedTitle.Contains($normalizedQuery)
    ) {
      return $true
    }
  }

  return $false
}

function Get-DesktopPetWindowTitle($handle) {
  $length = [Math]::Max(1024, [DesktopPetWindowMove]::GetWindowTextLength($handle) + 1)
  $builder = New-Object System.Text.StringBuilder $length
  [void][DesktopPetWindowMove]::GetWindowText($handle, $builder, $builder.Capacity)
  return [string]$builder.ToString()
}

function Get-DesktopPetWindowBounds($handle) {
  $rect = New-Object DesktopPetWindowMoveRect
  $hasRect = [DesktopPetWindowMove]::GetWindowRect($handle, [ref]$rect)
  if (-not $hasRect) {
    return $null
  }

  return @{
    x = $rect.Left
    y = $rect.Top
    width = [Math]::Max(0, $rect.Right - $rect.Left)
    height = [Math]::Max(0, $rect.Bottom - $rect.Top)
  }
}

function Get-DesktopPetTopLevelWindows {
  $windows = @()
  foreach ($rawWindow in @([DesktopPetWindowMove]::EnumerateTopLevelWindows())) {
    $process = $null
    try {
      $process = Get-Process -Id ([int]$rawWindow.Pid) -ErrorAction Stop
    } catch {
      continue
    }

    $windows += [PSCustomObject]@{
      Bounds = @{
        x = [int]$rawWindow.X
        y = [int]$rawWindow.Y
        width = [int]$rawWindow.Width
        height = [int]$rawWindow.Height
      }
      Handle = [IntPtr]([int64]$rawWindow.Hwnd)
      Hwnd = [int64]$rawWindow.Hwnd
      Pid = [int]$rawWindow.Pid
      Process = $process
      ProcessName = [string]$process.ProcessName
      Title = [string]$rawWindow.Title
      TopLevelOrder = [int]$rawWindow.TopLevelOrder
    }
  }

  return @($windows)
}

function Test-DesktopPetBoundsInsideTarget($bounds) {
  if ($null -eq $bounds) {
    return $false
  }

  $centerX = [double]$bounds.x + ([double]$bounds.width / 2)
  $centerY = [double]$bounds.y + ([double]$bounds.height / 2)
  return $centerX -ge $targetX -and $centerX -lt ($targetX + $targetWidth) -and $centerY -ge $targetY -and $centerY -lt ($targetY + $targetHeight)
}

function Normalize-DesktopPetDisplayText($value) {
  if ($null -eq $value) {
    return ''
  }

  return ([string]$value).Trim().ToLowerInvariant() -replace '[^a-z0-9]+', ''
}

$screens = @([System.Windows.Forms.Screen]::AllScreens)
$targetScreen = $null

if ($targetRole -eq 'primary') {
  $targetScreen = $screens | Where-Object { $_.Primary } | Select-Object -First 1
} elseif ($targetRole -eq 'secondary') {
  $targetScreen = $screens | Where-Object { -not $_.Primary } | Select-Object -First 1
} elseif ($targetIndex -gt 0 -and $targetIndex -le $screens.Count) {
  $targetScreen = $screens[$targetIndex - 1]
} elseif (-not [string]::IsNullOrWhiteSpace($targetDisplayText)) {
  $normalizedDisplayText = Normalize-DesktopPetDisplayText $targetDisplayText
  $targetScreen = $screens | Where-Object {
    $deviceName = Normalize-DesktopPetDisplayText $_.DeviceName
    $deviceName -eq $normalizedDisplayText -or $deviceName.Contains($normalizedDisplayText) -or $normalizedDisplayText.Contains($deviceName)
  } | Select-Object -First 1
}

if ($null -eq $targetScreen) {
  @{
    ok = $false
    moved = $false
    reason = 'target-display-not-found'
    query = $query
    displays = @($screens | ForEach-Object {
      @{
        deviceName = [string]$_.DeviceName
        primary = [bool]$_.Primary
        bounds = @{
          x = [int]$_.Bounds.X
          y = [int]$_.Bounds.Y
          width = [int]$_.Bounds.Width
          height = [int]$_.Bounds.Height
        }
        workArea = @{
          x = [int]$_.WorkingArea.X
          y = [int]$_.WorkingArea.Y
          width = [int]$_.WorkingArea.Width
          height = [int]$_.WorkingArea.Height
        }
      }
    })
  } | ConvertTo-Json -Depth 8 -Compress
  exit 0
}

$targetX = [int]$targetScreen.WorkingArea.X
$targetY = [int]$targetScreen.WorkingArea.Y
$targetWidth = [int]$targetScreen.WorkingArea.Width
$targetHeight = [int]$targetScreen.WorkingArea.Height

$candidateQueries = @()
if (-not [string]::IsNullOrWhiteSpace($query)) {
  $candidateQueries += [string]$query
}
$candidateQueries += $queryCandidates
$candidateQueries = @($candidateQueries | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ } | Select-Object -Unique)
$windows = Get-DesktopPetTopLevelWindows
$matches = @()

foreach ($window in $windows) {
  $handle = [IntPtr]$window.Handle
  $title = [string]$window.Title
  $normalizedTitle = Normalize-DesktopPetText $title
  $normalizedProcess = Normalize-DesktopPetText $window.ProcessName
  $bounds = $window.Bounds
  $score = 0
  $reason = ''
  $identityRequested = $requestedHwnd -gt 0 -or $requestedPid -gt 0
  $hwndMatches = $requestedHwnd -le 0 -or [int64]$window.Hwnd -eq $requestedHwnd
  $pidMatches = $requestedPid -le 0 -or [int]$window.Pid -eq $requestedPid
  $semanticMatches = Test-DesktopPetWindowMatchesCandidate $window.ProcessName $title $candidateQueries

  if ($identityRequested) {
    if (-not $hwndMatches -or -not $pidMatches -or ($candidateQueries.Count -gt 0 -and -not $semanticMatches)) {
      continue
    }
    $score = 240
    $reason = if ($requestedHwnd -gt 0 -and $requestedPid -gt 0) { 'hwnd+pid+semantic' } elseif ($requestedHwnd -gt 0) { 'hwnd+semantic' } else { 'pid+semantic' }
  } else {
    $queryIndex = 0
    foreach ($candidateQuery in $candidateQueries) {
      $normalizedQuery = Normalize-DesktopPetText $candidateQuery
      if (-not $normalizedQuery) {
        $queryIndex += 1
        continue
      }

      $candidateScore = 0
      $candidateReason = ''
      if ($normalizedProcess -eq $normalizedQuery) {
        $candidateScore = 170
        $candidateReason = 'process-exact'
      } elseif ($normalizedTitle -eq $normalizedQuery) {
        $candidateScore = 150
        $candidateReason = 'title-exact'
      } elseif ($normalizedProcess.Contains($normalizedQuery)) {
        $candidateScore = 120
        $candidateReason = 'process-contains'
      } elseif ($normalizedTitle.Contains($normalizedQuery)) {
        $candidateScore = 100
        $candidateReason = 'title-contains'
      }

      if ($candidateScore -gt 0) {
        $candidateScore += [Math]::Max(0, 30 - ($queryIndex * 4))
        if ($candidateScore -gt $score) {
          $score = $candidateScore
          $reason = "$candidateReason query=$candidateQuery"
        }
      }

      $queryIndex += 1
    }
  }

  if ($score -gt 0) {
    $score += [Math]::Max(0, 40 - [int]$window.TopLevelOrder)
    $matches += [PSCustomObject]@{
      Process = $window.Process
      Handle = $handle
      Hwnd = [int64]$window.Hwnd
      Pid = [int]$window.Pid
      Score = $score
      MatchReason = $reason
      Title = $title
      Bounds = $bounds
    }
  }
}

$match = $matches | Sort-Object -Property Score -Descending | Select-Object -First 1
if ($null -eq $match) {
  $foregroundHandle = [DesktopPetWindowMove]::GetForegroundWindow()
  if ($fallbackToActiveWindow -and $foregroundHandle -ne [IntPtr]::Zero -and [DesktopPetWindowMove]::IsWindow($foregroundHandle) -and [DesktopPetWindowMove]::IsWindowVisible($foregroundHandle)) {
    $foregroundPid = [uint32]0
    [void][DesktopPetWindowMove]::GetWindowThreadProcessId($foregroundHandle, [ref]$foregroundPid)
    $foregroundProcess = $null
    try {
      $foregroundProcess = Get-Process -Id ([int]$foregroundPid) -ErrorAction Stop
    } catch {
      $foregroundProcess = $null
    }

    if ($null -ne $foregroundProcess) {
      $foregroundTitle = Get-DesktopPetWindowTitle $foregroundHandle
      if (Test-DesktopPetWindowMatchesCandidate $foregroundProcess.ProcessName $foregroundTitle $candidateQueries) {
        $match = [PSCustomObject]@{
          Process = $foregroundProcess
          Handle = $foregroundHandle
          Hwnd = [int64]$foregroundHandle.ToInt64()
          Pid = [int]$foregroundPid
          Score = 80
          MatchReason = 'foreground-fallback'
          Title = $foregroundTitle
          Bounds = (Get-DesktopPetWindowBounds $foregroundHandle)
        }
      }
    }
  }
}

if ($null -eq $match) {
  @{
    ok = $false
    moved = $false
    reason = 'no-window-match'
    query = $query
    matchCount = 0
  } | ConvertTo-Json -Depth 6 -Compress
  exit 0
}

$targetProcess = $match.Process
$handle = [IntPtr]$match.Handle
$beforeBounds = $match.Bounds
$wasMaximized = [DesktopPetWindowMove]::IsZoomed($handle)
$moveWidth = if ($preserveSize -and $beforeBounds -and $beforeBounds.width -gt 0) { [int]$beforeBounds.width } else { [Math]::Min(1100, [Math]::Max(320, $targetWidth)) }
$moveHeight = if ($preserveSize -and $beforeBounds -and $beforeBounds.height -gt 0) { [int]$beforeBounds.height } else { [Math]::Min(760, [Math]::Max(240, $targetHeight)) }
$moveWidth = [Math]::Max(120, [Math]::Min($moveWidth, $targetWidth))
$moveHeight = [Math]::Max(80, [Math]::Min($moveHeight, $targetHeight))

if ($position -eq 'top-left') {
  $nextX = $targetX
  $nextY = $targetY
} else {
  $nextX = $targetX + [Math]::Max(0, [Math]::Floor(($targetWidth - $moveWidth) / 2))
  $nextY = $targetY + [Math]::Max(0, [Math]::Floor(($targetHeight - $moveHeight) / 2))
}

[void][DesktopPetWindowMove]::ShowWindow($handle, 9)
Start-Sleep -Milliseconds 60
$moved = [DesktopPetWindowMove]::SetWindowPos($handle, [IntPtr]::Zero, [int]$nextX, [int]$nextY, [int]$moveWidth, [int]$moveHeight, 0x0004)
Start-Sleep -Milliseconds 180
$maximizedRestored = $false
if ($moved -and $wasMaximized) {
  [void][DesktopPetWindowMove]::ShowWindow($handle, 3)
  Start-Sleep -Milliseconds 220
  $maximizedRestored = [DesktopPetWindowMove]::IsZoomed($handle)
}
$afterBounds = Get-DesktopPetWindowBounds $handle
$verified = Test-DesktopPetBoundsInsideTarget $afterBounds
$retryMoveAttempted = $false

if ($moved -and -not $verified) {
  $retryMoveAttempted = $true
  [void][DesktopPetWindowMove]::ShowWindow($handle, 9)
  Start-Sleep -Milliseconds 120
  $moved = [DesktopPetWindowMove]::SetWindowPos($handle, [IntPtr]::Zero, [int]$nextX, [int]$nextY, [int]$moveWidth, [int]$moveHeight, 0x0004)
  Start-Sleep -Milliseconds 260
  if ($moved -and $wasMaximized) {
    [void][DesktopPetWindowMove]::ShowWindow($handle, 3)
    Start-Sleep -Milliseconds 220
    $maximizedRestored = [DesktopPetWindowMove]::IsZoomed($handle)
  }
  $afterBounds = Get-DesktopPetWindowBounds $handle
  $verified = Test-DesktopPetBoundsInsideTarget $afterBounds
}

@{
  ok = [bool]$moved
  moved = [bool]$moved
  verified = [bool]$verified
  wasMaximized = [bool]$wasMaximized
  maximizedRestored = [bool]$maximizedRestored
  retryMoveAttempted = [bool]$retryMoveAttempted
  processName = $targetProcess.ProcessName
  title = $match.Title
  pid = $match.Pid
  hwnd = $match.Hwnd
  matchReason = $match.MatchReason
  matchCount = @($matches).Count
  queryCandidates = @($candidateQueries)
  fromBounds = $beforeBounds
  targetDisplay = @{
    deviceName = [string]$targetScreen.DeviceName
    primary = [bool]$targetScreen.Primary
    bounds = @{
      x = [int]$targetScreen.Bounds.X
      y = [int]$targetScreen.Bounds.Y
      width = [int]$targetScreen.Bounds.Width
      height = [int]$targetScreen.Bounds.Height
    }
    workArea = @{
      x = [int]$targetScreen.WorkingArea.X
      y = [int]$targetScreen.WorkingArea.Y
      width = [int]$targetScreen.WorkingArea.Width
      height = [int]$targetScreen.WorkingArea.Height
    }
  }
  toBounds = $afterBounds
  query = $query
} | ConvertTo-Json -Depth 8 -Compress
`;

    try {
      const stdout = await runPowerShellScript(script, 4200);
      const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
      const nativeFromBounds = normalizeWindowMoveBounds(parsed?.fromBounds);
      const nativeToBounds = normalizeWindowMoveBounds(parsed?.toBounds);
      const fromBounds = nativeScreenRectToDipRect(nativeFromBounds);
      const toBounds = nativeScreenRectToDipRect(nativeToBounds);
      const fromDisplay = findDisplayForBounds(fromBounds);
      const toDisplay = findDisplayForBounds(toBounds);
      const targetDisplay = parsed?.targetDisplay && typeof parsed.targetDisplay === 'object'
        ? parsed.targetDisplay
        : null;
      const targetDisplayBounds = normalizeDisplayRect(targetDisplay?.bounds);
      const targetDisplayWorkArea = normalizeDisplayRect(targetDisplay?.workArea) || targetDisplayBounds;
      const targetDisplayDeviceName = typeof targetDisplay?.deviceName === 'string' ? targetDisplay.deviceName : '';
      const verified = Boolean(parsed?.verified);

      return {
        ok: Boolean(parsed?.ok),
        moved: Boolean(parsed?.moved),
        verified,
        wasMaximized: Boolean(parsed?.wasMaximized),
        maximizedRestored: Boolean(parsed?.maximizedRestored),
        error: typeof parsed?.error === 'string' ? parsed.error : undefined,
        fromBounds,
        fromDisplayId: fromDisplay?.id ?? null,
        fromDisplayLabel: fromDisplay?.label ?? null,
        hwnd: Number.isFinite(Number(parsed?.hwnd)) ? Math.round(Number(parsed.hwnd)) : undefined,
        matchCount: Number.isFinite(Number(parsed?.matchCount)) ? Math.round(Number(parsed.matchCount)) : 0,
        matchReason: typeof parsed?.matchReason === 'string' ? parsed.matchReason : undefined,
        nativeCoordinateSpace: nativeToBounds ? 'native-screen' : null,
        nativeFromBounds,
        nativeToBounds,
        pid: Number.isFinite(Number(parsed?.pid)) ? Math.round(Number(parsed.pid)) : undefined,
        processName: typeof parsed?.processName === 'string' ? parsed.processName : undefined,
        query,
        queryCandidates: Array.isArray(parsed?.queryCandidates)
          ? parsed.queryCandidates.filter((item) => typeof item === 'string')
          : queryCandidates,
        reason: typeof parsed?.reason === 'string' ? parsed.reason : undefined,
        retryMoveAttempted: Boolean(parsed?.retryMoveAttempted),
        targetDisplay: targetDisplay ? {
          bounds: targetDisplayBounds,
          id: targetDisplayDeviceName,
          label: targetDisplayDeviceName || undefined,
          primary: Boolean(targetDisplay.primary),
          workArea: targetDisplayWorkArea,
        } : null,
        targetDisplayId: targetDisplayDeviceName,
        targetDisplayLabel: targetDisplayDeviceName || undefined,
        toBounds,
        toDisplayId: toDisplay?.id ?? null,
        toDisplayLabel: toDisplay?.label ?? null,
        title: typeof parsed?.title === 'string' ? parsed.title : undefined,
      };
    } catch (error) {
      return {
        ok: false,
        moved: false,
        error: error instanceof Error ? error.message : String(error),
        query,
      };
    }
  }

  function normalizeWindowControlState(value) {
    const text = String(value || '').trim().toLowerCase().replace(/[-\s]+/gu, '_');
    if (!text) {
      return '';
    }

    if (text === 'minimize' || text === 'minimized') {
      return 'minimized';
    }

    if (text === 'maximize' || text === 'maximized') {
      return 'maximized';
    }

    if (text === 'restore' || text === 'restored' || text === 'normal') {
      return 'normal';
    }

    return '';
  }

  function normalizeWindowControlSnap(value) {
    const text = String(value || '').trim().toLowerCase().replace(/[\s_]+/gu, '-');
    return [
      'left',
      'right',
      'top',
      'bottom',
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
      'center',
    ].includes(text)
      ? text
      : '';
  }

  function getFiniteRequestNumber(request, keys) {
    for (const key of keys) {
      const value = Number(request?.[key]);
      if (Number.isFinite(value)) {
        return Math.round(value);
      }
    }

    return null;
  }

  async function controlWindow(request = {}) {
    const query = String(request?.query || request?.target || request?.title || request?.processName || request?.name || '').trim();
    const requestedPid = Number(request?.pid);
    const requestedHwnd = Number(request?.hwnd || request?.windowHandle);
    const hasPid = Number.isFinite(requestedPid) && requestedPid > 0;
    const hasHwnd = Number.isFinite(requestedHwnd) && requestedHwnd > 0;
    const fallbackToActiveWindow = typeof request?.fallbackToActiveWindow === 'boolean'
      ? request.fallbackToActiveWindow
      : (!query && !hasPid && !hasHwnd);
    const targetHint = createMoveWindowNativeDisplayHint(request);
    const state = normalizeWindowControlState(request?.windowState || request?.state || request?.mode);
    const snap = normalizeWindowControlSnap(request?.snap || request?.snapPosition || request?.placement);
    const x = getFiniteRequestNumber(request, ['x', 'left']);
    const y = getFiniteRequestNumber(request, ['y', 'top']);
    const width = getFiniteRequestNumber(request, ['width', 'w']);
    const height = getFiniteRequestNumber(request, ['height', 'h']);
    const coordinateSpace = String(request?.coordinateSpace || '').trim().toLowerCase() === 'display'
      ? 'display'
      : 'native-screen';
    const hasBoundsChange = x !== null || y !== null || width !== null || height !== null;
    const hasDisplayTarget = Boolean(targetHint.requestedDisplay || targetHint.targetRole || targetHint.targetIndex || targetHint.targetDisplayText);
    const hasOperation = Boolean(state || snap || hasBoundsChange || hasDisplayTarget);

    if (!hasOperation) {
      return {
        ok: false,
        controlled: false,
        error: 'Window control operation is empty.',
        query,
      };
    }

    if (!query && !hasPid && !hasHwnd && !fallbackToActiveWindow) {
      return {
        ok: false,
        controlled: false,
        error: 'Window control query is empty.',
        query,
      };
    }

    if (process.platform !== 'win32') {
      return {
        ok: false,
        controlled: false,
        error: 'Window control is currently only implemented on Windows.',
        query,
      };
    }

    const payload = {
      coordinateSpace,
      fallbackToActiveWindow,
      height,
      hwnd: hasHwnd ? Math.round(requestedHwnd) : 0,
      pid: hasPid ? Math.round(requestedPid) : 0,
      query,
      snap,
      state,
      targetDisplayText: targetHint.targetDisplayText,
      targetIndex: targetHint.targetIndex,
      targetRole: targetHint.targetRole,
      width,
      x,
      y,
    };

    const script = String.raw`
$ErrorActionPreference = 'Stop'
$payload = @'
${JSON.stringify(payload)}
'@ | ConvertFrom-Json
$query = [string]$payload.query
$requestedPid = [int64]$payload.pid
$requestedHwnd = [int64]$payload.hwnd
$fallbackToActiveWindow = [bool]$payload.fallbackToActiveWindow
$state = [string]$payload.state
$snap = [string]$payload.snap
$coordinateSpace = [string]$payload.coordinateSpace
$targetRole = [string]$payload.targetRole
$targetIndex = [int]$payload.targetIndex
$targetDisplayText = [string]$payload.targetDisplayText
$requestedX = if ($null -ne $payload.x) { [int]$payload.x } else { $null }
$requestedY = if ($null -ne $payload.y) { [int]$payload.y } else { $null }
$requestedWidth = if ($null -ne $payload.width) { [int]$payload.width } else { $null }
$requestedHeight = if ($null -ne $payload.height) { [int]$payload.height } else { $null }

[Console]::InputEncoding = New-Object System.Text.UTF8Encoding -ArgumentList $false
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding -ArgumentList $false
$OutputEncoding = [Console]::OutputEncoding
Add-Type -AssemblyName System.Windows.Forms

${createTopLevelWindowEnumeratorPowerShell()}

function Get-DesktopPetWindowBounds($handle) {
  $rect = New-Object DesktopPetWindowRect
  $hasRect = [DesktopPetTopLevelWindowEnumerator]::GetWindowRect($handle, [ref]$rect)
  if (-not $hasRect) {
    return $null
  }

  return @{
    x = [int]$rect.Left
    y = [int]$rect.Top
    width = [Math]::Max(0, [int]($rect.Right - $rect.Left))
    height = [Math]::Max(0, [int]($rect.Bottom - $rect.Top))
  }
}

function Get-DesktopPetWindowState($handle) {
  if ([DesktopPetTopLevelWindowEnumerator]::IsIconic($handle)) {
    return 'minimized'
  }

  if ([DesktopPetTopLevelWindowEnumerator]::IsZoomed($handle)) {
    return 'maximized'
  }

  return 'normal'
}

function Normalize-DesktopPetDisplayText($value) {
  if ($null -eq $value) {
    return ''
  }

  return ([string]$value).Trim().ToLowerInvariant() -replace '[^a-z0-9]+', ''
}

function Resolve-DesktopPetTargetScreen($fallbackBounds) {
  $screens = @([System.Windows.Forms.Screen]::AllScreens)
  $targetScreen = $null

  if ($targetRole -eq 'primary') {
    $targetScreen = $screens | Where-Object { $_.Primary } | Select-Object -First 1
  } elseif ($targetRole -eq 'secondary') {
    $targetScreen = $screens | Where-Object { -not $_.Primary } | Select-Object -First 1
  } elseif ($targetIndex -gt 0 -and $targetIndex -le $screens.Count) {
    $targetScreen = $screens[$targetIndex - 1]
  } elseif (-not [string]::IsNullOrWhiteSpace($targetDisplayText)) {
    $normalizedDisplayText = Normalize-DesktopPetDisplayText $targetDisplayText
    $targetScreen = $screens | Where-Object {
      $deviceName = Normalize-DesktopPetDisplayText $_.DeviceName
      $deviceName -eq $normalizedDisplayText -or $deviceName.Contains($normalizedDisplayText) -or $normalizedDisplayText.Contains($deviceName)
    } | Select-Object -First 1
  }

  if ($null -eq $targetScreen -and $null -ne $fallbackBounds) {
    $centerX = [double]$fallbackBounds.x + ([double]$fallbackBounds.width / 2)
    $centerY = [double]$fallbackBounds.y + ([double]$fallbackBounds.height / 2)
    $targetScreen = $screens | Where-Object {
      $centerX -ge $_.Bounds.X -and $centerX -lt ($_.Bounds.X + $_.Bounds.Width) -and $centerY -ge $_.Bounds.Y -and $centerY -lt ($_.Bounds.Y + $_.Bounds.Height)
    } | Select-Object -First 1
  }

  if ($null -eq $targetScreen) {
    $targetScreen = $screens | Where-Object { $_.Primary } | Select-Object -First 1
  }

  return $targetScreen
}

function Convert-DesktopPetScreenSummary($screen) {
  if ($null -eq $screen) {
    return $null
  }

  return @{
    deviceName = [string]$screen.DeviceName
    primary = [bool]$screen.Primary
    bounds = @{
      x = [int]$screen.Bounds.X
      y = [int]$screen.Bounds.Y
      width = [int]$screen.Bounds.Width
      height = [int]$screen.Bounds.Height
    }
    workArea = @{
      x = [int]$screen.WorkingArea.X
      y = [int]$screen.WorkingArea.Y
      width = [int]$screen.WorkingArea.Width
      height = [int]$screen.WorkingArea.Height
    }
  }
}

function Resolve-DesktopPetTargetBounds($beforeBounds, $targetScreen) {
  if ($null -eq $beforeBounds) {
    $beforeBounds = @{ x = 0; y = 0; width = 900; height = 640 }
  }

  $workArea = if ($null -ne $targetScreen) { $targetScreen.WorkingArea } else { $null }
  $baseX = if ($null -ne $workArea) { [int]$workArea.X } else { [int]$beforeBounds.x }
  $baseY = if ($null -ne $workArea) { [int]$workArea.Y } else { [int]$beforeBounds.y }
  $baseWidth = if ($null -ne $workArea) { [int]$workArea.Width } else { [int]$beforeBounds.width }
  $baseHeight = if ($null -ne $workArea) { [int]$workArea.Height } else { [int]$beforeBounds.height }

  $nextX = [int]$beforeBounds.x
  $nextY = [int]$beforeBounds.y
  $nextWidth = [Math]::Max(80, [int]$beforeBounds.width)
  $nextHeight = [Math]::Max(60, [int]$beforeBounds.height)

  if (-not [string]::IsNullOrWhiteSpace($snap)) {
    switch ($snap) {
      'left' {
        $nextX = $baseX; $nextY = $baseY; $nextWidth = [Math]::Floor($baseWidth / 2); $nextHeight = $baseHeight
      }
      'right' {
        $nextWidth = [Math]::Floor($baseWidth / 2); $nextHeight = $baseHeight; $nextX = $baseX + $baseWidth - $nextWidth; $nextY = $baseY
      }
      'top' {
        $nextX = $baseX; $nextY = $baseY; $nextWidth = $baseWidth; $nextHeight = [Math]::Floor($baseHeight / 2)
      }
      'bottom' {
        $nextWidth = $baseWidth; $nextHeight = [Math]::Floor($baseHeight / 2); $nextX = $baseX; $nextY = $baseY + $baseHeight - $nextHeight
      }
      'top-left' {
        $nextX = $baseX; $nextY = $baseY; $nextWidth = [Math]::Floor($baseWidth / 2); $nextHeight = [Math]::Floor($baseHeight / 2)
      }
      'top-right' {
        $nextWidth = [Math]::Floor($baseWidth / 2); $nextHeight = [Math]::Floor($baseHeight / 2); $nextX = $baseX + $baseWidth - $nextWidth; $nextY = $baseY
      }
      'bottom-left' {
        $nextWidth = [Math]::Floor($baseWidth / 2); $nextHeight = [Math]::Floor($baseHeight / 2); $nextX = $baseX; $nextY = $baseY + $baseHeight - $nextHeight
      }
      'bottom-right' {
        $nextWidth = [Math]::Floor($baseWidth / 2); $nextHeight = [Math]::Floor($baseHeight / 2); $nextX = $baseX + $baseWidth - $nextWidth; $nextY = $baseY + $baseHeight - $nextHeight
      }
      'center' {
        $nextWidth = [Math]::Min($nextWidth, $baseWidth)
        $nextHeight = [Math]::Min($nextHeight, $baseHeight)
        $nextX = $baseX + [Math]::Floor(($baseWidth - $nextWidth) / 2)
        $nextY = $baseY + [Math]::Floor(($baseHeight - $nextHeight) / 2)
      }
    }
  } elseif (-not [string]::IsNullOrWhiteSpace($targetRole) -or $targetIndex -gt 0 -or -not [string]::IsNullOrWhiteSpace($targetDisplayText)) {
    $nextWidth = [Math]::Min($nextWidth, $baseWidth)
    $nextHeight = [Math]::Min($nextHeight, $baseHeight)
    $nextX = $baseX + [Math]::Floor(($baseWidth - $nextWidth) / 2)
    $nextY = $baseY + [Math]::Floor(($baseHeight - $nextHeight) / 2)
  }

  if ($null -ne $requestedWidth) { $nextWidth = [int]$requestedWidth }
  if ($null -ne $requestedHeight) { $nextHeight = [int]$requestedHeight }
  if ($null -ne $requestedX) { $nextX = if ($coordinateSpace -eq 'display' -and $null -ne $workArea) { $baseX + [int]$requestedX } else { [int]$requestedX } }
  if ($null -ne $requestedY) { $nextY = if ($coordinateSpace -eq 'display' -and $null -ne $workArea) { $baseY + [int]$requestedY } else { [int]$requestedY } }

  $nextWidth = [Math]::Max(80, [int]$nextWidth)
  $nextHeight = [Math]::Max(60, [int]$nextHeight)
  if ($null -ne $workArea) {
    $nextWidth = [Math]::Min($nextWidth, [int]$workArea.Width)
    $nextHeight = [Math]::Min($nextHeight, [int]$workArea.Height)
    $nextX = [Math]::Max([int]$workArea.X, [Math]::Min([int]$nextX, [int]($workArea.X + $workArea.Width - $nextWidth)))
    $nextY = [Math]::Max([int]$workArea.Y, [Math]::Min([int]$nextY, [int]($workArea.Y + $workArea.Height - $nextHeight)))
  }

  return @{
    x = [int]$nextX
    y = [int]$nextY
    width = [int]$nextWidth
    height = [int]$nextHeight
  }
}

$normalizedQuery = Normalize-DesktopPetText $query
$windows = Get-DesktopPetTopLevelWindows
$matches = @()

foreach ($window in $windows) {
  $title = [string]$window.title
  $normalizedTitle = Normalize-DesktopPetText $title
  $normalizedProcess = Normalize-DesktopPetText $window.processName
  $score = 0
  $reason = ''

  if ($requestedHwnd -gt 0 -and [int64]$window.hwnd -eq $requestedHwnd) {
    $score = 220
    $reason = 'hwnd'
  } elseif ($requestedPid -gt 0 -and [int]$window.pid -eq $requestedPid) {
    $score = 200
    $reason = 'pid'
  } elseif ($normalizedQuery) {
    if ($normalizedProcess -eq $normalizedQuery) {
      $score = 170
      $reason = 'process-exact'
    } elseif ($normalizedTitle -eq $normalizedQuery) {
      $score = 150
      $reason = 'title-exact'
    } elseif ($normalizedProcess.Contains($normalizedQuery)) {
      $score = 120
      $reason = 'process-contains'
    } elseif ($normalizedTitle.Contains($normalizedQuery)) {
      $score = 100
      $reason = 'title-contains'
    }
  }

  if ($score -gt 0) {
    $score += [Math]::Max(0, 40 - [int]$window.topLevelOrder)
    $matches += [PSCustomObject]@{
      Process = $window
      Handle = ([IntPtr]$window.handle)
      Hwnd = [int64]$window.hwnd
      Pid = [int]$window.pid
      Score = $score
      MatchReason = $reason
      Title = $title
    }
  }
}

$match = $matches | Sort-Object -Property Score -Descending | Select-Object -First 1
if ($null -eq $match -and $fallbackToActiveWindow) {
  $foregroundHandle = [DesktopPetTopLevelWindowEnumerator]::GetForegroundWindow()
  if ($foregroundHandle -ne [IntPtr]::Zero -and [DesktopPetTopLevelWindowEnumerator]::IsWindow($foregroundHandle) -and [DesktopPetTopLevelWindowEnumerator]::IsWindowVisible($foregroundHandle)) {
    $foregroundPid = [uint32]0
    [void][DesktopPetTopLevelWindowEnumerator]::GetWindowThreadProcessId($foregroundHandle, [ref]$foregroundPid)
    $foregroundProcess = $null
    try {
      $foregroundProcess = Get-Process -Id ([int]$foregroundPid) -ErrorAction Stop
    } catch {
      $foregroundProcess = $null
    }

    if ($null -ne $foregroundProcess) {
      $match = [PSCustomObject]@{
        Process = [PSCustomObject]@{
          bounds = (Get-DesktopPetWindowBounds $foregroundHandle)
          handle = $foregroundHandle
          hwnd = [int64]$foregroundHandle.ToInt64()
          pid = [int]$foregroundPid
          processName = [string]$foregroundProcess.ProcessName
          title = [DesktopPetTopLevelWindowEnumerator]::ReadWindowText($foregroundHandle)
        }
        Handle = $foregroundHandle
        Hwnd = [int64]$foregroundHandle.ToInt64()
        Pid = [int]$foregroundPid
        Score = 80
        MatchReason = 'foreground-fallback'
        Title = [DesktopPetTopLevelWindowEnumerator]::ReadWindowText($foregroundHandle)
      }
    }
  }
}

if ($null -eq $match) {
  @{
    ok = $false
    controlled = $false
    reason = 'no-window-match'
    query = $query
    matchCount = 0
  } | ConvertTo-Json -Depth 6 -Compress
  exit 0
}

$handle = [IntPtr]$match.Handle
$targetWindow = $match.Process
$beforeBounds = Get-DesktopPetWindowBounds $handle
$beforeState = Get-DesktopPetWindowState $handle
$targetScreen = Resolve-DesktopPetTargetScreen $beforeBounds
$targetBounds = Resolve-DesktopPetTargetBounds $beforeBounds $targetScreen
$showResult = $true
$boundsChanged = $false
$stateChanged = $false
$reason = ''

if ($state -eq 'minimized') {
  $showResult = [DesktopPetTopLevelWindowEnumerator]::ShowWindowAsync($handle, 6)
  $stateChanged = $true
} elseif ($state -eq 'maximized') {
  $showResult = [DesktopPetTopLevelWindowEnumerator]::ShowWindowAsync($handle, 3)
  $stateChanged = $true
} elseif ($state -eq 'normal') {
  $showResult = [DesktopPetTopLevelWindowEnumerator]::ShowWindowAsync($handle, 9)
  $stateChanged = $true
}

if ($snap -or $requestedX -ne $null -or $requestedY -ne $null -or $requestedWidth -ne $null -or $requestedHeight -ne $null -or -not [string]::IsNullOrWhiteSpace($targetRole) -or $targetIndex -gt 0 -or -not [string]::IsNullOrWhiteSpace($targetDisplayText)) {
  if ($state -ne 'minimized') {
    [void][DesktopPetTopLevelWindowEnumerator]::ShowWindowAsync($handle, 9)
    Start-Sleep -Milliseconds 60
    $boundsChanged = [DesktopPetTopLevelWindowEnumerator]::SetWindowPos(
      $handle,
      [IntPtr]::Zero,
      [int]$targetBounds.x,
      [int]$targetBounds.y,
      [int]$targetBounds.width,
      [int]$targetBounds.height,
      0x0004
    )
  } else {
    $reason = 'bounds-change-skipped-while-minimized'
  }
}

Start-Sleep -Milliseconds 180
$afterBounds = Get-DesktopPetWindowBounds $handle
$afterState = Get-DesktopPetWindowState $handle

@{
  ok = [bool]($showResult -and (($boundsChanged -eq $true) -or (-not $snap -and $requestedX -eq $null -and $requestedY -eq $null -and $requestedWidth -eq $null -and $requestedHeight -eq $null -and [string]::IsNullOrWhiteSpace($targetRole) -and $targetIndex -le 0 -and [string]::IsNullOrWhiteSpace($targetDisplayText))))
  controlled = [bool]($showResult -or $boundsChanged)
  stateChanged = [bool]$stateChanged
  boundsChanged = [bool]$boundsChanged
  requestedState = $state
  requestedSnap = $snap
  beforeState = $beforeState
  afterState = $afterState
  processName = $targetWindow.processName
  title = $match.Title
  pid = $match.Pid
  hwnd = $match.Hwnd
  matchReason = $match.MatchReason
  matchCount = @($matches).Count
  reason = $reason
  fromBounds = $beforeBounds
  toBounds = $afterBounds
  targetBounds = $targetBounds
  targetDisplay = (Convert-DesktopPetScreenSummary $targetScreen)
  query = $query
} | ConvertTo-Json -Depth 8 -Compress
`;

    try {
      const stdout = await runPowerShellScript(script, 4200);
      const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
      const nativeFromBounds = normalizeWindowMoveBounds(parsed?.fromBounds);
      const nativeToBounds = normalizeWindowMoveBounds(parsed?.toBounds);
      const nativeTargetBounds = normalizeWindowMoveBounds(parsed?.targetBounds);
      const fromBounds = nativeScreenRectToDipRect(nativeFromBounds);
      const toBounds = nativeScreenRectToDipRect(nativeToBounds);
      const targetBounds = nativeScreenRectToDipRect(nativeTargetBounds);
      const fromDisplay = findDisplayForBounds(fromBounds);
      const toDisplay = findDisplayForBounds(toBounds);
      const targetDisplay = parsed?.targetDisplay && typeof parsed.targetDisplay === 'object'
        ? parsed.targetDisplay
        : null;
      const targetDisplayBounds = normalizeDisplayRect(targetDisplay?.bounds);
      const targetDisplayWorkArea = normalizeDisplayRect(targetDisplay?.workArea) || targetDisplayBounds;
      const targetDisplayDeviceName = typeof targetDisplay?.deviceName === 'string' ? targetDisplay.deviceName : '';

      return {
        ok: Boolean(parsed?.ok),
        controlled: Boolean(parsed?.controlled),
        stateChanged: Boolean(parsed?.stateChanged),
        boundsChanged: Boolean(parsed?.boundsChanged),
        requestedState: typeof parsed?.requestedState === 'string' ? parsed.requestedState : '',
        requestedSnap: typeof parsed?.requestedSnap === 'string' ? parsed.requestedSnap : '',
        beforeState: typeof parsed?.beforeState === 'string' ? parsed.beforeState : '',
        afterState: typeof parsed?.afterState === 'string' ? parsed.afterState : '',
        error: typeof parsed?.error === 'string' ? parsed.error : undefined,
        fromBounds,
        fromDisplayId: fromDisplay?.id ?? null,
        fromDisplayLabel: fromDisplay?.label ?? null,
        hwnd: Number.isFinite(Number(parsed?.hwnd)) ? Math.round(Number(parsed.hwnd)) : undefined,
        matchCount: Number.isFinite(Number(parsed?.matchCount)) ? Math.round(Number(parsed.matchCount)) : 0,
        matchReason: typeof parsed?.matchReason === 'string' ? parsed.matchReason : undefined,
        nativeCoordinateSpace: nativeToBounds || nativeTargetBounds ? 'native-screen' : null,
        nativeFromBounds,
        nativeTargetBounds,
        nativeToBounds,
        pid: Number.isFinite(Number(parsed?.pid)) ? Math.round(Number(parsed.pid)) : undefined,
        processName: typeof parsed?.processName === 'string' ? parsed.processName : undefined,
        query,
        reason: typeof parsed?.reason === 'string' ? parsed.reason : undefined,
        targetBounds,
        targetDisplay: targetDisplay ? {
          bounds: targetDisplayBounds,
          id: targetDisplayDeviceName,
          label: targetDisplayDeviceName || undefined,
          primary: Boolean(targetDisplay.primary),
          workArea: targetDisplayWorkArea,
        } : null,
        targetDisplayId: targetDisplayDeviceName,
        targetDisplayLabel: targetDisplayDeviceName || undefined,
        title: typeof parsed?.title === 'string' ? parsed.title : undefined,
        toBounds,
        toDisplayId: toDisplay?.id ?? null,
        toDisplayLabel: toDisplay?.label ?? null,
      };
    } catch (error) {
      return {
        ok: false,
        controlled: false,
        error: error instanceof Error ? error.message : String(error),
        query,
      };
    }
  }

  async function closeWindow(request = {}) {
    const query = String(request?.query || request?.target || request?.title || request?.processName || request?.name || '').trim();
    const requestedPid = Number(request?.pid);
    const requestedHwnd = Number(request?.hwnd || request?.windowHandle);
    const hasPid = Number.isFinite(requestedPid) && requestedPid > 0;
    const hasHwnd = Number.isFinite(requestedHwnd) && requestedHwnd > 0;

    if (!query && !hasPid && !hasHwnd) {
      return {
        ok: false,
        closed: false,
        error: 'Window close query is empty.',
        query,
      };
    }

    if (process.platform !== 'win32') {
      return {
        ok: false,
        closed: false,
        error: 'Window closing is currently only implemented on Windows.',
        query,
      };
    }

    const script = String.raw`
$ErrorActionPreference = 'Stop'
$query = @'
${JSON.stringify(query)}
'@ | ConvertFrom-Json
$requestedPid = ${hasPid ? Math.round(requestedPid) : 0}
$requestedHwnd = ${hasHwnd ? Math.round(requestedHwnd) : 0}

Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;

public static class DesktopPetWindowClose {
  public const UInt32 WM_CLOSE = 0x0010;

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [DllImport("user32.dll")]
  public static extern bool IsWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool PostMessage(IntPtr hWnd, UInt32 Msg, IntPtr wParam, IntPtr lParam);
}
"@

function Normalize-DesktopPetText($value) {
  if ($null -eq $value) {
    return ''
  }

  return ([string]$value).Trim().ToLowerInvariant() -replace '[\s\(\)\[\]\{\}"''._\-:：，。、【】（）「」『』]+', ''
}

function Get-DesktopPetWindowTitle($handle) {
  $builder = New-Object System.Text.StringBuilder 1024
  [void][DesktopPetWindowClose]::GetWindowText($handle, $builder, $builder.Capacity)
  return [string]$builder.ToString()
}

${createTopLevelWindowEnumeratorPowerShell()}

$normalizedQuery = Normalize-DesktopPetText $query
$windows = Get-DesktopPetTopLevelWindows
$matches = @()

foreach ($window in $windows) {
  $handle = [IntPtr]$window.handle
  if (-not [DesktopPetTopLevelWindowEnumerator]::IsWindow($handle) -or -not [DesktopPetTopLevelWindowEnumerator]::IsWindowVisible($handle)) {
    continue
  }

  $title = [string]$window.title
  $normalizedTitle = Normalize-DesktopPetText $title
  $normalizedProcess = Normalize-DesktopPetText $window.processName
  $score = 0
  $reason = ''

  if ($requestedHwnd -gt 0 -and [int64]$window.hwnd -eq $requestedHwnd) {
    $score = 220
    $reason = 'hwnd'
  } elseif ($requestedPid -gt 0 -and [int]$window.pid -eq $requestedPid) {
    $score = 200
    $reason = 'pid'
  } elseif ($normalizedQuery) {
    if ($normalizedProcess -eq $normalizedQuery) {
      $score = 170
      $reason = 'process-exact'
    } elseif ($normalizedTitle -eq $normalizedQuery) {
      $score = 150
      $reason = 'title-exact'
    } elseif ($normalizedProcess.Contains($normalizedQuery)) {
      $score = 120
      $reason = 'process-contains'
    } elseif ($normalizedTitle.Contains($normalizedQuery)) {
      $score = 100
      $reason = 'title-contains'
    }
  }

  if ($score -gt 0) {
    $score += [Math]::Max(0, 40 - [int]$window.topLevelOrder)
    $matches += [PSCustomObject]@{
      Process = $window
      Handle = $handle
      Hwnd = [int64]$window.hwnd
      Pid = [int]$window.pid
      Score = $score
      MatchReason = $reason
      Title = $title
    }
  }
}

$match = $matches | Sort-Object -Property Score -Descending | Select-Object -First 1
if ($null -eq $match) {
  @{
    ok = $false
    closed = $false
    reason = 'no-window-match'
    query = $query
    matchCount = 0
  } | ConvertTo-Json -Depth 5 -Compress
  exit 0
}

$targetProcess = $match.Process
$handle = [IntPtr]$match.Handle
$sent = [DesktopPetTopLevelWindowEnumerator]::PostMessage($handle, [DesktopPetTopLevelWindowEnumerator]::WM_CLOSE, [IntPtr]::Zero, [IntPtr]::Zero)
Start-Sleep -Milliseconds 700
$stillWindow = [DesktopPetTopLevelWindowEnumerator]::IsWindow($handle)
$stillProcess = $false
try {
  $processAfter = Get-Process -Id $match.Pid -ErrorAction Stop
  $stillProcess = $null -ne $processAfter
} catch {
  $stillProcess = $false
}

@{
  ok = [bool]$sent
  closed = -not $stillWindow
  processName = $targetProcess.processName
  title = $match.Title
  pid = $match.Pid
  hwnd = $match.Hwnd
  matchReason = $match.MatchReason
  matchCount = @($matches).Count
  stillWindow = [bool]$stillWindow
  stillProcessWindow = [bool]$stillProcess
  query = $query
} | ConvertTo-Json -Depth 5 -Compress
`;

    try {
      const stdout = await runPowerShellScript(script, 3600);
      const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
      return {
        ok: Boolean(parsed?.ok),
        closed: Boolean(parsed?.closed),
        error: typeof parsed?.error === 'string' ? parsed.error : undefined,
        hwnd: Number.isFinite(Number(parsed?.hwnd)) ? Math.round(Number(parsed.hwnd)) : undefined,
        matchCount: Number.isFinite(Number(parsed?.matchCount)) ? Math.round(Number(parsed.matchCount)) : 0,
        matchReason: typeof parsed?.matchReason === 'string' ? parsed.matchReason : undefined,
        pid: Number.isFinite(Number(parsed?.pid)) ? Math.round(Number(parsed.pid)) : undefined,
        processName: typeof parsed?.processName === 'string' ? parsed.processName : undefined,
        query,
        reason: typeof parsed?.reason === 'string' ? parsed.reason : undefined,
        stillProcessWindow: Boolean(parsed?.stillProcessWindow),
        stillWindow: Boolean(parsed?.stillWindow),
        title: typeof parsed?.title === 'string' ? parsed.title : undefined,
      };
    } catch (error) {
      return {
        ok: false,
        closed: false,
        error: error instanceof Error ? error.message : String(error),
        query,
      };
    }
  }

  function isLikelyUrlTarget(value) {
    const text = String(value || '').trim();
    if (!text || /\s/u.test(text)) {
      return false;
    }

    if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(text)) {
      return true;
    }

    return /^[^\s:/?#]+\.[^\s:/?#]{2,}(?:[/?#].*)?$/iu.test(text);
  }

  function normalizeUrlTarget(value) {
    const text = String(value || '').trim();
    if (!text) {
      return '';
    }

    if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(text)) {
      return text;
    }

    if (isLikelyUrlTarget(text)) {
      return `https://${text}`;
    }

    return '';
  }

  async function openResource(request = {}) {
    const target = String(
      request?.target
      || request?.query
      || request?.url
      || request?.path
      || request?.website
      || request?.site
      || '',
    ).trim().replace(/^["']|["']$/g, '');
    const requestedType = String(request?.resourceType || 'auto').trim().toLowerCase();
    const resourceType = ['auto', 'url', 'file', 'folder', 'app'].includes(requestedType)
      ? requestedType
      : 'auto';

    if (!target) {
      return {
        ok: false,
        error: 'Open target is empty.',
        resourceType,
        target,
      };
    }

    if (resourceType === 'app') {
      const launchResult = await launchLocalApp({
        forceNew: Boolean(request?.forceNew),
        query: target,
      });
      return {
        ...launchResult,
        resourceType: 'app',
        target,
      };
    }

    const url = resourceType === 'url' || (resourceType === 'auto' && isLikelyUrlTarget(target))
      ? normalizeUrlTarget(target)
      : '';
    if (url) {
      try {
        await shellApi.openExternal(url);
        return {
          ok: true,
          action: 'opened',
          resourceType: 'url',
          target,
          url,
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          resourceType: 'url',
          target,
          url,
        };
      }
    }

    if (resourceType === 'url') {
      return {
        ok: false,
        error: 'Target does not look like a valid URL or domain.',
        resourceType: 'url',
        target,
      };
    }

    if (path.isAbsolute(target)) {
      const error = await shellApi.openPath(target);
      let localResourceType = 'file';
      try {
        localResourceType = fs.existsSync(target) && fs.statSync(target).isDirectory() ? 'folder' : 'file';
      } catch {
        localResourceType = resourceType === 'folder' ? 'folder' : 'file';
      }

      return {
        ok: !error,
        action: error ? 'failed' : 'opened',
        error: error || undefined,
        resourceType: localResourceType,
        target,
      };
    }

    if (resourceType === 'file' || resourceType === 'folder') {
      return {
        ok: false,
        error: 'File or folder targets must be absolute local paths.',
        resourceType,
        target,
      };
    }

    const launchResult = await launchLocalApp({
      forceNew: Boolean(request?.forceNew),
      query: target,
    });
    return {
      ...launchResult,
      resourceType: 'app',
      target,
    };
  }

  function waitForMs(durationMs) {
    return new Promise((resolve) => {
      setTimeout(resolve, Math.max(0, Math.round(Number(durationMs) || 0)));
    });
  }

  async function createLaunchVerification(action, query, selectedApp, options = {}) {
    const shouldPoll = Boolean(options?.delay);
    if (shouldPoll) {
      const deadline = Date.now() + POST_LAUNCH_VERIFY_DELAY_MS;
      do {
        const focusResult = await focusExistingAppWindow(query, selectedApp);
        if (focusResult.ok) {
          return {
            action,
            ok: true,
            reason: action === 'focused' ? 'existing-window-focused' : 'launched-window-detected',
            window: focusResult,
          };
        }

        if (Date.now() >= deadline) {
          return {
            action,
            ok: false,
            reason: focusResult.reason || 'window-not-detected-after-action',
            window: focusResult,
          };
        }

        await waitForMs(POST_LAUNCH_VERIFY_POLL_INTERVAL_MS);
      } while (true);
    }

    const focusResult = await focusExistingAppWindow(query, selectedApp);
    if (focusResult.ok) {
      return {
        action,
        ok: true,
        reason: action === 'focused' ? 'existing-window-focused' : 'launched-window-detected',
        window: focusResult,
      };
    }

    return {
      action,
      ok: false,
      reason: focusResult.reason || 'window-not-detected-after-action',
      window: focusResult,
    };
  }

  function createLaunchResult({
    action,
    app: selectedApp,
    error,
    forceNew,
    matches = [],
    ok,
    query,
    verification,
  }) {
    const matchCount = Array.isArray(matches) ? matches.length : 0;
    const hasSelectedApp = Boolean(selectedApp);
    return {
      action,
      app: selectedApp ?? null,
      error: error || undefined,
      forceNew: Boolean(forceNew),
      matchCount,
      matches,
      ok: Boolean(ok),
      query,
      status: ok
        ? action === 'focused' ? 'focused-existing-window' : 'launched-new-process'
        : action === 'launched' ? 'launched-unverified'
          : matchCount > 1 ? 'multiple-candidates'
            : matchCount === 1 || hasSelectedApp ? 'launch-failed'
            : 'not-found',
      verification: verification ?? null,
    };
  }

  async function launchPackagedApp(selectedApp) {
    const appId = String(selectedApp?.appId || '').trim();
    if (!appId || !appId.includes('!')) {
      return 'Packaged app entry is missing a valid AppUserModelId.';
    }

    const target = `shell:AppsFolder\\${appId}`;
    try {
      if (typeof packagedAppLauncher === 'function') {
        const result = await packagedAppLauncher({ app: selectedApp, appId, target });
        if (result === false) {
          return 'Packaged app launcher rejected the request.';
        }
        if (typeof result === 'string') {
          return result;
        }
        if (result && typeof result === 'object' && result.ok === false) {
          return String(result.error || 'Packaged app launcher rejected the request.');
        }
        return '';
      }

      await spawnDetachedAsync('explorer.exe', [target], {
        timeoutMs: PACKAGED_APP_LAUNCH_TIMEOUT_MS,
      });
      return '';
    } catch (error) {
      return compactPowerShellErrorText(error?.stderr)
        || compactPowerShellErrorText(error instanceof Error ? error.message : String(error))
        || 'Packaged app launch failed.';
    }
  }

  async function launchLocalApp(request = {}) {
    const query = String(request?.query || request?.name || '').trim();
    const forceNew = Boolean(request?.forceNew || request?.openMode === 'new');

    const directApp = resolveDirectAppPath(query);
    const rememberedMatches = directApp ? [] : searchRememberedApps(query, { limit: 6 });
    const rememberedApp = rememberedMatches[0] ?? null;
    const matches = directApp
      ? [directApp]
      : rememberedApp
        ? rememberedMatches
      : await searchLocalApps(query, { forceRefresh: Boolean(request?.forceRefresh), limit: 6 });
    let effectiveMatches = matches;
    let selectedApp = directApp ?? rememberedApp ?? effectiveMatches[0] ?? null;

    if (!selectedApp && !forceNew) {
      const focusResult = await focusExistingAppWindow(query, null);
      if (focusResult.ok) {
        const focusedApp = {
          name: query,
          path: '',
          sourceRoot: 'running-process',
          type: 'process',
        };
        logMessage('local app focused by process fallback', {
          processName: focusResult.processName,
          query,
        });
        return createLaunchResult({
          action: 'focused',
          app: focusedApp,
          forceNew,
          matches: [],
          ok: true,
          query,
          verification: {
            action: 'focused',
            ok: true,
            reason: 'existing-window-focused',
            window: focusResult,
          },
        });
      }
    }

    if (!selectedApp) {
      const diskFallbackMatches = await searchDiskFallbackApps(query, { limit: 6 });
      if (diskFallbackMatches.length) {
        effectiveMatches = diskFallbackMatches;
        selectedApp = diskFallbackMatches[0] ?? null;
        logMessage('local app resolved by bounded disk fallback', {
          matchCount: diskFallbackMatches.length,
          path: selectedApp?.path ?? '',
          query,
        });
      }
    }

    if (!selectedApp) {
      return createLaunchResult({
        action: 'failed',
        app: null,
        error: 'No matching app entry found after checking remembered apps, running windows, taskbar/start shortcuts, installed programs, and bounded local disk candidates. Please provide the app path once or remember it as an app alias.',
        forceNew,
        matches: effectiveMatches,
        ok: false,
        query,
      });
    }

    if (!forceNew) {
      const focusResult = await focusExistingAppWindow(query, selectedApp);
      if (focusResult.ok) {
        logMessage('local app focused', {
          name: selectedApp.name,
          processName: focusResult.processName,
          query,
          type: selectedApp.type,
        });

        return createLaunchResult({
          action: 'focused',
          app: selectedApp,
          forceNew,
          matches: effectiveMatches,
          ok: true,
          query,
          verification: {
            action: 'focused',
            ok: true,
            reason: 'existing-window-focused',
            window: focusResult,
          },
        });
      }
    }

    const isPackagedApp = selectedApp.type === 'aumid' && Boolean(selectedApp.appId);
    if (!isPackagedApp && typeof shellApi?.openPath !== 'function') {
      return createLaunchResult({
        action: 'failed',
        app: selectedApp,
        error: 'Electron shell.openPath is unavailable.',
        forceNew,
        matches: effectiveMatches,
        ok: false,
        query,
      });
    }

    const error = isPackagedApp
      ? await launchPackagedApp(selectedApp)
      : await shellApi.openPath(selectedApp.path);
    if (error) {
      return createLaunchResult({
        action: 'failed',
        app: selectedApp,
        error,
        forceNew,
        matches: effectiveMatches,
        ok: false,
        query,
      });
    }

    const verification = await createLaunchVerification('launched', query, selectedApp, { delay: true });
    logMessage('local app launched', {
      name: selectedApp.name,
      query,
      type: selectedApp.type,
      verified: verification.ok,
    });

    return createLaunchResult({
      action: 'launched',
      app: selectedApp,
      forceNew,
      matches: effectiveMatches,
      ok: verification.ok,
      query,
      verification,
    });
  }

  return {
    closeWindow,
    controlWindow,
    focusWindow,
    getActiveWindowInfo,
    getDefaultAppForUri,
    inspectWindowUi,
    invokeWindowUi,
    launchLocalApp,
    listInstalledApps,
    listRememberedApps,
    listRunningApps,
    listTaskbarPinnedApps,
    moveWindowToDisplay,
    openResource,
    observeWindowsAndApps,
    rememberLocalApp,
    listApps,
    searchLocalApps,
  };
}

module.exports = {
  createAppLauncherService,
};
