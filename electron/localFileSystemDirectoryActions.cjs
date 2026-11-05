const fs = require('fs');
const path = require('path');
const { getSafeStat, getCreateDirectoryPath } = require('./localFileSystemDestinationUtils.cjs');
const { createFileManagementPreview, validateNoOverwrite, createFileManagementError, createFileManagementSuccess } = require('./localFileSystemActionResults.cjs');
const { createDesktopFileOrganizationPlan } = require('./localFileSystemDesktopOrganizationPlan.cjs');
const { createDesktopFileOrganizationResult, executeDesktopFileOrganizationPlan } = require('./localFileSystemDesktopOrganizationExecution.cjs');

function executeDesktopOrganizationAction(request, dryRun, action) {
  try {
    const plan = createDesktopFileOrganizationPlan(request);
    if (!plan.ok) {
      return createFileManagementError(action, plan.error, {
        destinationPath: plan.path || '',
        sourcePath: plan.path || '',
      });
    }

    if (dryRun) {
      return createDesktopFileOrganizationResult(plan, {
        dryRun: true,
        error: plan.conflicts.length ? 'Destination conflicts exist; execution will be blocked until conflicts are resolved.' : '',
        ok: plan.conflicts.length === 0,
        verified: false,
      });
    }

    return executeDesktopFileOrganizationPlan(plan);
  } catch (error) {
    return createFileManagementError(action, error instanceof Error ? error.message : String(error));
  }
}

const WRITE_TEXT_MAX_CHARS = 1_000_000;

/**
 * Writes a text file (UTF-8, no BOM): mode "create" (default) only makes a new file and
 * refuses when one is there, "overwrite" replaces it, "append" adds to the end. She used to
 * do this with a PowerShell command, so the card showed a raw command line (benchmark 2026-11-05).
 */
function executeWriteTextFileAction(request, dryRun, action) {
  const target = getCreateDirectoryPath(request);
  if (!target.ok) {
    return createFileManagementError(action, target.error, { destinationPath: target.path });
  }
  const text = typeof request.text === 'string' ? request.text : typeof request.content === 'string' ? request.content : null;
  if (text === null) {
    return createFileManagementError(action, 'Text to write is missing.', { destinationPath: target.path });
  }
  if (text.length > WRITE_TEXT_MAX_CHARS) {
    return createFileManagementError(action, 'Text is too long to write in one go.', { destinationPath: target.path });
  }
  const mode = request.writeMode === 'overwrite' || request.writeMode === 'append' ? request.writeMode : 'create';
  if (!getSafeStat(path.dirname(target.path))?.isDirectory()) {
    return createFileManagementError(action, 'Parent directory must exist.', { destinationPath: target.path });
  }
  const existing = getSafeStat(target.path);
  if (existing?.isDirectory()) {
    return createFileManagementError(action, 'That path is a folder, not a file.', { destinationPath: target.path });
  }
  if (existing && mode === 'create') {
    return createFileManagementError(action, 'File already exists. Use append to add to it, or overwrite to replace it.', { destinationPath: target.path, reason: 'exists' });
  }
  if (dryRun) {
    return { ...createFileManagementPreview(action, { destinationPath: target.path }), willOverwrite: Boolean(existing) && mode === 'overwrite', writeMode: mode };
  }
  try {
    if (mode === 'append') fs.appendFileSync(target.path, text, 'utf8');
    else fs.writeFileSync(target.path, text, { encoding: 'utf8', flag: mode === 'create' ? 'wx' : 'w' });
    return createFileManagementSuccess(action, { changedPaths: [target.path], destinationPath: target.path, dryRun: false });
  } catch (error) {
    return createFileManagementError(action, error instanceof Error ? error.message : String(error), { destinationPath: target.path });
  }
}

function executeCreateDirectoryAction(request, dryRun, action) {
  const target = getCreateDirectoryPath(request);
  if (!target.ok) {
    return createFileManagementError(action, target.error, {
      destinationPath: target.path,
    });
  }

  const overwriteCheck = validateNoOverwrite(request, target.path);
  if (!overwriteCheck.ok) {
    return createFileManagementError(action, overwriteCheck.error, {
      destinationPath: target.path,
    });
  }

  const parentPath = path.dirname(target.path);
  const parentStat = getSafeStat(parentPath);
  if (!parentStat?.isDirectory()) {
    return createFileManagementError(action, 'Parent directory must exist.', {
      destinationPath: target.path,
    });
  }

  if (dryRun) {
    return createFileManagementPreview(action, {
      destinationPath: target.path,
    });
  }

  try {
    fs.mkdirSync(target.path, { recursive: false });
    return createFileManagementSuccess(action, {
      changedPaths: [target.path],
      destinationPath: target.path,
      dryRun: false,
    });
  } catch (error) {
    return createFileManagementError(action, error instanceof Error ? error.message : String(error), {
      destinationPath: target.path,
    });
  }
}

module.exports = { executeDesktopOrganizationAction, executeCreateDirectoryAction, executeWriteTextFileAction };
