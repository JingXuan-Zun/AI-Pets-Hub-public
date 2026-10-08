const fs = require('fs');
const { getPathKind } = require('./localFileSystemInputUtils.cjs');
const { getSafeStat } = require('./localFileSystemDestinationUtils.cjs');
const { createFileManagementPreview, createFileManagementError, createFileManagementSuccess } = require('./localFileSystemActionResults.cjs');

async function executeTrashAction(action, source, dryRun, options) {
  if (dryRun) {
    return createFileManagementPreview(action, {
      sourcePath: source.path,
    });
  }

  try {
    if (options.shell && typeof options.shell.trashItem === 'function') {
      await options.shell.trashItem(source.path);
    } else if (options.shell && typeof options.shell.moveItemToTrash === 'function') {
      const moved = options.shell.moveItemToTrash(source.path);
      if (!moved) {
        throw new Error('Electron shell did not accept the recycle request.');
      }
    } else {
      throw new Error('Electron shell trash API is unavailable.');
    }

    return createFileManagementSuccess(action, {
      changedPaths: [source.path],
      dryRun: false,
      sourcePath: source.path,
      verified: !getSafeStat(source.path),
    });
  } catch (error) {
    return createFileManagementError(action, error instanceof Error ? error.message : String(error), {
      sourcePath: source.path,
    });
  }
}

function moveFileManagementPath(action, source, destination, sourceStat) {
  fs.renameSync(source.path, destination.path);
  return createFileManagementSuccess(action, {
    changedPaths: [source.path, destination.path],
    destinationPath: destination.path,
    dryRun: false,
    itemKind: getPathKind(sourceStat),
    sourcePath: source.path,
    verified: Boolean(getSafeStat(destination.path)) && !getSafeStat(source.path),
  });
}

function copyFileManagementPath(action, source, destination, sourceStat) {
  if (sourceStat.isDirectory()) {
    fs.cpSync(source.path, destination.path, {
      errorOnExist: true,
      force: false,
      recursive: true,
    });
  } else {
    fs.copyFileSync(source.path, destination.path, fs.constants.COPYFILE_EXCL);
  }

  return createFileManagementSuccess(action, {
    changedPaths: [destination.path],
    destinationPath: destination.path,
    dryRun: false,
    itemKind: getPathKind(sourceStat),
    sourcePath: source.path,
    verified: Boolean(getSafeStat(source.path)) && Boolean(getSafeStat(destination.path)),
  });
}

function executeTransferAction(action, source, destination, sourceStat) {
  try {
    if (action === 'move_path' || action === 'rename_path') {
      return moveFileManagementPath(action, source, destination, sourceStat);
    }

    if (action === 'copy_path') {
      return copyFileManagementPath(action, source, destination, sourceStat);
    }

    return createFileManagementError(action, 'Unsupported file management action.', {
      sourcePath: source.path,
      destinationPath: destination.path,
    });
  } catch (error) {
    return createFileManagementError(action, error instanceof Error ? error.message : String(error), {
      destinationPath: destination.path,
      sourcePath: source.path,
    });
  }
}

module.exports = { executeTrashAction, executeTransferAction };
