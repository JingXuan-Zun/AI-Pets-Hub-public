const { findSuggestedActionSelection } = require('./localProjectInspectorActionSelection.cjs');
const { openUrlAction } = require('./localProjectInspectorOpenUrl.cjs');
const { openPathAction } = require('./localProjectInspectorOpenPath.cjs');
const { runTerminalCommand } = require('./localProjectInspectorTerminal.cjs');

function prepareProjectAction(request, inspectLocalProject) {
  const inspection = request?.inspection && typeof request.inspection === 'object'
    ? request.inspection
    : inspectLocalProject(request);
  if (!inspection?.ok) {
    return {
      ok: false,
      error: inspection?.error ?? 'Unable to inspect project before running.',
      inspection,
    };
  }

  const selection = findSuggestedActionSelection(inspection, request);
  const action = selection?.action ?? null;
  if (!action) {
    return {
      ok: false,
      error: 'No matching suggested action found.',
      inspection,
    };
  }

  if (action.risk !== 'launch') {
    return {
      ok: false,
      action,
      error: 'Selected action is not a launch action.',
      inspection,
      selectedActionIndex: selection?.index ?? null,
    };
  }

  if (request?.dryRun) {
    return {
      action,
      dryRun: true,
      inspection,
      ok: true,
      selectedActionIndex: selection?.index ?? null,
      selectionReason: selection?.reason ?? null,
    };
  }
  return { ready: true, inspection, selection, action };
}

function createProjectActionRunner({ inspectLocalProject, logMessage, clock = Date }) {
  return async function runLocalProjectAction(request = {}) {
    const prepared = prepareProjectAction(request, inspectLocalProject);
    if (!prepared.ready) return prepared;
    const { inspection, selection, action } = prepared;
    const shell = request?.shell;
    const runResult = action.kind === 'open-url'
      ? await openUrlAction(action, shell, clock)
      : action.kind === 'open-path'
        ? await openPathAction(action, shell, clock)
        : runTerminalCommand(action, clock);

    logMessage('local project action run', {
      actionKind: action.kind,
      command: action.command,
      ok: Boolean(runResult.ok),
      rootPath: inspection.rootPath,
      selectedActionIndex: selection?.index ?? null,
    });

    return {
      action,
      error: runResult.error,
      execution: runResult.execution ?? null,
      inspection,
      ok: Boolean(runResult.ok),
      pid: runResult.pid ?? null,
      selectedActionIndex: selection?.index ?? null,
      selectionReason: selection?.reason ?? null,
      verification: runResult.verification ?? null,
    };
  };
}

module.exports = { createProjectActionRunner };
