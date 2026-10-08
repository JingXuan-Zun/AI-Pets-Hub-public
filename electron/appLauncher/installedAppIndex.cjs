const fs = require('fs');
const path = require('path');
const { sanitizeInstalledAppPath, resolveExistingFile, createLocalAppEntry } = require('./appFileEntries.cjs');
const { APP_EXECUTABLE_EXTENSIONS, APP_INDEX_MAX_EXECUTABLE_SCAN_DIRECTORIES } = require('./appLauncherConstants.cjs');
const { normalizeSearchText, scoreAppNameMatch } = require('./appSearchMatching.cjs');

function createInstalledAppIndex({ runPowerShellScript, logMessage }) {
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
  return { createInstalledProgramRegistryEntries };
}

module.exports = { createInstalledAppIndex };
