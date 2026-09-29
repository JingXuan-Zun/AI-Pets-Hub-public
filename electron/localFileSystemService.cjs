const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_LIST_LIMIT = 80;
const DEFAULT_SEARCH_LIMIT = 80;
const DEFAULT_SEARCH_MAX_DEPTH = 4;
const DEFAULT_READ_MAX_BYTES = 96 * 1024;
const MAX_LIST_LIMIT = 300;
const MAX_SEARCH_LIMIT = 300;
const MAX_SEARCH_DEPTH = 8;
const MAX_READ_BYTES = 512 * 1024;
const MAX_DESKTOP_FILE_ORGANIZATION_ITEMS = 200;
const FILE_MANAGEMENT_ACTION_LABELS = {
  copy_path: 'copy',
  create_directory: 'create-directory',
  move_path: 'move',
  organize_desktop_files: 'organize-desktop-files',
  preview: 'preview',
  rename_path: 'rename',
  trash_path: 'trash',
};

const DESKTOP_FILE_CATEGORY_LABELS = {
  app: 'Apps',
  archive: 'Archives',
  code: 'Code',
  document: 'Documents',
  image: 'Images',
  media: 'Media',
  other: 'Other',
};

const DESKTOP_FILE_CATEGORY_ORDER = {
  image: 10,
  document: 20,
  archive: 30,
  media: 40,
  code: 50,
  app: 60,
  other: 90,
};

const DESKTOP_FILE_EXTENSION_CATEGORIES = {
  app: new Set(['.appref-ms', '.bat', '.cmd', '.com', '.exe', '.msi', '.ps1']),
  archive: new Set(['.7z', '.bz2', '.gz', '.rar', '.tar', '.tgz', '.zip']),
  code: new Set(['.c', '.cpp', '.cs', '.css', '.go', '.h', '.hpp', '.html', '.java', '.js', '.json', '.jsx', '.kt', '.lua', '.php', '.py', '.rb', '.rs', '.sh', '.sql', '.ts', '.tsx', '.vue', '.xml', '.yaml', '.yml']),
  document: new Set(['.csv', '.doc', '.docx', '.log', '.md', '.odp', '.ods', '.odt', '.pdf', '.ppt', '.pptx', '.rtf', '.txt', '.xls', '.xlsx']),
  image: new Set(['.avif', '.bmp', '.gif', '.heic', '.ico', '.jpeg', '.jpg', '.png', '.psd', '.svg', '.tif', '.tiff', '.webp']),
  media: new Set(['.aac', '.avi', '.flac', '.m4a', '.mkv', '.mov', '.mp3', '.mp4', '.ogg', '.wav', '.webm', '.wmv']),
};

const DEFAULT_IGNORED_DIRECTORY_NAMES = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'dist',
  'build',
  'release',
  'target',
  '.venv',
  'venv',
  '__pycache__',
]);

function normalizeInputPath(value) {
  return String(value || '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();
}

function normalizeInputName(value) {
  return String(value || '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();
}

function clampInteger(value, fallback, minValue, maxValue) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(minValue, Math.min(maxValue, Math.round(number)));
}

function getSafeStat(targetPath) {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
}

function getPathKind(stat) {
  if (!stat) {
    return 'missing';
  }

  if (stat.isDirectory()) {
    return 'directory';
  }

  if (stat.isFile()) {
    return 'file';
  }

  if (stat.isSymbolicLink?.()) {
    return 'symlink';
  }

  return 'other';
}

function normalizeAbsolutePath(rawPath) {
  const inputPath = normalizeInputPath(rawPath);
  if (!inputPath) {
    return {
      error: 'Missing path.',
      ok: false,
      path: '',
    };
  }

  if (!path.isAbsolute(inputPath)) {
    return {
      error: 'Path must be an absolute local path.',
      ok: false,
      path: inputPath,
    };
  }

  return {
    ok: true,
    path: path.resolve(inputPath),
  };
}

function normalizeFileManagementAction(value) {
  const normalizedValue = String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  switch (normalizedValue) {
    case 'plan':
    case 'preview':
    case 'dry_run':
      return 'preview';
    case 'move':
    case 'move_path':
    case 'move_file':
    case 'move_folder':
      return 'move_path';
    case 'organize_desktop':
    case 'organize_desktop_file':
    case 'organize_desktop_files':
    case 'organize_desktop_items':
    case 'desktop_file_organization':
      return 'organize_desktop_files';
    case 'copy':
    case 'copy_path':
    case 'copy_file':
    case 'copy_folder':
      return 'copy_path';
    case 'rename':
    case 'rename_path':
    case 'rename_file':
    case 'rename_folder':
      return 'rename_path';
    case 'mkdir':
    case 'new_folder':
    case 'create_folder':
    case 'create_directory':
      return 'create_directory';
    case 'trash':
    case 'trash_path':
    case 'recycle':
    case 'recycle_path':
      return 'trash_path';
    default:
      return '';
  }
}

function isSafeFileName(value) {
  const name = normalizeInputName(value);
  return Boolean(name)
    && name !== '.'
    && name !== '..'
    && !name.includes('/')
    && !name.includes('\\')
    && !path.isAbsolute(name);
}

function isPathInside(childPath, parentPath) {
  const relativePath = path.relative(parentPath, childPath);
  return Boolean(relativePath)
    && relativePath !== '..'
    && !relativePath.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativePath);
}

