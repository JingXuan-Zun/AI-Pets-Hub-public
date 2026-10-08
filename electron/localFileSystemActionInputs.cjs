const path = require('path');
const { normalizeInputName, normalizeFileManagementAction, isSafeFileName, isPathInside, getFileManagementSourcePath } = require('./localFileSystemInputUtils.cjs');
const { getSafeStat, getFileManagementDestinationPath } = require('./localFileSystemDestinationUtils.cjs');
const { validateNoOverwrite, createFileManagementError } = require('./localFileSystemActionResults.cjs');

function readFileManagementRequest(request) {
  const rawAction = normalizeInputName(request.action || request.fileAction || request.operation);

  const normalizedAction = normalizeFileManagementAction(rawAction);

  const action = normalizedAction === 'preview'
    ? normalizeFileManagementAction(request.intendedAction || request.previewAction || request.targetAction || request.operationType)
    : normalizedAction;

  const dryRun = Boolean(
    normalizedAction === 'preview'
      || request.dryRun
      || request.previewOnly
      || request.mode === 'preview',
  );

  return { action, dryRun };
}

function resolveFileManagementSource(request, action) {
  const source = getFileManagementSourcePath(request);

  if (!source.ok) {
    return createFileManagementError(action, source.error, {
      sourcePath: source.path,
    });
  }

  const sourceStat = getSafeStat(source.path);

  if (!sourceStat) {
    return createFileManagementError(action, 'Source path does not exist.', {
      sourcePath: source.path,
    });
  }

  return { ok: true, source, sourceStat };
}

function resolveRenameDestination(request, source) {
  const newName = normalizeInputName(request.newName || request.name || request.fileName || request.folderName);

  if (!newName || !isSafeFileName(newName)) {
    return {
      error: 'Rename needs a safe newName.',
      ok: false,
      path: newName,
    };
  }

  return {
    ok: true,
    path: path.join(path.dirname(source.path), newName),
  };
}

function resolveTransferDestination(request, action, source) {
  return action === 'rename_path' ? resolveRenameDestination(request, source) : getFileManagementDestinationPath(request, source.path);
}

function validateTransferDestination(request, action, source, destination, sourceStat) {
  if (!destination.ok) {
    return createFileManagementError(action, destination.error, {
      sourcePath: source.path,
      destinationPath: destination.path,
    });
  }

  if (path.resolve(source.path) === path.resolve(destination.path)) {
    return createFileManagementError(action, 'Source and destination are the same path.', {
      sourcePath: source.path,
      destinationPath: destination.path,
    });
  }

  const overwriteCheck = validateNoOverwrite(request, destination.path);

  if (!overwriteCheck.ok) {
    return createFileManagementError(action, overwriteCheck.error, {
      sourcePath: source.path,
      destinationPath: destination.path,
    });
  }

  if (sourceStat.isDirectory() && isPathInside(destination.path, source.path)) {
    return createFileManagementError(action, 'Cannot place a directory inside itself.', {
      sourcePath: source.path,
      destinationPath: destination.path,
    });
  }

  const destinationParent = path.dirname(destination.path);

  const destinationParentStat = getSafeStat(destinationParent);

  if (!destinationParentStat?.isDirectory()) {
    return createFileManagementError(action, 'Destination parent directory must exist.', {
      sourcePath: source.path,
      destinationPath: destination.path,
    });
  }

  return { ok: true };
}

module.exports = { readFileManagementRequest, resolveFileManagementSource, resolveTransferDestination, validateTransferDestination };
