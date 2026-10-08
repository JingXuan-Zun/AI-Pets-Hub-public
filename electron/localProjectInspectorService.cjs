const { createProjectActionRunner } = require('./localProjectInspectorActions.cjs');
const { prepareProjectTexts } = require('./localProjectInspectorTexts.cjs');
const { collectProjectDetections } = require('./localProjectInspectorDetections.cjs');
const { createProjectInspectionResult } = require('./localProjectInspectorResult.cjs');
const { listTopLevelEntries } = require('./localProjectInspectorReader.cjs');
const { resolveProjectTarget } = require('./localProjectInspectorTarget.cjs');

function createLocalProjectInspectorService({ log } = {}) {
  function logMessage(message, details) {
    if (typeof log === 'function') {
      log(message, details);
    }
  }

  function inspectLocalProject(request = {}) {
    const target = resolveProjectTarget(request);
    if (!target.ok) return target;
    const { targetPath, targetStat, rootPath, targetFilePath } = target;

    const warnings = [];
    const readFiles = [];
    const { entries, totalEntryCount, truncated } = listTopLevelEntries(rootPath);
    const { texts, readmeText } = prepareProjectTexts(rootPath, readFiles, warnings);
    const { detectedProjectTypes, suggestedActions, details } = collectProjectDetections({
      texts, entries, rootPath, targetFilePath, warnings,
    });

    const result = createProjectInspectionResult({
      details, detectedProjectTypes, suggestedActions, entries, targetPath, readFiles, readmeText, rootPath, targetStat, totalEntryCount, warnings, truncated,
    }, Date);

    logMessage('local project inspected', {
      actionCount: result.suggestedActions.length,
      primaryType: result.primaryType?.id ?? 'unknown',
      readFileCount: readFiles.length,
      rootPath,
    });

    return result;
  }

  const runLocalProjectAction = createProjectActionRunner({ inspectLocalProject, logMessage, clock: Date });

  return {
    inspectLocalProject,
    runLocalProjectAction,
  };
}

module.exports = {
  createLocalProjectInspectorService,
};
