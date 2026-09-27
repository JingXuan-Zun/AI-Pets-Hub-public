import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  createExternalSkillMarketplacePublisherCatalogService,
} = require('../electron/externalSkillMarketplacePublisherCatalogService.cjs');
const {
  readDeliveryConfig,
} = require('../electron/externalSkillMarketplacePublisherCatalogDeliveryService.cjs');

export const MARKETPLACE_DELIVERY_CONFIG_ENV = 'DESKTOP_PET_MARKETPLACE_DELIVERY_CONFIG_PATH';
export const MARKETPLACE_ROOT_KEYS_ENV = 'DESKTOP_PET_MARKETPLACE_ROOT_KEYS_PATH';

export function assertMarketplaceProductionPackagingMode(config, mode) {
  if (!config?.enabled || mode === 'production-fresh') return;
  if (mode === 'incremental') {
    throw new Error('Marketplace production config requires npm run dist:win:production; incremental packaging cannot update the portable EXE.');
  }
  throw new Error('Marketplace production config requires npm run dist:win:production; ordinary fresh builds cannot enroll production trust.');
}

async function requireRegularFile(filePath, label) {
  const file = await lstat(filePath);
  if (!file.isFile() || file.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symbolic-link file.`);
  }
}

export async function loadMarketplaceProductionPackagingConfig({
  env = process.env,
  projectRoot = process.cwd(),
  required = false,
} = {}) {
  const rootKeyRegistryInput = String(env[MARKETPLACE_ROOT_KEYS_ENV] || '').trim();
  const deliveryConfigInput = String(env[MARKETPLACE_DELIVERY_CONFIG_ENV] || '').trim();
  if (!rootKeyRegistryInput && !deliveryConfigInput) {
    if (required) {
      throw new Error(`Production marketplace packaging requires ${MARKETPLACE_ROOT_KEYS_ENV} and ${MARKETPLACE_DELIVERY_CONFIG_ENV}.`);
    }
    return { enabled: false, source: 'bundled-default' };
  }
  if (!rootKeyRegistryInput || !deliveryConfigInput) {
    throw new Error(`Set both ${MARKETPLACE_ROOT_KEYS_ENV} and ${MARKETPLACE_DELIVERY_CONFIG_ENV}.`);
  }

  const rootKeyRegistryPath = path.resolve(projectRoot, rootKeyRegistryInput);
  const deliveryConfigPath = path.resolve(projectRoot, deliveryConfigInput);
  await requireRegularFile(rootKeyRegistryPath, 'Marketplace root key registry');
  await requireRegularFile(deliveryConfigPath, 'Marketplace delivery config');

  const catalogService = createExternalSkillMarketplacePublisherCatalogService({
    rootKeyRegistryPath,
    userDataPath: projectRoot,
  });
  const rootRegistry = catalogService.getRootRegistryStatus();
  if (rootRegistry.status !== 'ready' || rootRegistry.activeKeyCount < 1) {
    throw new Error(rootRegistry.error || 'Marketplace root key registry has no active root key.');
  }
  const delivery = readDeliveryConfig(deliveryConfigPath);
  if (delivery.status !== 'ready' || delivery.enabled !== true) {
    throw new Error(delivery.error || 'Marketplace production delivery config is not enabled and ready.');
  }

  return {
    deliveryConfigPath,
    enabled: true,
    rootKeyRegistryPath,
    source: 'packaged-production',
    summary: {
      activeRootKeyCount: rootRegistry.activeKeyCount,
      minimumSequence: rootRegistry.minimumSequence,
      totalRootKeyCount: rootRegistry.totalKeyCount,
      transportOrigin: new URL(delivery.catalogUrl).origin,
    },
  };
}

export function createMarketplaceProductionExtraResources(config) {
  if (!config?.enabled) return [];
  return [
    {
      from: config.rootKeyRegistryPath,
      to: 'marketplace-production/marketplaceCatalogRootKeys.json',
    },
    {
      from: config.deliveryConfigPath,
      to: 'marketplace-production/marketplaceCatalogDelivery.json',
    },
  ];
}
