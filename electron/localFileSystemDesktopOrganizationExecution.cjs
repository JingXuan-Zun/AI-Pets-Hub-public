const fs = require('fs');
const { getSafeStat } = require('./localFileSystemDestinationUtils.cjs');
const { FILE_MANAGEMENT_ACTION_LABELS } = require('./localFileSystemActionResults.cjs');

function createDesktopFileOrganizationResult(plan, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const changedPaths = options.changedPaths || [];
  const createdDirectories = options.createdDirectories || [];
  const movedItemCount = options.movedItemCount ?? 0;
  const conflictCount = plan.conflicts.length;
  const responsePrefix = dryRun ? 'Desktop file organization preview ready' : 'Desktop file organization completed';

  return {
    action: 'organize_desktop_files',
    actionLabel: FILE_MANAGEMENT_ACTION_LABELS.organize_desktop_files,
    changedPaths,
    conflicts: plan.conflicts.slice(0, 20),
    conflictCount,
    createdDirectories,
    desktopPath: plan.desktopPath,
    destinationPath: plan.destinationRoot,
    dryRun,
    error: options.error || '',
    groupBy: plan.groupBy,
    groups: plan.groups,
    movedItemCount,
    ok: options.ok,
    plannedItemCount: plan.items.length,
    planItems: plan.items.slice(0, 80),
    skipped: plan.skipped.slice(0, 30),
    skippedItemCount: plan.skipped.length,
    sourcePath: plan.desktopPath,
    truncated: plan.truncated,
    verified: options.verified,
    willOverwrite: conflictCount > 0,
    responseText: `${responsePrefix}: ${plan.items.length} item(s), ${plan.groups.length} group(s), ${conflictCount} conflict(s).`,
  };
}

function createOrganizationDirectories(plan, createdDirectories) {
  if (!getSafeStat(plan.destinationRoot)) {
    fs.mkdirSync(plan.destinationRoot, { recursive: true });
    createdDirectories.push(plan.destinationRoot);
  }
  for (const group of plan.groups) {
    if (!getSafeStat(group.destinationDirectory)) {
      fs.mkdirSync(group.destinationDirectory, { recursive: true });
      createdDirectories.push(group.destinationDirectory);
    }
  }
}

function moveOrganizationItems(plan, state) {
  for (const item of plan.items) {
    fs.renameSync(item.sourcePath, item.destinationPath);
    state.changedPaths.push(item.sourcePath, item.destinationPath);
    state.movedItemCount += 1;
  }
}

function verifyOrganizationItems(plan) {
  return plan.items.every((item) => (
    !getSafeStat(item.sourcePath) && Boolean(getSafeStat(item.destinationPath))
  ));
}

function executeDesktopFileOrganizationPlan(plan) {
  if (plan.conflicts.length) {
    return createDesktopFileOrganizationResult(plan, {
      dryRun: false,
      error: 'Destination conflicts exist; no files were moved.',
      ok: false,
      verified: false,
    });
  }
  const state = { changedPaths: [], createdDirectories: [], movedItemCount: 0 };
  try {
    createOrganizationDirectories(plan, state.createdDirectories);
    moveOrganizationItems(plan, state);
    const verified = verifyOrganizationItems(plan);
    return createDesktopFileOrganizationResult(plan, {
      changedPaths: state.changedPaths,
      createdDirectories: state.createdDirectories,
      dryRun: false,
      movedItemCount: state.movedItemCount,
      ok: verified,
      verified,
    });
  } catch (error) {
    return createDesktopFileOrganizationResult(plan, {
      changedPaths: state.changedPaths,
      createdDirectories: state.createdDirectories,
      dryRun: false,
      error: error instanceof Error ? error.message : String(error),
      movedItemCount: state.movedItemCount,
      ok: false,
      verified: false,
    });
  }
}

module.exports = { createDesktopFileOrganizationResult, executeDesktopFileOrganizationPlan };
