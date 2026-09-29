const fs = require('fs');
const path = require('path');

const SUPPORTED_EXTENSIONS = new Set(['.gif', '.jpeg', '.jpg', '.png', '.webp']);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function normalizeRelativePath(value) {
  return String(value ?? '').replace(/\\/gu, '/').replace(/^\/+|\/+$/gu, '');
}

function resolveWithinRoot(rootPath, relativePath) {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(resolvedRoot, normalizeRelativePath(relativePath));
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('目标路径不在表情包库根目录内。');
  }
  return resolvedTarget;
}

function isSupportedImageName(fileName) {
  return SUPPORTED_EXTENSIONS.has(path.extname(String(fileName ?? '')).toLowerCase());
}

function sanitizeFolderName(value) {
  const name = String(value ?? '');
  if (!name.trim()) throw new Error('分类名称不能为空。');
  if (name.length > 64) throw new Error('分类名称最多 64 个字符，请缩短后保存。');
  if (/[<>:"/\\|?*\u0000-\u001f\u007f]/u.test(name)) throw new Error('分类名称不能包含换行、控制字符或 < > : " / \\ | ? *。');
  if (name !== name.trim() || /[.]$/u.test(name)) throw new Error('分类名称首尾不能有空格，也不能以句点结尾。');
  if (/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(name)) throw new Error('分类名称不能使用 Windows 保留名称。');
  return name;
}

// Check real paths as well as lexical paths so junctions cannot escape the library.
async function resolveSafeLibraryPath(rootPath, relativePath, { allowMissing = false } = {}) {
  const target = resolveWithinRoot(rootPath, relativePath);
  const realRoot = await fs.promises.realpath(rootPath);
  let probe = target;
  while (true) {
    try {
      const realTarget = await fs.promises.realpath(probe);
      const relative = path.relative(realRoot, realTarget);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('真实路径超出图库范围，已阻止文件操作。');
      return target;
    } catch (error) {
      if (!allowMissing || error.code !== 'ENOENT' || probe === path.resolve(rootPath)) throw error;
      probe = path.dirname(probe);
    }
  }
}

async function ensureDirectory(directoryPath) {
  await fs.promises.mkdir(directoryPath, { recursive: true });
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJsonAtomic(filePath, value) {
  await ensureDirectory(path.dirname(filePath));
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.promises.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.promises.rename(temporaryPath, filePath);
}

async function listImageFiles(directoryPath) {
  const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && isSupportedImageName(entry.name));
}

async function scanLibraryRoot(rootPath, { nestedCategoryContainerName = '' } = {}) {
  await ensureDirectory(rootPath);
  const entries = await fs.promises.readdir(rootPath, { withFileTypes: true });
  const folders = [];
  const rootImages = entries.filter((entry) => entry.isFile() && isSupportedImageName(entry.name));
  const images = rootImages.map((entry) => ({ fileName: entry.name, folderRelativePath: '' }));

  for (const entry of entries.filter((item) => item.isDirectory())) {
    const folderName = entry.name;
    if (nestedCategoryContainerName && folderName === nestedCategoryContainerName) {
      const containerPath = resolveWithinRoot(rootPath, folderName);
      const containerImages = await listImageFiles(containerPath);
      if (containerImages.length > 0) {
        folders.push(folderName);
        images.push(...containerImages.map((imageEntry) => ({
          fileName: imageEntry.name,
          folderRelativePath: folderName,
        })));
      }
      const nestedEntries = await fs.promises.readdir(containerPath, { withFileTypes: true });
      for (const nestedEntry of nestedEntries.filter((item) => item.isDirectory())) {
        const nestedRelativePath = normalizeRelativePath(path.join(folderName, nestedEntry.name));
        folders.push(nestedRelativePath);
        const nestedImages = await listImageFiles(resolveWithinRoot(rootPath, nestedRelativePath));
        images.push(...nestedImages.map((imageEntry) => ({
          fileName: imageEntry.name,
          folderRelativePath: nestedRelativePath,
        })));
      }
      continue;
    }
    folders.push(folderName);
    const folderPath = resolveWithinRoot(rootPath, folderName);
    const folderImages = await listImageFiles(folderPath);
    images.push(...folderImages.map((entry) => ({
      fileName: entry.name,
      folderRelativePath: normalizeRelativePath(folderName),
    })));
  }

  return { folders, images };
}

async function validateSourceImage(sourcePath) {
  const resolvedPath = path.resolve(String(sourcePath ?? ''));
  if (!isSupportedImageName(resolvedPath)) throw new Error('不支持的图片格式。');
  const stats = await fs.promises.stat(resolvedPath);
  if (!stats.isFile()) throw new Error('选择的项目不是图片文件。');
  if (stats.size > MAX_IMAGE_BYTES) throw new Error('单张表情包图片不能超过 20 MB。');
  return { resolvedPath, sizeBytes: stats.size };
}

async function resolveAvailableFileName(directoryPath, requestedName) {
  const extension = path.extname(requestedName);
  const stem = path.basename(requestedName, extension);
  let candidate = requestedName;
  for (let index = 1; index < 10_000; index += 1) {
    try {
      await fs.promises.access(path.join(directoryPath, candidate));
      candidate = `${stem} (${index})${extension}`;
    } catch {
      return candidate;
    }
  }
  throw new Error('无法为同名图片生成可用文件名。');
}

function mimeTypeForFileName(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === '.gif') return 'image/gif';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  return 'image/png';
}

module.exports = {
  MAX_IMAGE_BYTES,
  ensureDirectory,
  isSupportedImageName,
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
};
