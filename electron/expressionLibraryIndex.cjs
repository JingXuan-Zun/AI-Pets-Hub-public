const crypto = require('crypto');
const path = require('path');
const { normalizeRelativePath } = require('./expressionLibraryFiles.cjs');
const INDEX_VERSION = 5;
const UNCLASSIFIED_ID = 'cat_unclassified';

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function createCategory(folderRelativePath, name) {
  return {
    available: true,
    description: '',
    folderRelativePath: normalizeRelativePath(folderRelativePath),
    id: createId('cat'),
    name,
    reviewRequired: true,
    semanticVersion: 1,
  };
}

function createDefaultManagedCategories() {
  return [
    { ...createCategory('开心', '开心'), description: '开心、愉快、庆祝或友好回应。', reviewRequired: false },
    { ...createCategory('伤心', '伤心'), description: '伤心、失落、难过或需要安慰。', reviewRequired: false },
  ];
}

function createEmptyIndex(managedRootPath, mode = 'managed') {
  return {
    assets: [],
    categories: [
      { ...createCategory('', '未分类'), id: UNCLASSIFIED_ID },
      ...(mode === 'managed' ? createDefaultManagedCategories() : []),
    ],
    library: { mode, rootPath: managedRootPath },
    librarySnapshots: [],
    managedDefaultsInitialized: mode !== 'managed',
    updatedAt: nowIso(),
    version: INDEX_VERSION,
  };
}

function normalizeIndex(rawIndex, managedRootPath) {
  const fallback = createEmptyIndex(managedRootPath);
  if (!rawIndex || typeof rawIndex !== 'object') return fallback;
  const mode = rawIndex.library?.mode === 'external' ? 'external' : 'managed';
  const storedRootPath = typeof rawIndex.library?.rootPath === 'string' && rawIndex.library.rootPath.trim()
    ? path.resolve(rawIndex.library.rootPath)
    : managedRootPath;
  const rootPath = mode === 'managed' ? managedRootPath : storedRootPath;
  const categories = Array.isArray(rawIndex.categories) ? rawIndex.categories : fallback.categories;
  const needsManagedDefaults = mode === 'managed' && Number(rawIndex.version ?? 0) < INDEX_VERSION;
  const migratedCategories = needsManagedDefaults
    ? [...categories, ...createDefaultManagedCategories().filter((item) => !categories.some((category) => category.name === item.name))]
    : categories;
  const snapshots = Array.isArray(rawIndex.librarySnapshots) ? rawIndex.librarySnapshots : [];
  const migratedSnapshots = snapshots.map((snapshot) => {
    if (snapshot.library?.mode !== 'managed') return snapshot;
    const snapshotCategories = Array.isArray(snapshot.categories) ? snapshot.categories : [];
    return {
      ...snapshot,
      categories: Number(rawIndex.version ?? 0) < INDEX_VERSION
        ? [...snapshotCategories, ...createDefaultManagedCategories().filter((item) => !snapshotCategories.some((category) => category.name === item.name))]
        : snapshotCategories,
      library: { mode: 'managed', rootPath: managedRootPath },
      managedDefaultsInitialized: Number(rawIndex.version ?? 0) < INDEX_VERSION
        ? false
        : Boolean(snapshot.managedDefaultsInitialized),
    };
  });
  return {
    ...fallback,
    ...rawIndex,
    assets: Array.isArray(rawIndex.assets) ? rawIndex.assets : [],
    categories: migratedCategories,
    library: { mode, rootPath },
    librarySnapshots: migratedSnapshots,
    managedDefaultsInitialized: needsManagedDefaults ? false : Boolean(rawIndex.managedDefaultsInitialized),
    version: INDEX_VERSION,
  };
}

function publicState(index) {
  const {
    batchHistory: _batchHistory,
    librarySnapshots: _librarySnapshots,
    managedDefaultsInitialized: _managedDefaultsInitialized,
    ...activeIndex
  } = index;
  return {
    ...activeIndex,
    assets: index.assets.filter((asset) => !asset.removedFromLibrary).map(({ absolutePath: _absolutePath, ...asset }) => asset),
  };
}

module.exports = { INDEX_VERSION, UNCLASSIFIED_ID, createId, nowIso, createCategory, createEmptyIndex, normalizeIndex, publicState };
