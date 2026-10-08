const path = require('path');
const { sameLibrary, restoreLibraryIndex } = require('./expressionLibrarySnapshots.cjs');

function createExpressionLibrarySwitchActions({ loadIndex, saveIndex, scanIndex, managedRootPath, ensureLibraryRoot, getStateFromIndex }) {
  async function setLibrary({ mode, rootPath }) {
      const index = await loadIndex();
      const nextMode = mode === 'external' ? 'external' : 'managed';
      const externalRoot = String(rootPath ?? '').trim();
      if (nextMode === 'external' && !externalRoot) throw new Error('请选择外部表情包根目录。');
      const nextRootPath = nextMode === 'managed' ? managedRootPath : path.resolve(externalRoot);
      await ensureLibraryRoot({ mode: nextMode, rootPath: nextRootPath });
      if (sameLibrary(index.library, { mode: nextMode, rootPath: nextRootPath })) {
        return getStateFromIndex(await saveIndex(await scanIndex(index)));
      }
      const nextIndex = restoreLibraryIndex(index, nextMode, nextRootPath);
      return getStateFromIndex(await saveIndex(await scanIndex(nextIndex)));
    }

  async function selectLibraryMode(request) {
      const mode = request?.mode === 'external' ? 'external' : 'managed';
      if (mode === 'managed') {
        return { ...(await setLibrary({ mode: 'managed' })), modeAvailable: true };
      }
      const index = await loadIndex();
      if (index.library.mode === 'external') {
        return { ...getStateFromIndex(await saveIndex(await scanIndex(index))), modeAvailable: true };
      }
      const externalSnapshot = [...index.librarySnapshots].reverse()
        .find((snapshot) => snapshot.library?.mode === 'external');
      if (!externalSnapshot?.library?.rootPath) {
        return { ...getStateFromIndex(index), modeAvailable: false };
      }
      try {
        await ensureLibraryRoot(externalSnapshot.library);
      } catch {
        return { ...getStateFromIndex(index), modeAvailable: false };
      }
      return {
        ...(await setLibrary({ mode: 'external', rootPath: externalSnapshot.library.rootPath })),
        modeAvailable: true,
      };
    }

  return { setLibrary, selectLibraryMode };
}

module.exports = { createExpressionLibrarySwitchActions };