function getFileManagementSourcePath(request = {}) {
  return normalizeAbsolutePath(
    request.sourcePath
      || request.source
      || request.from
      || request.path
      || request.query,
  );
}

function getFileManagementDestinationPath(request = {}, sourcePath = '') {
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

  if (newName && !isSafeFileName(newName)) {
    return {
      error: 'New name must be a single file or folder name.',
      ok: false,
      path: newName,
    };
  }

  if (rawDestinationDirectory) {
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

  if (rawDestinationPath) {
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

function normalizeDesktopFileOrganizationGroupBy(value) {
  const normalizedValue = String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  switch (normalizedValue) {
    case 'extension':
    case 'ext':
    case 'suffix':
      return 'extension';
    case 'kind':
    case 'item_kind':
      return 'kind';
    case 'none':
      return 'none';
    case 'category':
    case 'type':
    case '':
      return 'category';
    default:
      return 'category';
  }
}

function getDefaultDesktopPath() {
  return path.join(os.homedir(), 'Desktop');
}

function getDesktopFileOrganizationRoot(request = {}, desktopPath = '') {
  const rawRoot = normalizeInputPath(
    request.destinationDirectory
      || request.destinationPath
      || request.targetDirectory
      || request.targetPath
      || request.organizeRoot
      || request.to,
  );
  const resolved = rawRoot
    ? normalizeAbsolutePath(rawRoot)
    : {
        ok: true,
        path: path.join(desktopPath, 'Desktop Organized'),
      };
  if (!resolved.ok) {
    return resolved;
  }

  const rootStat = getSafeStat(resolved.path);
  if (rootStat && !rootStat.isDirectory()) {
    return {
      error: 'Desktop organization destination must be a folder path.',
      ok: false,
      path: resolved.path,
    };
  }

  const parentStat = getSafeStat(path.dirname(resolved.path));
  if (!rootStat && !parentStat?.isDirectory()) {
    return {
      error: 'Desktop organization destination parent directory must exist.',
      ok: false,
      path: resolved.path,
    };
  }

  return resolved;
}

function getDesktopFileCategory(extension) {
  for (const [category, extensions] of Object.entries(DESKTOP_FILE_EXTENSION_CATEGORIES)) {
    if (extensions.has(extension)) {
      return category;
    }
  }

  return 'other';
}

function getDesktopFileGroup(entry, groupBy) {
  if (groupBy === 'extension') {
    const extension = entry.extension || '';
    const label = extension ? extension.slice(1).toUpperCase() : 'No Extension';
    return {
      key: extension || 'no-extension',
      label,
      order: extension ? 30 : 95,
    };
  }

  if (groupBy === 'kind') {
    return {
      key: entry.kind,
      label: entry.kind === 'directory' ? 'Folders' : 'Files',
      order: entry.kind === 'directory' ? 20 : 10,
    };
  }

  const category = entry.category || 'other';
  return {
    key: category,
    label: DESKTOP_FILE_CATEGORY_LABELS[category] || DESKTOP_FILE_CATEGORY_LABELS.other,
    order: DESKTOP_FILE_CATEGORY_ORDER[category] || DESKTOP_FILE_CATEGORY_ORDER.other,
  };
}

function sanitizeDesktopFileOrganizationFolderName(value) {
  const name = normalizeInputName(value).replace(/[<>:"/\\|?*]+/g, '-').trim();
  return isSafeFileName(name) ? name : 'Other';
}

function shouldSkipDesktopFileOrganizationEntry(entry, options) {
  const lowerName = entry.name.toLowerCase();
  if (!options.includeHidden && entry.name.startsWith('.')) {
    return 'hidden';
  }

  if (lowerName === 'desktop.ini') {
    return 'system-file';
  }

  if (entry.isDirectory()) {
    return options.includeDirectories ? '' : 'directory-skipped';
  }

  if (!entry.isFile()) {
    return 'not-a-file';
  }

  const extension = path.extname(entry.name).toLowerCase();
  if (!options.includeShortcuts && (extension === '.lnk' || extension === '.url')) {
    return 'shortcut-skipped';
  }

  return '';
}

function createDesktopFileOrganizationPlan(request = {}) {
  const desktopPathInput = normalizeInputPath(
    request.desktopPath
      || request.sourcePath
      || request.source
      || request.path,
  );
  const desktopPath = desktopPathInput ? normalizeAbsolutePath(desktopPathInput) : {
    ok: true,
    path: getDefaultDesktopPath(),
  };
  if (!desktopPath.ok) {
    return {
      error: desktopPath.error,
      ok: false,
      path: desktopPath.path,
    };
  }

  const desktopStat = getSafeStat(desktopPath.path);
  if (!desktopStat?.isDirectory()) {
    return {
      error: 'Desktop path must be an existing folder.',
      ok: false,
      path: desktopPath.path,
    };
  }

  const destinationRoot = getDesktopFileOrganizationRoot(request, desktopPath.path);
  if (!destinationRoot.ok) {
    return {
      error: destinationRoot.error,
      ok: false,
      path: destinationRoot.path,
    };
  }

  const groupBy = normalizeDesktopFileOrganizationGroupBy(request.groupBy || request.group || request.grouping);
  const includeDirectories = Boolean(request.includeDirectories);
  const includeHidden = Boolean(request.includeHidden);
  const includeShortcuts = Boolean(request.includeShortcuts);
  const limit = clampInteger(request.limit, MAX_DESKTOP_FILE_ORGANIZATION_ITEMS, 1, MAX_DESKTOP_FILE_ORGANIZATION_ITEMS);
  const entries = fs.readdirSync(desktopPath.path, { withFileTypes: true })
    .sort((first, second) => first.name.localeCompare(second.name, 'zh-Hans-CN', { numeric: true }));
  const items = [];
  const skipped = [];
  const conflicts = [];
  const groups = new Map();
  let truncated = false;

  for (const entry of entries) {
    const sourcePath = path.join(desktopPath.path, entry.name);
    if (
      path.resolve(sourcePath) === path.resolve(destinationRoot.path)
      || isPathInside(sourcePath, destinationRoot.path)
    ) {
      skipped.push({
        name: entry.name,
        reason: 'already-in-destination-root',
        sourcePath,
      });
      continue;
    }

    const skipReason = shouldSkipDesktopFileOrganizationEntry(entry, {
      includeDirectories,
      includeHidden,
      includeShortcuts,
    });
    if (skipReason) {
      skipped.push({
        name: entry.name,
        reason: skipReason,
        sourcePath,
      });
      continue;
    }

    if (items.length >= limit) {
      truncated = true;
      skipped.push({
        name: entry.name,
        reason: 'limit-reached',
        sourcePath,
      });
      continue;
    }

    const stat = getSafeStat(sourcePath);
    if (!stat) {
      skipped.push({
        name: entry.name,
        reason: 'stat-failed',
        sourcePath,
      });
      continue;
    }

    const extension = entry.isFile() ? path.extname(entry.name).toLowerCase() : '';
    const category = entry.isFile() ? getDesktopFileCategory(extension) : 'other';
    const kind = getPathKind(stat);
    const group = getDesktopFileGroup({
      category,
      extension,
      kind,
    }, groupBy);
    const folderName = groupBy === 'none' ? 'Files' : sanitizeDesktopFileOrganizationFolderName(group.label);
    const destinationDirectory = path.join(destinationRoot.path, folderName);
    const destinationPath = path.join(destinationDirectory, entry.name);
    const destinationExists = Boolean(getSafeStat(destinationPath));
    const item = {
      category,
      destinationDirectory,
      destinationPath,
      extension,
      groupKey: group.key,
      groupLabel: group.label,
      kind,
      name: entry.name,
      sourcePath,
      sizeBytes: stat.isFile() ? stat.size : 0,
    };

    items.push(item);
    if (destinationExists) {
      conflicts.push({
        destinationPath,
        name: entry.name,
        sourcePath,
      });
    }

    const currentGroup = groups.get(group.key) || {
      count: 0,
      destinationDirectory,
      key: group.key,
      label: group.label,
      order: group.order,
    };
    currentGroup.count += 1;
    groups.set(group.key, currentGroup);
  }

  return {
    conflicts,
    destinationRoot: destinationRoot.path,
    desktopPath: desktopPath.path,
    groupBy,
    groups: [...groups.values()].sort((first, second) => (
      first.order - second.order
      || first.label.localeCompare(second.label, 'zh-Hans-CN', { numeric: true })
    )).map(({ order, ...group }) => group),
    items,
    ok: true,
    skipped,
    truncated,
  };
}

function createDesktopFileOrganizationResult(plan, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const changedPaths = options.changedPaths || [];
  const createdDirectories = options.createdDirectories || [];
  const movedItemCount = options.movedItemCount ?? 0;
  const conflictCount = plan.conflicts.length;
  const responsePrefix = dryRun ? 'Desktop file organization preview ready' : 'Desktop file organization completed';

  return {
    action: 'organize_desktop_files',
    actionLabel: FILE_MANAGEMENT_ACTION_LABELS.organize_desktop_files,
    changedPaths,
    conflicts: plan.conflicts.slice(0, 20),
    conflictCount,
    createdDirectories,
    desktopPath: plan.desktopPath,
    destinationPath: plan.destinationRoot,
    dryRun,
    error: options.error || '',
    groupBy: plan.groupBy,
    groups: plan.groups,
    movedItemCount,
    ok: options.ok,
    plannedItemCount: plan.items.length,
    planItems: plan.items.slice(0, 80),
    skipped: plan.skipped.slice(0, 30),
    skippedItemCount: plan.skipped.length,
    sourcePath: plan.desktopPath,
    truncated: plan.truncated,
    verified: options.verified,
    willOverwrite: conflictCount > 0,
    responseText: `${responsePrefix}: ${plan.items.length} item(s), ${plan.groups.length} group(s), ${conflictCount} conflict(s).`,
  };
}

function executeDesktopFileOrganizationPlan(plan) {
  if (plan.conflicts.length) {
    return createDesktopFileOrganizationResult(plan, {
      dryRun: false,
      error: 'Destination conflicts exist; no files were moved.',
      ok: false,
      verified: false,
    });
  }

  const changedPaths = [];
  const createdDirectories = [];
  let movedItemCount = 0;

  try {
    if (!getSafeStat(plan.destinationRoot)) {
      fs.mkdirSync(plan.destinationRoot, { recursive: true });
      createdDirectories.push(plan.destinationRoot);
    }

    for (const group of plan.groups) {
      if (!getSafeStat(group.destinationDirectory)) {
        fs.mkdirSync(group.destinationDirectory, { recursive: true });
        createdDirectories.push(group.destinationDirectory);
      }
    }

    for (const item of plan.items) {
      fs.renameSync(item.sourcePath, item.destinationPath);
      changedPaths.push(item.sourcePath, item.destinationPath);
      movedItemCount += 1;
    }

    const verified = plan.items.every((item) => (
      !getSafeStat(item.sourcePath) && Boolean(getSafeStat(item.destinationPath))
    ));

    return createDesktopFileOrganizationResult(plan, {
      changedPaths,
      createdDirectories,
      dryRun: false,
      movedItemCount,
      ok: verified,
      verified,
    });
  } catch (error) {
    return createDesktopFileOrganizationResult(plan, {
      changedPaths,
      createdDirectories,
      dryRun: false,
      error: error instanceof Error ? error.message : String(error),
      movedItemCount,
      ok: false,
      verified: false,
    });
  }
}

function normalizeEntry(fullPath, name, stat) {
  return {
    createdAt: stat.birthtimeMs || 0,
    extension: stat.isFile() ? path.extname(name).toLowerCase() : '',
    kind: getPathKind(stat),
    modifiedAt: stat.mtimeMs || 0,
    name,
    path: fullPath,
    sizeBytes: stat.isFile() ? stat.size : 0,
  };
}

function listDirectoryEntries(directoryPath, options = {}) {
  const includeHidden = Boolean(options.includeHidden);
  const rawEntries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const entries = rawEntries
    .filter((entry) => includeHidden || !entry.name.startsWith('.'))
    .map((entry) => {
      const fullPath = path.join(directoryPath, entry.name);
      const stat = getSafeStat(fullPath);
      return stat ? normalizeEntry(fullPath, entry.name, stat) : null;
    })
    .filter(Boolean)
    .sort((first, second) => (
      Number(second.kind === 'directory') - Number(first.kind === 'directory')
      || first.name.localeCompare(second.name, 'zh-Hans-CN', { numeric: true })
    ));

  return {
    entries,
    totalEntryCount: rawEntries.length,
  };
}

function createPathInfo(request = {}) {
  const resolved = normalizeAbsolutePath(request.path || request.target || request.query);
  if (!resolved.ok) {
    return resolved;
  }

  const stat = getSafeStat(resolved.path);
  const kind = getPathKind(stat);
  return {
    basename: path.basename(resolved.path),
    dirname: path.dirname(resolved.path),
    exists: Boolean(stat),
    extension: stat?.isFile() ? path.extname(resolved.path).toLowerCase() : '',
    kind,
    modifiedAt: stat?.mtimeMs || 0,
    ok: Boolean(stat),
    path: resolved.path,
    sizeBytes: stat?.isFile() ? stat.size : 0,
  };
}

function listDirectory(request = {}) {
  const resolved = normalizeAbsolutePath(request.path || request.folderPath || request.query);
  if (!resolved.ok) {
    return resolved;
  }

  const stat = getSafeStat(resolved.path);
  if (!stat) {
    return {
      error: 'Path does not exist.',
      ok: false,
      path: resolved.path,
    };
  }

  if (!stat.isDirectory()) {
    return {
      error: 'Path is not a directory.',
      kind: getPathKind(stat),
      ok: false,
      path: resolved.path,
    };
  }

  try {
    const limit = clampInteger(request.limit, DEFAULT_LIST_LIMIT, 1, MAX_LIST_LIMIT);
    const { entries, totalEntryCount } = listDirectoryEntries(resolved.path, {
      includeHidden: request.includeHidden,
    });
    const visibleEntries = entries.slice(0, limit);

    return {
      entries: visibleEntries,
      limit,
      ok: true,
      path: resolved.path,
      totalEntryCount,
      truncated: entries.length > visibleEntries.length,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      ok: false,
      path: resolved.path,
    };
  }
}

function normalizeExtensionFilter(value) {
  if (!value) {
    return null;
  }

  const values = Array.isArray(value)
    ? value
    : String(value).split(/[,;\s]+/u);
  const extensions = values
    .map((item) => String(item || '').trim().toLowerCase())
    .filter(Boolean)
    .map((item) => (item.startsWith('.') ? item : `.${item}`));

  return extensions.length ? new Set(extensions) : null;
}

function shouldSkipSearchDirectory(entryName, includeHidden) {
  if (!includeHidden && entryName.startsWith('.')) {
    return true;
  }

  return DEFAULT_IGNORED_DIRECTORY_NAMES.has(entryName);
}

function searchFiles(request = {}) {
  const resolved = normalizeAbsolutePath(request.path || request.folderPath || request.rootPath || request.queryRoot);
  if (!resolved.ok) {
    return resolved;
  }

  const query = String(request.nameQuery || request.fileName || request.pattern || request.query || '')
    .trim()
    .toLowerCase();
  if (!query) {
    return {
      error: 'Missing file search query.',
      ok: false,
      path: resolved.path,
    };
  }

  const rootStat = getSafeStat(resolved.path);
  if (!rootStat?.isDirectory()) {
    return {
      error: 'Search root must be an existing directory.',
      ok: false,
      path: resolved.path,
    };
  }

  const includeHidden = Boolean(request.includeHidden);
  const extensionFilter = normalizeExtensionFilter(request.extensions || request.extension);
  const limit = clampInteger(request.limit, DEFAULT_SEARCH_LIMIT, 1, MAX_SEARCH_LIMIT);
  const maxDepth = clampInteger(request.maxDepth, DEFAULT_SEARCH_MAX_DEPTH, 0, MAX_SEARCH_DEPTH);
  const matches = [];
  let visitedDirectoryCount = 0;
  let visitedFileCount = 0;
  let truncated = false;

  function visit(directoryPath, depth) {
    if (matches.length >= limit) {
      truncated = true;
      return;
    }

    visitedDirectoryCount += 1;
    let entries = [];
    try {
      entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (matches.length >= limit) {
        truncated = true;
        return;
      }

      const fullPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        if (depth < maxDepth && !shouldSkipSearchDirectory(entry.name, includeHidden)) {
          visit(fullPath, depth + 1);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      visitedFileCount += 1;
      const extension = path.extname(entry.name).toLowerCase();
      if (extensionFilter && !extensionFilter.has(extension)) {
        continue;
      }

      if (!entry.name.toLowerCase().includes(query)) {
        continue;
      }

      const stat = getSafeStat(fullPath);
      if (stat) {
        matches.push(normalizeEntry(fullPath, entry.name, stat));
      }
    }
  }

  visit(resolved.path, 0);

  return {
    limit,
    matches,
    maxDepth,
    ok: true,
    path: resolved.path,
    query,
    truncated,
    visitedDirectoryCount,
    visitedFileCount,
  };
}

function looksBinary(buffer) {
  const sampleLength = Math.min(buffer.length, 4096);
  for (let index = 0; index < sampleLength; index += 1) {
    if (buffer[index] === 0) {
      return true;
    }
  }

  return false;
}

function readTextFile(request = {}) {
  const resolved = normalizeAbsolutePath(request.path || request.filePath || request.query);
  if (!resolved.ok) {
    return resolved;
  }

  const stat = getSafeStat(resolved.path);
  if (!stat) {
    return {
      error: 'Path does not exist.',
      ok: false,
      path: resolved.path,
    };
  }

  if (!stat.isFile()) {
    return {
      error: 'Path is not a file.',
      kind: getPathKind(stat),
      ok: false,
      path: resolved.path,
    };
  }

  const maxBytes = clampInteger(request.maxBytes, DEFAULT_READ_MAX_BYTES, 1, MAX_READ_BYTES);
  try {
    const fd = fs.openSync(resolved.path, 'r');
    try {
      const byteLength = Math.min(stat.size, maxBytes);
      const buffer = Buffer.alloc(byteLength);
      fs.readSync(fd, buffer, 0, byteLength, 0);
      if (looksBinary(buffer)) {
        return {
          error: 'File appears to be binary; text content was not returned.',
          kind: 'file',
          ok: false,
          path: resolved.path,
          sizeBytes: stat.size,
        };
      }

      return {
        encoding: 'utf8',
        extension: path.extname(resolved.path).toLowerCase(),
        modifiedAt: stat.mtimeMs || 0,
        ok: true,
        path: resolved.path,
        sizeBytes: stat.size,
        text: buffer.toString('utf8'),
        truncated: stat.size > maxBytes,
      };
    } finally {
      fs.closeSync(fd);
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      ok: false,
      path: resolved.path,
    };
  }
}

const IMAGE_MIME_TYPES = {
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function readFileDataUrl(request = {}) {
  const resolved = normalizeAbsolutePath(request.path || request.filePath || request.query);
  if (!resolved.ok) return resolved;

  const stat = getSafeStat(resolved.path);
  if (!stat?.isFile()) {
    return { error: 'Path is not a file.', ok: false, path: resolved.path };
  }

  const mimeType = IMAGE_MIME_TYPES[path.extname(resolved.path).toLowerCase()];
  if (!mimeType) {
    return { error: 'Only supported image files can be read as data URLs.', ok: false, path: resolved.path };
  }

  const maxBytes = clampInteger(request.maxBytes, 16 * 1024 * 1024, 1, 32 * 1024 * 1024);
  if (stat.size > maxBytes) {
    return { error: 'Image file is too large.', ok: false, path: resolved.path, sizeBytes: stat.size };
  }

  try {
    return {
      dataUrl: `data:${mimeType};base64,${fs.readFileSync(resolved.path).toString('base64')}`,
      ok: true,
      path: resolved.path,
      sizeBytes: stat.size,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), ok: false, path: resolved.path };
  }
}

async function executeFileManagementAction(request = {}, options = {}) {
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

  if (!action || action === 'preview') {
    return createFileManagementError('preview', 'Missing supported file management action.');
  }

  if (action === 'organize_desktop_files') {
    try {
      const plan = createDesktopFileOrganizationPlan(request);
      if (!plan.ok) {
        return createFileManagementError(action, plan.error, {
          destinationPath: plan.path || '',
          sourcePath: plan.path || '',
        });
      }

      if (dryRun) {
        return createDesktopFileOrganizationResult(plan, {
          dryRun: true,
          error: plan.conflicts.length ? 'Destination conflicts exist; execution will be blocked until conflicts are resolved.' : '',
          ok: plan.conflicts.length === 0,
          verified: false,
        });
      }

      return executeDesktopFileOrganizationPlan(plan);
    } catch (error) {
      return createFileManagementError(action, error instanceof Error ? error.message : String(error));
    }
  }

  if (action === 'create_directory') {
    const target = getCreateDirectoryPath(request);
    if (!target.ok) {
      return createFileManagementError(action, target.error, {
        destinationPath: target.path,
      });
    }

    const overwriteCheck = validateNoOverwrite(request, target.path);
    if (!overwriteCheck.ok) {
      return createFileManagementError(action, overwriteCheck.error, {
        destinationPath: target.path,
      });
    }

    const parentPath = path.dirname(target.path);
    const parentStat = getSafeStat(parentPath);
    if (!parentStat?.isDirectory()) {
      return createFileManagementError(action, 'Parent directory must exist.', {
        destinationPath: target.path,
      });
    }

    if (dryRun) {
      return createFileManagementPreview(action, {
        destinationPath: target.path,
      });
    }

    try {
      fs.mkdirSync(target.path, { recursive: false });
      return createFileManagementSuccess(action, {
        changedPaths: [target.path],
        destinationPath: target.path,
        dryRun: false,
      });
    } catch (error) {
      return createFileManagementError(action, error instanceof Error ? error.message : String(error), {
        destinationPath: target.path,
      });
    }
  }

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

  if (action === 'trash_path') {
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

  const destination = action === 'rename_path'
    ? (() => {
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
      })()
    : getFileManagementDestinationPath(request, source.path);

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

  if (dryRun) {
    return createFileManagementPreview(action, {
      destinationPath: destination.path,
      sourcePath: source.path,
    });
  }

  try {
    if (action === 'move_path' || action === 'rename_path') {
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

    if (action === 'copy_path') {
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

function createLocalFileSystemService({ log } = {}) {
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
      const result = readTextFile(request);
      logResult('read-text-file', result);
      return result;
    },
    readFileDataUrl(request = {}) {
      const result = readFileDataUrl(request);
      logResult('read-file-data-url', result);
      return result;
    },
    searchFiles(request = {}) {
      const result = searchFiles(request);
      logResult('search-files', result);
      return result;
    },
    async executeFileManagementAction(request = {}, options = {}) {
      const result = await executeFileManagementAction(request, options);
      logResult('execute-file-management-action', result);
      return result;
    },
  };
}

module.exports = {
  createLocalFileSystemService,
};
