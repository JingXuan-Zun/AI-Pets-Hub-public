import { DEFAULT_CONFIG, resolveModelUrlForPersistence } from './constants';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from './frontendRuntimeLogger';
import { normalizePetConfig } from './petConfigNormalization';
import { type PetConfig } from './types';

const PERSISTED_PET_CONFIG_KEY = 'desktop-pet:persisted-config:v1';

type DesktopPersistedConfigLoadResult = DesktopPetPersistedConfigLoadResultLike | null;
type DesktopPersistedConfigSaveResult = DesktopPetPersistedConfigSaveResultLike | null;

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function canUseDesktopPersistedConfigLoadStore() {
  return typeof window !== 'undefined'
    && Boolean(window.desktopPetShell?.desktopMode)
    && typeof window.desktopPetShell?.loadPersistedConfigSync === 'function';
}

function canUseDesktopPersistedConfigSaveStore() {
  return typeof window !== 'undefined'
    && Boolean(window.desktopPetShell?.desktopMode)
    && typeof window.desktopPetShell?.savePersistedConfig === 'function';
}

function buildPersistedPetConfig(config: PetConfig) {
  const normalizedConfig = normalizePetConfig(config);

  return normalizePetConfig({
    ...normalizedConfig,
    modelUrl: resolveModelUrlForPersistence(
      normalizedConfig.modelUrl,
      normalizedConfig.customModelPresets,
    ),
    companionPets: normalizedConfig.companionPets.map((pet) => ({
      ...pet,
      modelUrl: resolveModelUrlForPersistence(
        pet.modelUrl,
        normalizedConfig.customModelPresets,
      ),
      stats: { ...DEFAULT_CONFIG.stats },
      currentAction: DEFAULT_CONFIG.currentAction,
    })),
    stats: { ...DEFAULT_CONFIG.stats },
    currentAction: DEFAULT_CONFIG.currentAction,
  });
}

function parsePersistedConfig(rawConfig: unknown, source: string) {
  try {
    const normalizedConfig = normalizePetConfig(rawConfig as Partial<PetConfig>);
    return normalizedConfig;
  } catch (error) {
    pushFrontendRuntimeError('config', `persisted config normalize failed (${source})`, error);
    return null;
  }
}

function loadFromLocalStorage() {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const rawConfig = window.localStorage.getItem(PERSISTED_PET_CONFIG_KEY);
    if (!rawConfig) {
      return null;
    }

    const parsedConfig = JSON.parse(rawConfig) as Partial<PetConfig>;
    const normalizedConfig = parsePersistedConfig(parsedConfig, 'localStorage');
    if (!normalizedConfig) {
      return null;
    }

    return {
      config: normalizedConfig,
      rawLength: rawConfig.length,
    };
  } catch (error) {
    pushFrontendRuntimeError('config', 'localStorage persisted config load failed', error);
    return null;
  }
}

function writeToLocalStorage(config: PetConfig) {
  if (!canUseLocalStorage()) {
    return false;
  }

  try {
    window.localStorage.setItem(PERSISTED_PET_CONFIG_KEY, JSON.stringify(config));
    return true;
  } catch (error) {
    pushFrontendRuntimeError('config', 'localStorage persisted config save failed', error);
    return false;
  }
}

