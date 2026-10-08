const os = require('os');
const path = require('path');
const { normalizeInputPath, normalizeInputName, normalizeAbsolutePath, isSafeFileName } = require('./localFileSystemInputUtils.cjs');
const { getSafeStat } = require('./localFileSystemDestinationUtils.cjs');

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

module.exports = {
  normalizeDesktopFileOrganizationGroupBy,
  getDefaultDesktopPath,
  getDesktopFileOrganizationRoot,
  getDesktopFileCategory,
  getDesktopFileGroup,
  sanitizeDesktopFileOrganizationFolderName,
  shouldSkipDesktopFileOrganizationEntry,
};
