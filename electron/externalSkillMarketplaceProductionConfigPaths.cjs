const fs = require('fs');
const path = require('path');

const DELIVERY_FILE_NAME = 'marketplaceCatalogDelivery.json';
const ROOT_KEYS_FILE_NAME = 'marketplaceCatalogRootKeys.json';

function resolveExternalSkillMarketplaceProductionConfigPaths({
  bundledDirectory = __dirname,
  resourcesPath = process.resourcesPath,
} = {}) {
  const productionDirectory = path.join(path.resolve(resourcesPath), 'marketplace-production');
  if (fs.existsSync(productionDirectory)) {
    return {
      configSource: 'packaged-production',
      deliveryConfigPath: path.join(productionDirectory, DELIVERY_FILE_NAME),
      rootKeyRegistryPath: path.join(productionDirectory, ROOT_KEYS_FILE_NAME),
    };
  }
  return {
    configSource: 'bundled-default',
    deliveryConfigPath: path.join(bundledDirectory, DELIVERY_FILE_NAME),
    rootKeyRegistryPath: path.join(bundledDirectory, ROOT_KEYS_FILE_NAME),
  };
}

module.exports = {
  DELIVERY_FILE_NAME,
  ROOT_KEYS_FILE_NAME,
  resolveExternalSkillMarketplaceProductionConfigPaths,
};
