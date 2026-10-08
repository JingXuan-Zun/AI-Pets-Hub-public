const { createDetection, extractReadmeHints, summarizeDirectoryEntries } = require('./localProjectInspectorRules.cjs');
const { MAX_TOP_LEVEL_ENTRIES } = require('./localProjectInspectorReader.cjs');

function createProjectInspectionResult(input, clock = Date) {
  const { details, detectedProjectTypes, suggestedActions, entries, targetPath, readFiles, readmeText, rootPath, targetStat, totalEntryCount, warnings, truncated } = input;
  if (truncated) {
    warnings.push(`目录项目较多，只读取了前 ${MAX_TOP_LEVEL_ENTRIES} 项顶层文件。`);
  }

  if (!detectedProjectTypes.length) {
    detectedProjectTypes.push(createDetection('unknown-folder', '暂未识别的本机目录', 20, '没有发现常见项目入口文件'));
    warnings.push('没有发现常见启动入口。可以告诉我更具体的入口文件，或让我继续做更深层只读扫描。');
  }

  const sortedDetections = detectedProjectTypes.sort((first, second) => second.confidence - first.confidence);
  const uniqueActions = Array.from(new Map(
    suggestedActions.map((action) => [`${action.command}|${action.cwd}`, action]),
  ).values()).slice(0, 12);

  const result = {
    details,
    detectedProjectTypes: sortedDetections,
    entrySummary: summarizeDirectoryEntries(entries),
    ok: true,
    path: targetPath,
    primaryType: sortedDetections[0] ?? null,
    readFiles,
    readmeHints: extractReadmeHints(readmeText),
    rootPath,
    scannedAt: clock.now(),
    suggestedActions: uniqueActions,
    targetKind: targetStat.isDirectory() ? 'directory' : 'file',
    totalEntryCount,
    warnings,
  };
  return result;
}

module.exports = { createProjectInspectionResult };
