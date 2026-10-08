const fs = require('fs');
const { createPersistedConfigLoader } = require('./persistedConfigLoader.cjs');
const { createPersistedConfigSaver } = require('./persistedConfigSaver.cjs');
const { createPersistedConfigMigrations } = require('./persistedConfigMigrations.cjs');
const path = require('path');
const { INLINE_IMAGE_EXTERNALIZE_THRESHOLD_BYTES, buildLocalConfigAssetUrl } = require('./persistedConfigImageRules.cjs');
const { normalizeErrorMessage, ensureDirectory, isPlainObject } = require('./persistedConfigFiles.cjs');
const { externalizeConfigImageDataUrls } = require('./persistedConfigImageAssets.cjs');
const { MODEL_ASSET_DIRECTORY_NAME } = require('./modelAssetRoot.cjs');
const { createConfigCredentialCodec } = require('./configCredentials.cjs');

const PRIMARY_FILE_NAME = 'desktop-pet-config.v1.json';
const BACKUP_FILE_NAME = 'desktop-pet-config.v1.backup.json';
const CONFIG_ASSET_DIRECTORY_NAME = 'config-assets';

function extractConfigPayload(parsedValue) {
  if (!isPlainObject(parsedValue)) {
    return null;
  }

  if (isPlainObject(parsedValue.config)) {
    return parsedValue.config;
  }

  return parsedValue;
}

function readPersistedConfigFile(filePath) {
  try {
    const rawText = fs.readFileSync(filePath, 'utf8');
    const trimmedText = rawText.trim();
    if (!trimmedText) {
      return {
        ok: false,
        error: 'empty-file',
      };
    }

    const parsedValue = JSON.parse(trimmedText);
    const config = extractConfigPayload(parsedValue);
    if (!config) {
      return {
        ok: false,
        error: 'invalid-config-payload',
      };
    }

    return {
      ok: true,
      config,
      bytes: Buffer.byteLength(trimmedText, 'utf8'),
    };
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return {
        ok: false,
        error: 'missing-file',
      };
    }

    return {
      ok: false,
      error: normalizeErrorMessage(error),
    };
  }
}

function writeTextFileSafely(targetPath, text) {
  const tempPath = `${targetPath}.${process.pid}.tmp`;
  ensureDirectory(path.dirname(targetPath));
  try {
    fs.writeFileSync(tempPath, text, 'utf8');
    fs.renameSync(tempPath, targetPath);
  } finally { fs.rmSync(tempPath, { force: true }); }
}

function buildPersistedPayload(config) {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    config,
  };
}

function createPersistedConfigStore({
  assetRootPath,
  userDataPath,
  log,
  safeStorage,
}) {
  const credentials = createConfigCredentialCodec(safeStorage);
  const storeDir = userDataPath;
  const primaryPath = path.join(storeDir, PRIMARY_FILE_NAME);
  const backupPath = path.join(storeDir, BACKUP_FILE_NAME);
  const assetDir = path.join(storeDir, CONFIG_ASSET_DIRECTORY_NAME);
  const sequenceAssetDir = path.join(assetRootPath || storeDir, MODEL_ASSET_DIRECTORY_NAME);

  function logMessage(message, details) {
    if (typeof log === 'function') {
      log(message, details);
    }
  }

  function getPaths() {
    return {
      storeDir,
      primaryPath,
      backupPath,
      assetDir,
      sequenceAssetDir,
    };
  }

  const { migrateLoadedConfig, migrateCredentials } = createPersistedConfigMigrations({
    primaryPath, backupPath, assetDir, sequenceAssetDir, readPersistedConfigFile, logMessage,
    save: config => save(config),
  });

  const { readConfig, load } = createPersistedConfigLoader({
    primaryPath, backupPath, assetDir, credentials, readPersistedConfigFile,
    writeTextFileSafely, buildPersistedPayload, migrateCredentials, migrateLoadedConfig, logMessage,
  });

  const save = createPersistedConfigSaver({
    storeDir, primaryPath, backupPath, assetDir, sequenceAssetDir, readConfig, credentials,
    buildPersistedPayload, writeTextFileSafely, logMessage,
  });

  return {
    getPaths,
    load,
    save,
  };
}

module.exports = {
  BACKUP_FILE_NAME,
  CONFIG_ASSET_DIRECTORY_NAME,
  INLINE_IMAGE_EXTERNALIZE_THRESHOLD_BYTES,
  PRIMARY_FILE_NAME,
  buildLocalConfigAssetUrl,
  createPersistedConfigStore,
  externalizeConfigImageDataUrls,
};
