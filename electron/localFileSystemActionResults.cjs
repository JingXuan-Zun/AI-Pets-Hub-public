const { getPathKind } = require('./localFileSystemInputUtils.cjs');
const { getSafeStat } = require('./localFileSystemDestinationUtils.cjs');

const FILE_MANAGEMENT_ACTION_LABELS = {
  copy_path: 'copy',
  create_directory: 'create-directory',
  move_path: 'move',
  organize_desktop_files: 'organize-desktop-files',
  preview: 'preview',
  rename_path: 'rename',
  trash_path: 'trash',
};

function createFileManagementPreview(action, options = {}) {
  const sourceStat = options.sourcePath ? getSafeStat(options.sourcePath) : null;
  const destinationStat = options.destinationPath ? getSafeStat(options.destinationPath) : null;
  return {
    action,
    actionLabel: FILE_MANAGEMENT_ACTION_LABELS[action] ?? action,
    destinationExists: Boolean(destinationStat),
    destinationKind: getPathKind(destinationStat),
    destinationPath: options.destinationPath || '',
    dryRun: true,
    itemKind: getPathKind(sourceStat),
    ok: true,
    sourceExists: Boolean(sourceStat),
    sourcePath: options.sourcePath || '',
    willOverwrite: false,
  };
}

function validateNoOverwrite(request = {}, destinationPath = '') {
  if (request.overwrite || request.allowOverwrite || request.conflictPolicy === 'overwrite') {
    return {
      error: 'Overwriting existing files is not supported by this Agent file tool.',
      ok: false,
      path: destinationPath,
    };
  }

  if (destinationPath && getSafeStat(destinationPath)) {
    return {
      error: 'Destination already exists. Choose another name or destination.',
      ok: false,
      path: destinationPath,
    };
  }

  return {
    ok: true,
  };
}

function createFileManagementError(action, error, extras = {}) {
  return {
    action,
    actionLabel: FILE_MANAGEMENT_ACTION_LABELS[action] ?? action,
    error,
    ok: false,
    ...extras,
  };
}

function createFileManagementSuccess(action, extras = {}) {
  return {
    action,
    actionLabel: FILE_MANAGEMENT_ACTION_LABELS[action] ?? action,
    ok: true,
    verified: true,
    ...extras,
  };
}

module.exports = {
  FILE_MANAGEMENT_ACTION_LABELS,
  createFileManagementPreview,
  validateNoOverwrite,
  createFileManagementError,
  createFileManagementSuccess,
};
