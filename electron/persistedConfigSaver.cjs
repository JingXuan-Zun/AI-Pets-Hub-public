const { ensureDirectory, normalizeErrorMessage } = require('./persistedConfigFiles.cjs');
const { externalizeConfigImageDataUrls } = require('./persistedConfigImageAssets.cjs');

function writeConfigPayload(context, migration) {
  const { primaryPath, backupPath, readConfig, credentials, buildPersistedPayload, writeTextFileSafely } = context;
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
  return { backupMode, serializedPayload };
}

function savedConfig(context, migration, backupMode, serializedPayload) {
  const { primaryPath, backupPath, assetDir, logMessage } = context;
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
}

function failedConfig(context, error) {
  const { primaryPath, backupPath, assetDir, logMessage } = context;
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

function createPersistedConfigSaver(context) {
  const { storeDir, assetDir, sequenceAssetDir } = context;

  function save(config) {
    try {
      ensureDirectory(storeDir);
      const migration = externalizeConfigImageDataUrls(config, assetDir, sequenceAssetDir);
      const { backupMode, serializedPayload } = writeConfigPayload(context, migration);
      return savedConfig(context, migration, backupMode, serializedPayload);
    } catch (error) {
      return failedConfig(context, error);
    }
  }

  return save;
}

module.exports = { createPersistedConfigSaver };
