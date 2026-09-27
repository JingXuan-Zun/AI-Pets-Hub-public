import {
  loadMarketplaceProductionPackagingConfig,
} from './marketplace-production-packaging-config.mjs';

try {
  const config = await loadMarketplaceProductionPackagingConfig({
    required: process.argv.includes('--require'),
  });
  console.log(JSON.stringify({
    enabled: config.enabled,
    source: config.source,
    summary: config.summary ?? null,
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
