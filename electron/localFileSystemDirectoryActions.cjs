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

module.exports = { executeDesktopOrganizationAction, executeCreateDirectoryAction };
