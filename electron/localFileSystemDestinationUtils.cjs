const fs = require('fs');
const path = require('path');
const {
  normalizeInputPath,
  normalizeInputName,
  normalizeAbsolutePath,
  isSafeFileName,
} = require('./localFileSystemInputUtils.cjs');

function getSafeStat(targetPath) {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
}

function readDestinationInput(request) {
  const rawDestinationPath = normalizeInputPath(
    request.destinationPath
      || request.targetPath
      || request.newPath
      || request.destination
      || request.dest
      || request.to,
  );
  const rawDestinationDirectory = normalizeInputPath(
    request.destinationDirectory
      || request.targetDirectory
      || request.folderPath
      || request.directoryPath,
  );
  const newName = normalizeInputName(request.newName || request.name || request.fileName || request.folderName);
  return { rawDestinationPath, rawDestinationDirectory, newName };
}

function resolveDestinationDirectory(rawDestinationDirectory, newName, sourcePath) {
  const resolvedDirectory = normalizeAbsolutePath(rawDestinationDirectory);
  if (!resolvedDirectory.ok) {
    return resolvedDirectory;
  }

  const directoryStat = getSafeStat(resolvedDirectory.path);
  if (!directoryStat?.isDirectory()) {
    return {
      error: 'Destination directory must be an existing folder.',
      ok: false,
      path: resolvedDirectory.path,
    };
  }

  return {
    ok: true,
    path: path.join(resolvedDirectory.path, newName || path.basename(sourcePath)),
  };
}

function resolveDestinationPath(rawDestinationPath, newName, sourcePath) {
  const resolvedDestination = normalizeAbsolutePath(rawDestinationPath);
  if (!resolvedDestination.ok) {
    return resolvedDestination;
  }

  const destinationStat = getSafeStat(resolvedDestination.path);
  if (destinationStat?.isDirectory()) {
    return {
      ok: true,
      path: path.join(resolvedDestination.path, newName || path.basename(sourcePath)),
    };
  }

  if (newName) {
    return {
      error: 'Use destinationDirectory with newName, or provide a full destinationPath without newName.',
      ok: false,
      path: resolvedDestination.path,
    };
  }

  return resolvedDestination;
}

function getFileManagementDestinationPath(request = {}, sourcePath = '') {
  const { rawDestinationPath, rawDestinationDirectory, newName } = readDestinationInput(request);
  if (newName && !isSafeFileName(newName)) {
    return {
      error: 'New name must be a single file or folder name.',
      ok: false,
      path: newName,
    };
  }
  if (rawDestinationDirectory) {
    return resolveDestinationDirectory(rawDestinationDirectory, newName, sourcePath);
  }
  if (rawDestinationPath) {
    return resolveDestinationPath(rawDestinationPath, newName, sourcePath);
  }
  return {
    error: 'Missing destination path.',
    ok: false,
    path: '',
  };
}

function getCreateDirectoryPath(request = {}) {
  const rawTargetPath = normalizeInputPath(
    request.destinationPath
      || request.targetPath
      || request.path
      || request.query
      || request.to,
  );
  const rawDestinationDirectory = normalizeInputPath(
    request.destinationDirectory
      || request.targetDirectory
      || request.folderPath
      || request.parentPath,
  );
  const newName = normalizeInputName(request.newName || request.name || request.folderName);

  if (rawDestinationDirectory || newName) {
    if (!newName || !isSafeFileName(newName)) {
      return {
        error: 'New folder name must be a single folder name.',
        ok: false,
        path: newName,
      };
    }

    const resolvedDirectory = normalizeAbsolutePath(rawDestinationDirectory);
    if (!resolvedDirectory.ok) {
      return resolvedDirectory;
    }

    const directoryStat = getSafeStat(resolvedDirectory.path);
    if (!directoryStat?.isDirectory()) {
      return {
        error: 'Parent directory must be an existing folder.',
        ok: false,
        path: resolvedDirectory.path,
      };
    }

    return {
      ok: true,
      path: path.join(resolvedDirectory.path, newName),
    };
  }

  return normalizeAbsolutePath(rawTargetPath);
}

module.exports = { getSafeStat, getFileManagementDestinationPath, getCreateDirectoryPath };
