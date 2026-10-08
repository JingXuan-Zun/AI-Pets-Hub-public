const path = require('path');
const { getSafeStat } = require('./localProjectInspectorReader.cjs');
const { createDetection, createSuggestedAction } = require('./localProjectInspectorRules.cjs');

const EXECUTABLE_EXTENSIONS = new Set(['.exe', '.bat', '.cmd', '.ps1', '.lnk', '.url', '.appref-ms']);

function inspectExecutableFolder(entries, rootPath, targetFilePath) {
  const executableEntries = entries
    .filter((entry) => entry.isFile && EXECUTABLE_EXTENSIONS.has(entry.extension))
    .sort((first, second) => {
      const firstScore = first.extension === '.exe' ? 0 : 1;
      const secondScore = second.extension === '.exe' ? 0 : 1;
      return firstScore - secondScore || first.name.localeCompare(second.name, 'zh-Hans-CN');
    });

  if (targetFilePath) {
    const targetExtension = path.extname(targetFilePath).toLowerCase();
    if (EXECUTABLE_EXTENSIONS.has(targetExtension)) {
      executableEntries.unshift({
        extension: targetExtension,
        isDirectory: false,
        isFile: true,
        name: path.basename(targetFilePath),
        path: targetFilePath,
        sizeBytes: getSafeStat(targetFilePath)?.size ?? 0,
      });
    }
  }

  const uniqueEntries = Array.from(new Map(executableEntries.map((entry) => [entry.path.toLowerCase(), entry])).values());
  if (!uniqueEntries.length) {
    return null;
  }

  return {
    actions: uniqueEntries.slice(0, 6).map((entry) => createSuggestedAction(
      `打开候选程序：${entry.name}`,
      entry.path,
      rootPath,
      entry.name,
      'launch',
    )),
    detection: createDetection('windows-app-folder', 'Windows 程序目录', 82, '目录中存在 exe/快捷方式/脚本启动文件'),
    info: {
      executableCandidates: uniqueEntries.slice(0, 12).map((entry) => ({
        name: entry.name,
        path: entry.path,
        type: entry.extension.replace(/^\./u, ''),
      })),
    },
  };
}

module.exports = { inspectExecutableFolder };
