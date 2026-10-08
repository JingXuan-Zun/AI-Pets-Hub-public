const path = require('path');

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

module.exports = {
  normalizeInputPath,
  normalizeInputName,
  clampInteger,
  getPathKind,
  normalizeAbsolutePath,
  normalizeFileManagementAction,
  isSafeFileName,
  isPathInside,
  getFileManagementSourcePath,
};
