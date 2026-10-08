const { createFileSystemServiceSupport } = require('./localFileSystemServiceSupport.cjs');
const { SENSITIVE_PATH_ERROR, createSensitivePathPolicy } = require('./sensitivePathPolicy.cjs');
const { readFileManagementRequest, resolveFileManagementSource, resolveTransferDestination, validateTransferDestination } = require('./localFileSystemActionInputs.cjs');
const { executeTrashAction, executeTransferAction } = require('./localFileSystemTransferActions.cjs');
const { readTextFile, readFileDataUrl } = require('./localFileSystemContentReader.cjs');
const { searchFiles } = require('./localFileSystemSearch.cjs');
const { createPathInfo, listDirectory } = require('./localFileSystemDirectoryReader.cjs');
const {
  normalizeInputName,
  normalizeAbsolutePath,
} = require('./localFileSystemInputUtils.cjs');
const {
  createFileManagementPreview,
  createFileManagementError,
} = require('./localFileSystemActionResults.cjs');
const { executeDesktopOrganizationAction, executeCreateDirectoryAction } = require('./localFileSystemDirectoryActions.cjs');

async function executeFileManagementAction(request = {}, options = {}) {
  const { action, dryRun } = readFileManagementRequest(request);
  if (!action || action === 'preview') {
    return createFileManagementError('preview', 'Missing supported file management action.');
  }
  if (action === 'organize_desktop_files') {
    return executeDesktopOrganizationAction(request, dryRun, action);
  }
  if (action === 'create_directory') {
    return executeCreateDirectoryAction(request, dryRun, action);
  }
  const resolvedSource = resolveFileManagementSource(request, action);
  if (!resolvedSource.ok) {
    return resolvedSource;
  }
  const { source, sourceStat } = resolvedSource;
  if (action === 'trash_path') {
    return executeTrashAction(action, source, dryRun, options);
  }
  const destination = resolveTransferDestination(request, action, source);
  const validation = validateTransferDestination(request, action, source, destination, sourceStat);
  if (!validation.ok) {
    return validation;
  }
  if (dryRun) {
    return createFileManagementPreview(action, {
      destinationPath: destination.path,
      sourcePath: source.path,
    });
  }
  return executeTransferAction(action, source, destination, sourceStat);
}

function createLocalFileSystemService({ log, protectedRoots = [] } = {}) {
  const sensitivePathPolicy = createSensitivePathPolicy({ extraRoots: protectedRoots });
  const { findSensitivePath, getFileManagementCandidatePaths, logResult } =
    createFileSystemServiceSupport({ log, sensitivePathPolicy });

  return {
    getPathInfo(request = {}) {
      const result = createPathInfo(request);
      logResult('get-path-info', result);
      return result;
    },
    listDirectory(request = {}) {
      const result = listDirectory(request);
      logResult('list-directory', result);
      return result;
    },
    readTextFile(request = {}) {
      const blocked = findSensitivePath([normalizeAbsolutePath(request.path || request.filePath || request.query)]);
      const result = blocked
        ? { error: SENSITIVE_PATH_ERROR, ok: false, path: blocked.path, reason: 'sensitive-path' }
        : readTextFile(request);
      logResult('read-text-file', result);
      return result;
    },
    readFileDataUrl(request = {}) {
      const blocked = findSensitivePath([normalizeAbsolutePath(request.path || request.filePath || request.query)]);
      const result = blocked
        ? { error: SENSITIVE_PATH_ERROR, ok: false, path: blocked.path, reason: 'sensitive-path' }
        : readFileDataUrl(request);
      logResult('read-file-data-url', result);
      return result;
    },
    searchFiles(request = {}) {
      const result = searchFiles(request);
      logResult('search-files', result);
      return result;
    },
    async executeFileManagementAction(request = {}, options = {}) {
      const blocked = findSensitivePath(getFileManagementCandidatePaths(request));
      const result = blocked
        ? createFileManagementError(normalizeInputName(request.action || request.fileAction || request.operation) || 'unknown', SENSITIVE_PATH_ERROR, {
          reason: 'sensitive-path',
          sourcePath: blocked.path,
        })
        : await executeFileManagementAction(request, options);
      logResult('execute-file-management-action', result);
      return result;
    },
  };
}

module.exports = {
  createLocalFileSystemService,
};
