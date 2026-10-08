const path = require('path');
const { getSafeStat } = require('./localProjectInspectorReader.cjs');
const { normalizeInputPath } = require('./localProjectInspectorRules.cjs');

function resolveProjectTarget(request = {}) {
  const rawPath = normalizeInputPath(request?.path || request?.projectPath || request?.folderPath || request?.filePath || request?.query);
  if (!rawPath) {
    return {
      ok: false,
      error: 'Missing project path.',
    };
  }

  if (!path.isAbsolute(rawPath)) {
    return {
      ok: false,
      error: 'Project path must be an absolute local path.',
      path: rawPath,
    };
  }

  const targetPath = path.resolve(rawPath);
  const targetStat = getSafeStat(targetPath);
  if (!targetStat) {
    return {
      ok: false,
      error: 'Path does not exist.',
      path: targetPath,
    };
  }

  const rootPath = targetStat.isDirectory() ? targetPath : path.dirname(targetPath);
  const targetFilePath = targetStat.isFile() ? targetPath : '';
  const rootStat = getSafeStat(rootPath);
  if (!rootStat?.isDirectory()) {
    return {
      ok: false,
      error: 'Unable to resolve containing folder.',
      path: targetPath,
    };
  }
  return { ok: true, targetPath, targetStat, rootPath, targetFilePath };
}

module.exports = { resolveProjectTarget };
