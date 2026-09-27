const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  ensureDirectory,
  mimeTypeForFileName,
  normalizeRelativePath,
  readJsonFile,
  resolveAvailableFileName,
  resolveWithinRoot,
  resolveSafeLibraryPath,
  sanitizeFolderName,
  scanLibraryRoot,
  validateSourceImage,
  writeJsonAtomic,
} = require('./expressionLibraryFiles.cjs');
const { executeBatch, undoBatch } = require('./expressionLibraryAssetMutations.cjs');
const { importClassifiedLibrary } = require('./expressionLibraryImport.cjs');

const INDEX_VERSION = 5;
const UNCLASSIFIED_ID = 'cat_unclassified';
const CUSTOM_IMPORT_FOLDER_NAME = '自定义分类';
const LEGACY_ANGRY_DESCRIPTION = '生气、不满、恼火或强烈反对。';

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

function createExpressionLibraryService({ managedRootPath: configuredManagedRootPath, userDataPath }) {
  const legacyManagedRootPath = path.join(userDataPath, 'stickers');
  const managedRootPath = path.resolve(configuredManagedRootPath || legacyManagedRootPath);
  const indexPath = path.join(userDataPath, 'expression-library.json');

  async function loadIndex() {
    const rawIndex = await readJsonFile(indexPath, null);
    if (shouldMigrateLegacyManagedRoot(rawIndex, legacyManagedRootPath, managedRootPath)) {
      await copyMissingDirectoryContents(legacyManagedRootPath, managedRootPath);
    }
    const index = normalizeIndex(rawIndex, managedRootPath);
    for (const library of [index, ...index.librarySnapshots]) {
      library.categories = library.categories.map((category) => ({ ...category, nameIssue: categoryNameIssue(category) }));
    }
    if (Number(rawIndex?.version ?? 0) < INDEX_VERSION) {
      await removeEmptyLegacyAngryDefaults(index, managedRootPath);
    }
    return index;
  }

  async function saveIndex(index) {
    const nextIndex = { ...index, updatedAt: nowIso(), version: INDEX_VERSION };
    await writeJsonAtomic(indexPath, nextIndex);
    return nextIndex;
  }

  async function scanIndex(index) {
    const { rootPath } = index.library;
    await ensureLibraryRoot(index.library);
    if (index.library.mode === 'managed') {
      for (const category of index.categories.filter((item) => item.id !== UNCLASSIFIED_ID && !item.nameIssue)) {
        await ensureDirectory(await resolveSafeLibraryPath(rootPath, category.folderRelativePath, { allowMissing: true }));
      }
      index.managedDefaultsInitialized = true;
    }
    const scanned = await scanLibraryRoot(rootPath, {
      nestedCategoryContainerName: index.library.mode === 'managed' ? CUSTOM_IMPORT_FOLDER_NAME : '',
    });
    const categoriesByFolder = new Map(index.categories.map((category) => [category.folderRelativePath, category]));
    const categories = [{ ...(categoriesByFolder.get('') ?? createCategory('', '未分类')), id: UNCLASSIFIED_ID, available: true }];
    for (const folderName of scanned.folders) {
      const folderRelativePath = normalizeRelativePath(folderName);
      const categoryDisplayName = path.basename(folderRelativePath);
      categories.push({
        ...(categoriesByFolder.get(folderRelativePath) ?? createCategory(folderRelativePath, categoryDisplayName)),
        available: true,
      });
    }
    for (const category of index.categories) {
      if (category.id !== UNCLASSIFIED_ID && !categories.some((item) => item.id === category.id)) {
        categories.push({ ...category, available: false });
      }
    }
    const categoriesByPath = new Map(categories.map((category) => [category.folderRelativePath, category]));
    const assetsByPath = new Map(index.assets.map((asset) => [asset.relativePath, asset]));
    const assets = await Promise.all(scanned.images.map(async (image) => {
      const relativePath = normalizeRelativePath(path.join(image.folderRelativePath, image.fileName));
      const previous = assetsByPath.get(relativePath);
      const physicalCategory = categoriesByPath.get(image.folderRelativePath) ?? categories[0];
      const category = index.library.mode === 'external' && previous?.categoryOverrideId
        ? categories.find((item) => item.id === previous.categoryOverrideId) ?? physicalCategory
        : physicalCategory;
      let fileSignature;
      let available = true;
      try {
        const filePath = await resolveSafeLibraryPath(rootPath, relativePath);
        const stats = await fs.promises.stat(filePath);
        fileSignature = `${stats.size}:${stats.mtimeMs}`;
      } catch { available = false; }
      const changed = Boolean(previous?.fileSignature && previous.fileSignature !== fileSignature);
      return {
        ...(previous ?? {
          assignmentSemanticVersion: category.semanticVersion,
          classificationStatus: 'needs-review',
          id: createId('sticker'),
        }),
        ...(changed ? { classificationStatus: previous.removedFromLibrary ? 'excluded' : 'needs-review', reviewedAt: null } : {}),
        available,
        categoryId: category.id,
        fileName: image.fileName,
        mimeType: mimeTypeForFileName(image.fileName),
        relativePath,
        fileSignature,
      };
    }));
    for (const asset of index.assets) {
      if (!assets.some((item) => item.id === asset.id)) assets.push({ ...asset, available: false });
    }
    for (const category of categories) {
      category.nameIssue = categoryNameIssue(category);
      category.reviewRequired = assets.some((asset) => (
        asset.available && !asset.removedFromLibrary && asset.categoryId === category.id && asset.classificationStatus !== 'accepted'
      ));
    }
    return { ...index, assets, categories };
  }

  async function getState({ rescan = false } = {}) {
    let index = await loadIndex();
    if (rescan) index = await saveIndex(await scanIndex(index));
    return { ok: true, state: publicState(index) };
  }

  async function getReplyCatalog() {
    const index = await saveIndex(await scanIndex(await loadIndex()));
    const acceptedAssets = index.assets.filter((asset) => {
      if (!asset.available || asset.removedFromLibrary || asset.categoryId === UNCLASSIFIED_ID || asset.classificationStatus !== 'accepted') return false;
      const category = index.categories.find((item) => item.id === asset.categoryId);
      return Boolean(category?.available && !category.nameIssue && asset.assignmentSemanticVersion === category.semanticVersion);
    });
    return {
      catalog: {
        roots: [{
          categories: index.categories.filter((category) => category.available).map((category) => ({
            description: category.description,
            id: category.id,
            name: category.name,
            semanticVersion: category.semanticVersion,
          })),
          enabledForReply: true,
          id: index.library.mode === 'managed' ? 'root-main' : 'root-external-current',
          name: index.library.mode === 'managed' ? '我的表情包' : '外部目录库',
          replyPriority: 0,
          sourceType: index.library.mode,
          assets: acceptedAssets.map((asset) => ({
            assetId: asset.id,
            categoryId: asset.categoryId,
            mimeType: asset.mimeType,
          })),
        }],
      },
      ok: true,
    };
  }

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
    const nextIndex = restored
      ? { ...index, ...restored, librarySnapshots: remainingSnapshots }
      : { ...createEmptyIndex(nextRootPath, nextMode), librarySnapshots: remainingSnapshots };
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

  function getStateFromIndex(index) {
    return { ok: true, state: publicState(index) };
  }

  async function createCategoryEntry(request) {
    const index = await loadIndex();
    assertManaged(index);
    const name = sanitizeFolderName(request?.name);
    if (name === CUSTOM_IMPORT_FOLDER_NAME || index.categories.some((category) => category.name.toLowerCase() === name.toLowerCase() || category.folderRelativePath.toLowerCase() === name.toLowerCase())) {
      throw new Error('已存在同名分类。');
    }
    await ensureDirectory(resolveWithinRoot(index.library.rootPath, name));
    const category = { ...createCategory(name, name), description: normalizeDescription(request?.description), reviewRequired: false };
    return getStateFromIndex(await saveIndex({ ...index, categories: [...index.categories, category] }));
  }

  async function updateCategory(request) {
    const index = await loadIndex();
    const category = findCategory(index, request?.categoryId);
    if (category.id === UNCLASSIFIED_ID) throw new Error('“未分类”不能重命名。');
    const requestedName = index.library.mode === 'managed' ? sanitizeFolderName(request?.name ?? category.name) : String(request?.name ?? category.name);
    if (index.library.mode === 'external' && requestedName !== category.name) {
      throw new Error('外部目录引用模式不能重命名原文件夹。');
    }
    const name = index.library.mode === 'managed' ? requestedName : category.name;
    const description = normalizeDescription(request?.description ?? category.description);
    const nameChanged = name !== category.name;
    const descriptionChanged = description !== category.description;
    const semanticsChanged = nameChanged || descriptionChanged || Boolean(category.nameIssue);
    if ((nameChanged || category.nameIssue) && index.library.mode === 'managed') {
      if (name === CUSTOM_IMPORT_FOLDER_NAME || index.categories.some((item) => item.id !== category.id && item.name.toLowerCase() === name.toLowerCase())) throw new Error('已存在同名分类，请更换名称。');
      const nextFolderName = sanitizeFolderName(name);
      const currentParent = path.dirname(category.folderRelativePath);
      const nextFolder = normalizeRelativePath(path.join(currentParent === CUSTOM_IMPORT_FOLDER_NAME ? currentParent : '', nextFolderName));
      const destinationPath = await resolveSafeLibraryPath(index.library.rootPath, nextFolder, { allowMissing: true });
      let sourcePath;
      try {
        sourcePath = await resolveSafeLibraryPath(index.library.rootPath, category.folderRelativePath);
      } catch (error) {
        if (error.code !== 'ENOENT') throw new Error('历史分类路径异常，为保护原文件，请先在资源管理器中修复目录，再重新扫描。');
      }
      if (sourcePath && sourcePath !== destinationPath) {
        if (path.relative(sourcePath, destinationPath) !== '') {
          try { await fs.promises.lstat(destinationPath); throw new Error('目标文件夹已存在，不能覆盖。'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
        await fs.promises.rename(sourcePath, destinationPath);
      } else if (!sourcePath) await ensureDirectory(destinationPath);
      category.folderRelativePath = nextFolder;
      for (const asset of index.assets.filter((item) => item.categoryId === category.id)) {
        asset.relativePath = normalizeRelativePath(path.join(nextFolder, asset.fileName));
      }
    }
    if (semanticsChanged) category.semanticVersion += 1;
    category.name = name;
    category.nameIssue = categoryNameIssue(category);
    if (index.library.mode === 'managed') category.available = true;
    category.description = description;
    category.reviewRequired = semanticsChanged && index.assets.some((asset) => asset.categoryId === category.id && asset.available);
    for (const asset of index.assets.filter((item) => item.categoryId === category.id && item.available)) {
      if (semanticsChanged && !asset.removedFromLibrary) {
        asset.classificationStatus = 'needs-review';
        asset.reviewedAt = null;
      }
    }
    return getStateFromIndex(await saveIndex(index));
  }

  async function deleteCategory(request) {
    const index = await loadIndex();
    assertManaged(index);
    const category = findCategory(index, request?.categoryId);
    if (category.id === UNCLASSIFIED_ID) throw new Error('“未分类”不能删除。');
    if (category.nameIssue || !category.folderRelativePath) throw new Error('请先修复历史分类名称和路径，再删除分类。');
    const rootPath = index.library.rootPath;
    const categoryDirectory = await resolveSafeLibraryPath(rootPath, category.folderRelativePath, { allowMissing: true });
    if (!path.relative(path.resolve(rootPath), categoryDirectory)) throw new Error('不能删除图库根目录。');
    for (const asset of index.assets.filter((item) => item.categoryId === category.id && item.available)) {
      const sourcePath = await resolveSafeLibraryPath(rootPath, asset.relativePath);
      const fileName = await resolveAvailableFileName(rootPath, asset.fileName);
      await fs.promises.rename(sourcePath, path.join(rootPath, fileName));
      Object.assign(asset, { categoryId: UNCLASSIFIED_ID, fileName, relativePath: fileName, classificationStatus: 'needs-review', reviewedAt: null, reviewedBy: null });
    }
    await fs.promises.rm(categoryDirectory, { force: true, recursive: true });
    index.categories = index.categories.filter((item) => item.id !== category.id);
    index.assets = index.assets.filter((item) => item.categoryId !== category.id || item.available);
    return getStateFromIndex(await saveIndex(index));
  }

  async function importImages(request) {
    const index = await loadIndex();
    assertManaged(index);
    const category = findCategory(index, request?.categoryId ?? UNCLASSIFIED_ID);
    if (category.nameIssue) throw new Error('请先修复分类名称，再导入图片。');
    const targetDirectory = await resolveSafeLibraryPath(index.library.rootPath, category.folderRelativePath, { allowMissing: true });
    await ensureDirectory(targetDirectory);
    const sourcePaths = Array.isArray(request?.sourcePaths) ? request.sourcePaths : [];
    const sources = await Promise.all(sourcePaths.map((sourcePath) => validateSourceImage(sourcePath)));
    for (const source of sources) {
      const fileName = await resolveAvailableFileName(targetDirectory, path.basename(source.resolvedPath));
      await fs.promises.copyFile(source.resolvedPath, path.join(targetDirectory, fileName));
    }
    return getStateFromIndex(await saveIndex(await scanIndex(index)));
  }

  async function importClassifiedRoot(request) {
    const index = await loadIndex();
    await importClassifiedLibrary(index, request?.sourceRootPath, { customImportFolderName: CUSTOM_IMPORT_FOLDER_NAME });
    return getStateFromIndex(await saveIndex(await scanIndex(index)));
  }

  async function resolveCategoryDirectory(request) {
    const index = await loadIndex();
    const category = findCategory(index, request?.categoryId);
    const directoryPath = await resolveSafeLibraryPath(index.library.rootPath, category.folderRelativePath, { allowMissing: index.library.mode === 'managed' && !category.nameIssue });
    if (index.library.mode === 'managed') {
      await ensureDirectory(directoryPath);
      return directoryPath;
    }
    if (!category.available) throw new Error('当前分类文件夹已失效。');
    return directoryPath;
  }

  async function setAssetStatus(request) {
    if (!['accepted', 'needs-review'].includes(request?.status)) {
      if (request?.assetIds?.some((id) => String(id).startsWith('system-'))) throw new Error('系统 Emoji 与颜文字目录为只读，不能修改。');
      throw new Error('不支持的审核状态。');
    }
    const index = await loadIndex();
    const batch = await executeBatch(index, request, request?.status);
    return { ...getStateFromIndex(await saveIndex(index)), batch };
  }

  async function getPreview(request) {
    const index = await loadIndex();
    const asset = index.assets.find((item) => item.id === request?.assetId);
    if (!asset || !asset.available || asset.removedFromLibrary) throw new Error('表情包图片不存在或已失效。');
    const filePath = await resolveSafeLibraryPath(index.library.rootPath, asset.relativePath);
    const stats = await fs.promises.stat(filePath);
    if (stats.size > 20 * 1024 * 1024) throw new Error('图片过大，无法预览。');
    const data = await fs.promises.readFile(filePath);
    return { dataUrl: `data:${asset.mimeType};base64,${data.toString('base64')}`, ok: true };
  }

  async function moveAssets(request) {
    const index = await loadIndex();
    const batch = await executeBatch(index, request, 'move');
    return { ...getStateFromIndex(await saveIndex(index)), batch };
  }

  async function removeAssets(request) {
    const index = await loadIndex();
    const batch = await executeBatch(index, request, 'remove');
    return { ...getStateFromIndex(await saveIndex(index)), batch };
  }

  async function undoBatchOperation(request) {
    const index = await loadIndex();
    const batch = await undoBatch(index, request);
    return { ...getStateFromIndex(await saveIndex(index)), batch };
  }

  const api = {
    createCategory: createCategoryEntry, deleteCategory, getPreview, getReplyCatalog, getState, importClassifiedRoot,
    importImages, moveAssets, removeAssets, resolveCategoryDirectory, selectLibraryMode, setAssetStatus, setLibrary,
    updateCategory, undoBatchOperation,
  };
  // IPC scans and user operations share one index file. Serialize them so a
  // background reply scan cannot overwrite a completed review or removal.
  let queue = Promise.resolve();
  return Object.fromEntries(Object.entries(api).map(([name, action]) => [name, (...args) => {
    const task = queue.then(() => action(...args));
    queue = task.catch(() => {});
    return task;
  }]));
}

function categoryNameIssue(category) {
  if (category.id === UNCLASSIFIED_ID) return undefined;
  try {
    sanitizeFolderName(category.name);
    const parts = normalizeRelativePath(category.folderRelativePath).split('/');
    if (parts.length > 2 || parts.some((part) => !part || part === '.' || part === '..')) throw new Error('分类路径异常。');
    parts.forEach(sanitizeFolderName);
    return undefined;
  } catch (error) { return error.message; }
}

function shouldMigrateLegacyManagedRoot(rawIndex, legacyManagedRootPath, managedRootPath) {
  if (!rawIndex || path.resolve(legacyManagedRootPath) === path.resolve(managedRootPath)) return false;
  const libraries = [rawIndex.library, ...(Array.isArray(rawIndex.librarySnapshots) ? rawIndex.librarySnapshots.map((snapshot) => snapshot?.library) : [])];
  return libraries.some((library) => (
    library?.mode === 'managed'
    && path.resolve(String(library.rootPath || legacyManagedRootPath)) === path.resolve(legacyManagedRootPath)
  ));
}

async function removeEmptyLegacyAngryDefaults(index, managedRootPath) {
  const libraries = [index, ...(Array.isArray(index.librarySnapshots) ? index.librarySnapshots : [])];
  for (const libraryIndex of libraries) {
    if (libraryIndex.library?.mode !== 'managed') continue;
    const legacyCategoryIds = new Set((Array.isArray(libraryIndex.categories) ? libraryIndex.categories : [])
      .filter((category) => (
        category.name === '愤怒'
        && category.folderRelativePath === '愤怒'
        && category.description === LEGACY_ANGRY_DESCRIPTION
        && !(Array.isArray(libraryIndex.assets) ? libraryIndex.assets : []).some((asset) => asset.categoryId === category.id)
      ))
      .map((category) => category.id));
    if (!legacyCategoryIds.size) continue;
    libraryIndex.categories = libraryIndex.categories.filter((category) => !legacyCategoryIds.has(category.id));
    await fs.promises.rm(resolveWithinRoot(managedRootPath, '愤怒'), { force: true, recursive: true });
  }
}

async function copyMissingDirectoryContents(sourcePath, targetPath) {
  let entries;
  try {
    entries = await fs.promises.readdir(sourcePath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  await ensureDirectory(targetPath);
  for (const entry of entries) {
    const sourceEntryPath = path.join(sourcePath, entry.name);
    const targetEntryPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      await copyMissingDirectoryContents(sourceEntryPath, targetEntryPath);
    } else if (entry.isFile()) {
      try {
        await fs.promises.copyFile(sourceEntryPath, targetEntryPath, fs.constants.COPYFILE_EXCL);
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
      }
    }
  }
}

function normalizeDescription(value) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu, '').trim().slice(0, 240);
}

function findCategory(index, categoryId) {
  const category = index.categories.find((item) => item.id === categoryId);
  if (!category) throw new Error('表情包分类不存在。');
  return category;
}

function assertManaged(index) {
  if (index.library.mode !== 'managed') throw new Error('外部目录引用模式不会修改用户原文件。');
}

async function ensureLibraryRoot(library) {
  if (library.mode === 'managed') {
    await ensureDirectory(library.rootPath);
    return;
  }
  const stats = await fs.promises.stat(library.rootPath);
  if (!stats.isDirectory()) throw new Error('选择的外部表情包路径不是文件夹。');
}

function sameLibrary(left, right) {
  return left?.mode === right?.mode && path.resolve(String(left?.rootPath ?? '')) === path.resolve(String(right?.rootPath ?? ''));
}

module.exports = { createExpressionLibraryService };
