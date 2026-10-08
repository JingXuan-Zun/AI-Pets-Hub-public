const { normalizeErrorMessage } = require('./persistedConfigFiles.cjs');
const { modelCredentialReferences } = require('./configCredentials.cjs');

function loadedPrimary(context, primaryResult) {
  const { primaryPath, backupPath, assetDir, migrateCredentials, migrateLoadedConfig, logMessage } = context;
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

function restoredBackup(context, primaryResult, backupResult) {
  const { primaryPath, backupPath, assetDir, credentials, writeTextFileSafely, buildPersistedPayload, migrateCredentials, migrateLoadedConfig, logMessage } = context;
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

function missingConfig(context, primaryResult, backupResult) {
  const { primaryPath, backupPath, logMessage } = context;
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

function createPersistedConfigLoader(context) {
  const { primaryPath, backupPath, credentials, readPersistedConfigFile } = context;

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

  function loadInternal() {
    const primaryResult = readConfig(primaryPath);
    if (primaryResult.ok) return loadedPrimary(context, primaryResult);
    const backupResult = readConfig(backupPath);
    if (backupResult.ok) return restoredBackup(context, primaryResult, backupResult);
    return missingConfig(context, primaryResult, backupResult);
  }

  return { readConfig, load };
}

module.exports = { createPersistedConfigLoader };
