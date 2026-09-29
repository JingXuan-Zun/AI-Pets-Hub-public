const fs = require('fs');
const path = require('path');

const AUDIO_FILE_EXTENSIONS = new Set([
  '.wav',
  '.flac',
  '.mp3',
  '.m4a',
  '.ogg',
  '.aac',
]);
const CATALOG_CACHE_TTL_MS = 5000;

function listDirectoryEntries(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function pathExists(targetPath) {
  try {
    return fs.existsSync(targetPath);
  } catch {
    return false;
  }
}

function normalizeLabelFromName(name) {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || name;
}

function collectAudioFiles(dirPath) {
  return listDirectoryEntries(dirPath)
    .filter((entry) => entry.isFile() && AUDIO_FILE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'zh-CN'));
}

function collectModelOptions(rootPath) {
  return listDirectoryEntries(rootPath)
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      id: entry.name,
      label: normalizeLabelFromName(entry.name),
      path: path.join(rootPath, entry.name),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));
}

function collectReferenceOptions(referenceRootPath) {
  const groupedReferences = listDirectoryEntries(referenceRootPath)
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const referencePath = path.join(referenceRootPath, entry.name);
      const sampleFiles = collectAudioFiles(referencePath);

      return {
        id: entry.name,
        label: normalizeLabelFromName(entry.name),
        path: referencePath,
        sampleCount: sampleFiles.length,
        sampleFiles,
      };
    })
    .filter((entry) => entry.sampleCount > 0);

  const looseAudioFiles = collectAudioFiles(referenceRootPath);
  if (looseAudioFiles.length > 0) {
    groupedReferences.unshift({
      id: 'reference-root',
      label: '根目录音频',
      path: referenceRootPath,
      sampleCount: looseAudioFiles.length,
      sampleFiles: looseAudioFiles,
    });
  }

  return groupedReferences.sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));
}

function resolveVoiceRootPath({ app, projectRoot }) {
  const appRootPath = typeof app?.getAppPath === 'function'
    ? app.getAppPath()
    : projectRoot;
  const packagedExeDir = process.execPath ? path.dirname(process.execPath) : null;
  const portableExecutableDir = process.env.PORTABLE_EXECUTABLE_DIR
    || (process.env.PORTABLE_EXECUTABLE_FILE ? path.dirname(process.env.PORTABLE_EXECUTABLE_FILE) : null);
  const candidateRootPaths = [
    portableExecutableDir ? path.join(portableExecutableDir, 'local-models', 'voice') : null,
    portableExecutableDir ? path.join(portableExecutableDir, '..', 'local-models', 'voice') : null,
    portableExecutableDir ? path.join(portableExecutableDir, '..', '..', 'local-models', 'voice') : null,
    packagedExeDir ? path.join(packagedExeDir, 'local-models', 'voice') : null,
    packagedExeDir ? path.join(packagedExeDir, '..', 'local-models', 'voice') : null,
    packagedExeDir ? path.join(packagedExeDir, '..', '..', 'local-models', 'voice') : null,
    path.join(process.resourcesPath || '', 'local-models', 'voice'),
    appRootPath ? path.join(appRootPath, 'local-models', 'voice') : null,
    projectRoot ? path.join(projectRoot, 'local-models', 'voice') : null,
  ].filter(Boolean);

  return candidateRootPaths.find((candidatePath) => pathExists(candidatePath)) ?? null;
}

function createLocalVoiceLibrary({ app, projectRoot }) {
  let cachedCatalog = null;
  let cachedAt = 0;

  function buildCatalog() {
    const rootPath = resolveVoiceRootPath({ app, projectRoot });
    if (!rootPath) {
      return {
        rootPath: null,
        ttsModels: [],
        sttModels: [],
        references: [],
      };
    }

    return {
      rootPath,
      ttsModels: collectModelOptions(path.join(rootPath, 'tts')),
      sttModels: collectModelOptions(path.join(rootPath, 'stt')),
      references: collectReferenceOptions(path.join(rootPath, 'reference')),
    };
  }

  return {
    getCatalog(options = {}) {
      const forceRefresh = Boolean(options?.forceRefresh);
      const now = Date.now();

      if (!forceRefresh && cachedCatalog && now - cachedAt < CATALOG_CACHE_TTL_MS) {
        return cachedCatalog;
      }

      cachedCatalog = buildCatalog();
      cachedAt = now;
      return cachedCatalog;
    },
  };
}

module.exports = {
  createLocalVoiceLibrary,
};