function loadFromDesktopPersistedConfigStore(): DesktopPersistedConfigLoadResult {
  if (!canUseDesktopPersistedConfigLoadStore()) {
    return null;
  }

  try {
    return window.desktopPetShell?.loadPersistedConfigSync?.() ?? null;
  } catch (error) {
    pushFrontendRuntimeError('config', 'desktop persisted config load bridge failed', error);
    return {
      ok: false,
      source: 'bridge-error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function saveToDesktopPersistedConfigStore(config: PetConfig): Promise<DesktopPersistedConfigSaveResult> {
  if (!canUseDesktopPersistedConfigSaveStore()) {
    return null;
  }

  try {
    return await window.desktopPetShell?.savePersistedConfig?.(config) ?? null;
  } catch (error) {
    pushFrontendRuntimeError('config', 'desktop persisted config save bridge failed', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function loadPersistedPetConfig() {
  const defaultConfig = normalizePetConfig(DEFAULT_CONFIG);
  const desktopLoadResult = loadFromDesktopPersistedConfigStore();

  if (desktopLoadResult?.ok && desktopLoadResult.config) {
    const normalizedConfig = parsePersistedConfig(
      desktopLoadResult.config,
      desktopLoadResult.source ?? 'desktop-file',
    );
    if (normalizedConfig) {
      if (desktopLoadResult.recoveredFromBackup) {
        pushFrontendRuntimeLog('config', 'desktop persisted config restored from backup', {
          source: desktopLoadResult.source ?? 'backup-file',
          repairedPrimary: Boolean(desktopLoadResult.repairedPrimary),
          repairError: desktopLoadResult.repairError ?? null,
          primaryPath: desktopLoadResult.primaryPath ?? null,
          backupPath: desktopLoadResult.backupPath ?? null,
          primaryError: desktopLoadResult.primaryError ?? null,
        });
      }

      return normalizedConfig;
    }
  }

  const localStorageResult = loadFromLocalStorage();
  if (localStorageResult?.config) {
    const desktopStoreGenuinelyEmpty = desktopLoadResult == null
      || (
        desktopLoadResult.primaryError === 'missing-file'
        && desktopLoadResult.backupError === 'missing-file'
      );

    pushFrontendRuntimeLog('config', 'loaded persisted config from localStorage fallback', {
      rawLength: localStorageResult.rawLength,
      desktopStoreState: desktopLoadResult?.source ?? 'unavailable',
      primaryError: desktopLoadResult?.primaryError ?? null,
      backupError: desktopLoadResult?.backupError ?? null,
    });

    // Only write the localStorage snapshot back to the desktop store when it
    // was genuinely absent. A transient read error (EACCES/EBUSY/truncated
    // JSON) must not overwrite a still-valid primary with stale localStorage
    // data — that is a silent data-rollback path.
    if (
      desktopStoreGenuinelyEmpty
      && canUseDesktopPersistedConfigSaveStore()
    ) {
      void saveToDesktopPersistedConfigStore(buildPersistedPetConfig(localStorageResult.config))
        .then((migrationResult) => {
          pushFrontendRuntimeLog('config', 'migrated localStorage config into desktop persisted store', {
            ok: Boolean(migrationResult?.ok),
            bytes: migrationResult?.bytes ?? 0,
            backupMode: migrationResult?.backupMode ?? 'unknown',
            error: migrationResult?.error ?? null,
            primaryPath: migrationResult?.primaryPath ?? null,
          });
        });
    }

    return localStorageResult.config;
  }

  if (desktopLoadResult && !desktopLoadResult.ok) {
    pushFrontendRuntimeLog('config', 'desktop persisted config unavailable; using default config', {
      source: desktopLoadResult.source ?? 'missing',
      primaryError: desktopLoadResult.primaryError ?? null,
      backupError: desktopLoadResult.backupError ?? null,
      primaryPath: desktopLoadResult.primaryPath ?? null,
      backupPath: desktopLoadResult.backupPath ?? null,
      error: desktopLoadResult.error ?? null,
    });
  }

  return defaultConfig;
}

export async function persistPetConfig(config: PetConfig) {
  const persistedConfig = buildPersistedPetConfig(config);

  if (canUseDesktopPersistedConfigSaveStore()) {
    const desktopSaveResult = await saveToDesktopPersistedConfigStore(persistedConfig);
    if (desktopSaveResult?.ok) {
      return true;
    }

    pushFrontendRuntimeLog('config', 'desktop persisted config save failed', {
      error: desktopSaveResult?.error ?? 'unknown',
      primaryPath: desktopSaveResult?.primaryPath ?? null,
      backupPath: desktopSaveResult?.backupPath ?? null,
    });
    return false;
  }

  return writeToLocalStorage(persistedConfig);
}
