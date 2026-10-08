const { externalizeConfigImageDataUrls } = require('./persistedConfigImageAssets.cjs');
const { hasPlaintextCredentials } = require('./configCredentials.cjs');

function createPersistedConfigMigrations(context) {
  const { primaryPath, backupPath, assetDir, sequenceAssetDir, readPersistedConfigFile, save, logMessage } = context;

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

  function migrateCredentials(config) {
    const files = [primaryPath, backupPath].map(readPersistedConfigFile);
    if (files.some((result) => result.ok && hasPlaintextCredentials(result.config))) {
      const result = save(config);
      if (!result.ok) throw new Error(result.error);
    }
  }

  return { migrateLoadedConfig, migrateCredentials };
}

module.exports = { createPersistedConfigMigrations };
