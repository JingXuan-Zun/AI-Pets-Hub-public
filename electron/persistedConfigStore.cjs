const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MODEL_ASSET_DIRECTORY_NAME } = require('./modelAssetRoot.cjs');
const { createConfigCredentialCodec, hasPlaintextCredentials, modelCredentialReferences } = require('./configCredentials.cjs');

const PRIMARY_FILE_NAME = 'desktop-pet-config.v1.json';
const BACKUP_FILE_NAME = 'desktop-pet-config.v1.backup.json';
const CONFIG_ASSET_DIRECTORY_NAME = 'config-assets';
const CONFIG_ASSET_PROTOCOL_ROOT = 'desktop-pet-file://local';
const INLINE_IMAGE_EXTERNALIZE_THRESHOLD_BYTES = 64 * 1024;

const IMAGE_EXTENSION_BY_MIME_TYPE = new Map([
  ['image/avif', 'avif'],
  ['image/bmp', 'bmp'],
  ['image/gif', 'gif'],
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/png', 'png'],
  ['image/svg+xml', 'svg'],
  ['image/webp', 'webp'],
  ['image/x-icon', 'ico'],
]);

function normalizeSequenceAssetFolderName(value, fallback) {
  const normalized = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/[. ]+$/u, '')
    .slice(0, 80);
  return normalized || fallback;
}

function normalizeErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

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

function writeBufferFileSafely(targetPath, buffer) {
  const tempPath = `${targetPath}.${process.pid}.tmp`;
  ensureDirectory(path.dirname(targetPath));
  fs.writeFileSync(tempPath, buffer);
  fs.copyFileSync(tempPath, targetPath);
  fs.rmSync(tempPath, { force: true });
}

function buildLocalConfigAssetUrl(assetPath) {
  const normalizedPath = path.resolve(assetPath).replace(/\\/g, '/');
  const protocolUrl = new URL(`${CONFIG_ASSET_PROTOCOL_ROOT}/`);

  if (normalizedPath.startsWith('//')) {
    protocolUrl.pathname = `/unc/${normalizedPath.replace(/^\/+/, '')}`;
  } else {
    protocolUrl.pathname = `/${normalizedPath.replace(/^\/+/, '')}`;
  }

  return protocolUrl.toString();
}

function parseInlineImageDataUrl(value, options = {}) {
  if (
    typeof value !== 'string'
    || (!options.force && value.length < INLINE_IMAGE_EXTERNALIZE_THRESHOLD_BYTES)
    || !value.startsWith('data:image/')
  ) {
    return null;
  }

  const separatorIndex = value.indexOf(',');
  if (separatorIndex < 0) {
    return null;
  }

  const header = value.slice(5, separatorIndex);
  const headerParts = header.split(';');
  const mimeType = (headerParts.shift() || '').toLowerCase();
  const isBase64 = headerParts.some((part) => part.toLowerCase() === 'base64');
  const extension = IMAGE_EXTENSION_BY_MIME_TYPE.get(mimeType);
  if (!isBase64 || !extension) {
    return null;
  }

  try {
    const payload = value.slice(separatorIndex + 1).replace(/\s+/g, '');
    const buffer = Buffer.from(payload, 'base64');
    if (!buffer.length) {
      return null;
    }

    return {
      buffer,
      extension,
      mimeType,
    };
  } catch {
    return null;
  }
}

