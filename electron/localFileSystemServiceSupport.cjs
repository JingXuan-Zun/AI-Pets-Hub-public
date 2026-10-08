const { getFileManagementSourcePath } = require('./localFileSystemInputUtils.cjs');
const { getFileManagementDestinationPath, getCreateDirectoryPath } = require('./localFileSystemDestinationUtils.cjs');
const { readFileManagementRequest, resolveTransferDestination } = require('./localFileSystemActionInputs.cjs');

function createFileSystemServiceSupport({ log, sensitivePathPolicy }) {
  function findSensitivePath(candidates) {
    return candidates.find((candidate) => candidate?.ok && sensitivePathPolicy.isSensitivePath(candidate.path)) ?? null;
  }

  function getFileManagementCandidatePaths(request) {
    const source = getFileManagementSourcePath(request);
    const candidates = [
      source,
      getFileManagementDestinationPath(request, source.ok ? source.path : ''),
      getCreateDirectoryPath(request),
    ];
    const { action } = readFileManagementRequest(request);
    if (source.ok && action === 'rename_path') {
      candidates.push(resolveTransferDestination(request, action, source));
    }
    return candidates;
  }

  function logResult(action, result) {
    if (typeof log !== 'function') {
      return;
    }

    log(action, {
      ok: Boolean(result?.ok),
      path: result?.path ? 'configured' : '',
      count: Array.isArray(result?.entries)
        ? result.entries.length
        : Array.isArray(result?.matches)
          ? result.matches.length
          : undefined,
      textLength: typeof result?.text === 'string' ? result.text.length : undefined,
    });
  }

  return { findSensitivePath, getFileManagementCandidatePaths, logResult };
}

module.exports = { createFileSystemServiceSupport };
