const path = require('path');
const { createEmptyIndex } = require('./expressionLibraryIndex.cjs');

function sameLibrary(left, right) {
  return left?.mode === right?.mode && path.resolve(String(left?.rootPath ?? '')) === path.resolve(String(right?.rootPath ?? ''));
}

function restoreLibraryIndex(index, nextMode, nextRootPath) {
  const archivedCurrent = {
    assets: index.assets,
    categories: index.categories,
    library: index.library,
    managedDefaultsInitialized: index.managedDefaultsInitialized,
    batchHistory: index.batchHistory || [],
  };
  const snapshots = index.librarySnapshots.filter((snapshot) => !sameLibrary(snapshot.library, index.library));
  snapshots.push(archivedCurrent);
  const restored = snapshots.find((snapshot) => sameLibrary(snapshot.library, { mode: nextMode, rootPath: nextRootPath }));
  const remainingSnapshots = snapshots.filter((snapshot) => !sameLibrary(snapshot.library, { mode: nextMode, rootPath: nextRootPath }));
  return restored
    ? { ...index, ...restored, librarySnapshots: remainingSnapshots }
    : { ...createEmptyIndex(nextRootPath, nextMode), librarySnapshots: remainingSnapshots };
}

module.exports = { sameLibrary, restoreLibraryIndex };