function externalizeConfigImageDataUrls(config, assetDir, sequenceAssetRootDir = assetDir) {
  if (!isPlainObject(config)) {
    return {
      config,
      migratedCount: 0,
      migratedBytes: 0,
      errors: [],
    };
  }

  const nextConfig = { ...config };
  const errors = [];
  let migratedCount = 0;
  let migratedBytes = 0;

  function externalizeValue(value, field, options = {}) {
    const parsedImage = parseInlineImageDataUrl(value, options);
    if (!parsedImage) {
      return value;
    }

    try {
      const digest = crypto.createHash('sha256').update(parsedImage.buffer).digest('hex');
      const targetDirectory = typeof options.targetDirectory === 'string' && options.targetDirectory
        ? options.targetDirectory
        : assetDir;
      const filePrefix = typeof options.filePrefix === 'string' && options.filePrefix
        ? `${options.filePrefix}-`
        : '';
      const assetPath = path.join(targetDirectory, `${filePrefix}${digest}.${parsedImage.extension}`);
      if (!fs.existsSync(assetPath)) {
        writeBufferFileSafely(assetPath, parsedImage.buffer);
      }
      migratedCount += 1;
      migratedBytes += Buffer.byteLength(value, 'utf8');
      return buildLocalConfigAssetUrl(assetPath);
    } catch (error) {
      errors.push({
        field,
        error: normalizeErrorMessage(error),
      });
      return value;
    }
  }

  if (isPlainObject(config.settings)) {
    nextConfig.settings = {
      ...config.settings,
      chatBackgroundImageUrl: externalizeValue(
        config.settings.chatBackgroundImageUrl,
        'settings.chatBackgroundImageUrl',
      ),
      chatUserAvatarUrl: externalizeValue(
        config.settings.chatUserAvatarUrl,
        'settings.chatUserAvatarUrl',
      ),
    };
  }

  if (isPlainObject(config.personality)) {
    nextConfig.personality = {
      ...config.personality,
      chatAvatarUrl: externalizeValue(
        config.personality.chatAvatarUrl,
        'personality.chatAvatarUrl',
      ),
    };
  }

  if (Array.isArray(config.companionPets)) {
    nextConfig.companionPets = config.companionPets.map((pet, index) => {
      if (!isPlainObject(pet) || !isPlainObject(pet.personality)) {
        return pet;
      }

      return {
        ...pet,
        personality: {
          ...pet.personality,
          chatAvatarUrl: externalizeValue(
            pet.personality.chatAvatarUrl,
            `companionPets[${index}].personality.chatAvatarUrl`,
          ),
        },
      };
    });
  }

  if (Array.isArray(config.customModelPresets)) {
    nextConfig.customModelPresets = config.customModelPresets.map((preset, presetIndex) => {
      if (!isPlainObject(preset) || preset.type !== '2d') {
        return preset;
      }

      const sequenceAssetFolder = normalizeSequenceAssetFolderName(
        preset.sequenceAssetFolder,
        `未命名序列帧动画-${presetIndex + 1}`,
      );
      const sequenceAssetDir = path.join(sequenceAssetRootDir, sequenceAssetFolder);
      const rawSequenceFrames = Array.isArray(preset.sequenceFrames)
        ? preset.sequenceFrames
        : [];
      const sequenceFrames = rawSequenceFrames.map((frameUrl, frameIndex) => (
        externalizeValue(
          frameUrl,
          `customModelPresets[${presetIndex}].sequenceFrames[${frameIndex}]`,
          {
            filePrefix: `frame-${String(frameIndex + 1).padStart(4, '0')}`,
            force: true,
            targetDirectory: sequenceAssetDir,
          },
        )
      ));
      const primaryFrame = sequenceFrames[0];

      return {
        ...preset,
        sequenceAssetFolder,
        sequenceFrames,
        url: primaryFrame || externalizeValue(
          preset.url,
          `customModelPresets[${presetIndex}].url`,
          {
            filePrefix: 'frame-0001',
            force: true,
            targetDirectory: sequenceAssetDir,
          },
        ),
      };
    });
  }

  return {
    config: nextConfig,
    migratedCount,
    migratedBytes,
    errors,
  };
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

  function migrateLoadedConfig(config, source) {
    const migration = externalizeConfigImageDataUrls(config, assetDir, sequenceAssetDir);
    if (migration.migratedCount === 0) {
      return migration;
    }

    const saveResult = save(migration.config);
    logMessage('persisted config image assets migrated', {
      source,
      migratedCount: migration.migratedCount,
      migratedBytes: migration.migratedBytes,
      assetErrors: migration.errors.length,
      compacted: Boolean(saveResult.ok),
      compactedBytes: saveResult.bytes ?? 0,
      primaryPath,
      backupPath,
      assetDir,
      sequenceAssetDir,
    });

    return {
      ...migration,
      saveResult,
    };
  }

  function readConfig(filePath) {
    const result = readPersistedConfigFile(filePath);
    if (!result.ok) return result;
    try { return { ...result, config: credentials.decode(result.config) }; }
    catch (error) { return { ok: false, credentialReadFailed: true, error: normalizeErrorMessage(error) }; }
  }

  function load(options = {}) {
    try {
      const result = loadInternal();
      if (result.ok && !options.includeModelSecrets) result.config = modelCredentialReferences(result.config);
      return result;
    } catch (error) {
      return { ok: false, source: 'credential-error', error: normalizeErrorMessage(error), primaryPath, backupPath };
    }
  }

  function migrateCredentials(config) {
    const files = [primaryPath, backupPath].map(readPersistedConfigFile);
    if (files.some((result) => result.ok && hasPlaintextCredentials(result.config))) {
      const result = save(config);
      if (!result.ok) throw new Error(result.error);
    }
  }

  function loadInternal() {
    const primaryResult = readConfig(primaryPath);
    if (primaryResult.ok) {
      migrateCredentials(primaryResult.config);
      const migration = migrateLoadedConfig(primaryResult.config, 'primary-file');
      logMessage('persisted config loaded', {
        source: 'primary-file',
        bytes: primaryResult.bytes,
        migratedAssetCount: migration.migratedCount,
        primaryPath,
      });
      return {
        ok: true,
        config: migration.config,
        source: 'primary-file',
        bytes: primaryResult.bytes,
        migratedAssetCount: migration.migratedCount,
        migratedAssetBytes: migration.migratedBytes,
        migrationCompacted: Boolean(migration.saveResult?.ok),
        primaryPath,
        backupPath,
        assetDir,
      };
    }

    const backupResult = readConfig(backupPath);
    if (backupResult.ok) {
      let repairedPrimary = false;
      let repairError = null;

      try {
        const backupText = JSON.stringify(buildPersistedPayload(credentials.encode(backupResult.config)), null, 2);
        writeTextFileSafely(primaryPath, backupText);
        repairedPrimary = true;
      } catch (error) {
        repairError = normalizeErrorMessage(error);
      }

      logMessage('persisted config restored from backup', {
        source: 'backup-file',
        bytes: backupResult.bytes,
        primaryError: primaryResult.error,
        repairedPrimary,
        repairError,
        primaryPath,
        backupPath,
      });

      const migration = migrateLoadedConfig(backupResult.config, 'backup-file');
      migrateCredentials(migration.config);

      return {
        ok: true,
        config: migration.config,
        source: 'backup-file',
        recoveredFromBackup: true,
        repairedPrimary,
        repairError,
        bytes: backupResult.bytes,
        migratedAssetCount: migration.migratedCount,
        migratedAssetBytes: migration.migratedBytes,
        migrationCompacted: Boolean(migration.saveResult?.ok),
        primaryError: primaryResult.error,
        primaryPath,
        backupPath,
        assetDir,
      };
    }

    logMessage('persisted config missing or unreadable', {
      source: 'missing',
      primaryError: primaryResult.error,
      backupError: backupResult.error,
      primaryPath,
      backupPath,
    });

    return {
      ok: false,
      config: null,
      source: 'missing',
      primaryError: primaryResult.error,
      backupError: backupResult.error,
      primaryPath,
      backupPath,
    };
  }

  function save(config) {
    try {
      ensureDirectory(storeDir);

      const migration = externalizeConfigImageDataUrls(config, assetDir, sequenceAssetDir);

      let backupMode = 'existing-backup-retained';
      const currentPrimaryResult = readConfig(primaryPath);
      const currentBackupResult = readConfig(backupPath);
      if (!currentPrimaryResult.ok && !currentBackupResult.ok
        && (currentPrimaryResult.credentialReadFailed || currentBackupResult.credentialReadFailed)) {
        throw new Error('credential-decryption-failed');
      }
      const protectedConfig = credentials.encode(migration.config,
        currentPrimaryResult.ok ? currentPrimaryResult.config : currentBackupResult.config);
      const serializedPayload = JSON.stringify(buildPersistedPayload(protectedConfig), null, 2);
      if (currentPrimaryResult.ok) {
        const currentPrimaryText = JSON.stringify(buildPersistedPayload(credentials.encode(currentPrimaryResult.config)), null, 2);
        writeTextFileSafely(backupPath, currentPrimaryText);
        backupMode = 'previous-primary';
      }

      writeTextFileSafely(primaryPath, serializedPayload);

      if (!currentPrimaryResult.ok && currentBackupResult.ok) {
        writeTextFileSafely(backupPath, JSON.stringify(buildPersistedPayload(credentials.encode(currentBackupResult.config)), null, 2));
      }

      if (!currentPrimaryResult.ok && !currentBackupResult.ok) {
        writeTextFileSafely(backupPath, serializedPayload);
        backupMode = 'mirrored-primary';
      }

      const bytes = Buffer.byteLength(serializedPayload, 'utf8');
      logMessage('persisted config saved', {
        bytes,
        backupMode,
        migratedAssetCount: migration.migratedCount,
        migratedAssetBytes: migration.migratedBytes,
        assetErrors: migration.errors.length,
        primaryPath,
        backupPath,
        assetDir,
      });

      return {
        ok: true,
        bytes,
        backupMode,
        migratedAssetCount: migration.migratedCount,
        migratedAssetBytes: migration.migratedBytes,
        assetErrors: migration.errors,
        primaryPath,
        backupPath,
        assetDir,
      };
    } catch (error) {
      const errorMessage = normalizeErrorMessage(error);
      logMessage('persisted config save failed', {
        error: errorMessage,
        primaryPath,
        backupPath,
        assetDir,
      });
      return {
        ok: false,
        error: errorMessage,
        primaryPath,
        backupPath,
        assetDir,
      };
    }
  }

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
