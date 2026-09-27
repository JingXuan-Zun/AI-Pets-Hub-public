const assert = require('assert').strict;
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  applyExternalSkillMarketplaceProductionProbeArgs,
} = require('../electron/externalSkillMarketplaceProductionProbeArgs.cjs');
const {
  isExternalSkillMarketplaceProductionProbeEnabled,
  runExternalSkillMarketplaceProductionProbe,
} = require('../electron/externalSkillMarketplaceProductionProbe.cjs');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-marketplace-production-probe-'));
const reportPath = path.join(tempRoot, 'evidence', 'report.json');
const appAsarPath = path.join(tempRoot, 'app.asar');
const deliveryConfigPath = path.join(tempRoot, 'delivery.json');
const rootKeyRegistryPath = path.join(tempRoot, 'roots.json');
const productionConfigPaths = {
  configSource: 'packaged-production',
  deliveryConfigPath,
  rootKeyRegistryPath,
};

function createReadinessService(
  isDelivered,
  configSource = 'packaged-production',
  marketReleaseAllowed = false,
) {
  return {
    createReport() {
      const delivered = isDelivered();
      return {
        activeCatalog: {
          expiresAt: delivered ? '2026-08-29T00:00:00.000Z' : null,
          publisherCount: delivered ? 1 : 0,
          rootKeyId: delivered ? 'market-root-v1' : null,
          sequence: delivered ? 3 : null,
          status: delivered ? 'ready' : 'missing',
        },
        checks: [],
        configSource,
        delivery: {
          enabled: true,
          maxResponseBytes: 262144,
          requestTimeoutMs: 10000,
          status: 'ready',
          transportOrigin: 'https://catalog.example.test',
        },
        generatedAt: '2026-07-29T00:00:00.000Z',
        issueCodes: ['marketplace-release-disabled'],
        kind: 'external-skill-marketplace-production-readiness-report.v1',
        marketReleaseAllowed,
        marketReleaseStatus: marketReleaseAllowed ? 'enabled' : 'disabled',
        ok: true,
        operationalConfigurationReady: delivered,
        rootRegistry: {
          activeKeyCount: 1,
          minimumSequence: 3,
          revokedKeyCount: 0,
          status: 'ready',
          totalKeyCount: 1,
        },
        status: delivered ? 'ready-disabled' : 'incomplete',
        version: 1,
      };
    },
  };
}

async function run() {
  try {
    fs.writeFileSync(appAsarPath, 'packaged-app-identity', 'utf8');
    fs.writeFileSync(deliveryConfigPath, '{"enabled":true}', 'utf8');
    fs.writeFileSync(rootKeyRegistryPath, '{"keys":["public-root"]}', 'utf8');
    const parsedEnv = {};
    const argsResult = applyExternalSkillMarketplaceProductionProbeArgs(parsedEnv, [
      'AI Desktop Pet.exe',
      '--desktop-pet-marketplace-production-probe-enable',
      '--desktop-pet-marketplace-production-probe-headless',
      `--desktop-pet-marketplace-production-probe-report=${reportPath}`,
      `--desktop-pet-marketplace-production-probe-user-data-dir=${tempRoot}`,
    ]);
    assert.equal(argsResult.applied.length, 4);
    assert.equal(isExternalSkillMarketplaceProductionProbeEnabled(parsedEnv), true);

    let delivered = false;
    let refreshCount = 0;
    const deliveryService = {
      async refreshCatalog() {
        refreshCount += 1;
        delivered = true;
        return {
          catalogDigest: 'a'.repeat(64),
          catalogUrl: 'https://catalog.example.test/private/v1/publishers.json',
          expiresAt: '2026-08-29T00:00:00.000Z',
          ok: true,
          publisherCount: 1,
          sequence: 3,
          status: 'provisioned',
          totalBytes: 2048,
          transportOrigin: 'https://catalog.example.test',
        };
      },
    };
    const report = await runExternalSkillMarketplaceProductionProbe({
      app: {
        getPath: (name) => name === 'userData' ? tempRoot : '',
        getVersion: () => '0.0.1-test',
        isPackaged: true,
      },
      appAsarPath,
      deliveryService,
      env: parsedEnv,
      productionConfigPaths,
      readinessService: createReadinessService(() => delivered),
    });
    assert.equal(report.ok, true, JSON.stringify(report));
    assert.equal(report.summary.failed, 0);
    assert.equal(report.summary.total, 10);
    assert.equal(
      report.buildIdentity.appAsarSha256,
      crypto.createHash('sha256').update('packaged-app-identity').digest('hex'),
    );
    assert.equal(report.configurationIdentity.deliveryConfigSha256.length, 64);
    assert.equal(report.configurationIdentity.rootKeyRegistrySha256.length, 64);
    assert.equal(report.delivery.sequence, 3);
    assert.equal(report.readiness.status, 'ready-disabled');
    assert.equal(report.marketReleaseAllowed, false);
    assert.equal(refreshCount, 1);
    const reportText = fs.readFileSync(reportPath, 'utf8');
    assert.equal(reportText.includes(tempRoot), false);
    assert.equal(reportText.includes('/private/v1/publishers.json'), false);
    assert.equal(reportText.includes('PRIVATE KEY'), false);

    let blockedRefreshCount = 0;
    const blockedPath = path.join(tempRoot, 'blocked.json');
    const blocked = await runExternalSkillMarketplaceProductionProbe({
      app: {
        getPath: () => path.join(tempRoot, 'default-profile'),
        getVersion: () => '0.0.1-test',
        isPackaged: true,
      },
      appAsarPath,
      deliveryService: { refreshCatalog: async () => { blockedRefreshCount += 1; } },
      env: {
        DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_REPORT: blockedPath,
        DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_USER_DATA_DIR: path.join(tempRoot, 'different-profile'),
      },
      productionConfigPaths,
      readinessService: createReadinessService(() => false),
    });
    assert.equal(blocked.ok, false);
    assert.equal(blockedRefreshCount, 0);
    assert.equal(blocked.checks.find((check) => check.id === 'isolated-user-data').status, 'fail');

    const bundledPath = path.join(tempRoot, 'bundled.json');
    let bundledRefreshCount = 0;
    const bundled = await runExternalSkillMarketplaceProductionProbe({
      app: { getPath: () => tempRoot, getVersion: () => '0.0.1-test', isPackaged: true },
      appAsarPath,
      deliveryService: { refreshCatalog: async () => { bundledRefreshCount += 1; } },
      env: {
        DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_REPORT: bundledPath,
        DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_USER_DATA_DIR: tempRoot,
      },
      productionConfigPaths: { ...productionConfigPaths, configSource: 'bundled-default' },
      readinessService: createReadinessService(() => false, 'bundled-default'),
    });
    assert.equal(bundled.ok, false);
    assert.equal(bundledRefreshCount, 0);
    assert.equal(bundled.checks.find((check) => check.id === 'packaged-production-config').status, 'fail');

    const missingConfigPath = path.join(tempRoot, 'missing-config.json');
    let missingConfigRefreshCount = 0;
    const missingConfig = await runExternalSkillMarketplaceProductionProbe({
      app: { getPath: () => tempRoot, getVersion: () => '0.0.1-test', isPackaged: true },
      appAsarPath,
      deliveryService: { refreshCatalog: async () => { missingConfigRefreshCount += 1; } },
      env: {
        DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_REPORT: missingConfigPath,
        DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_USER_DATA_DIR: tempRoot,
      },
      productionConfigPaths: {
        deliveryConfigPath: path.join(tempRoot, 'missing-delivery.json'),
        rootKeyRegistryPath,
      },
      readinessService: createReadinessService(() => false),
    });
    assert.equal(missingConfig.ok, false);
    assert.equal(missingConfigRefreshCount, 0);
    assert.equal(
      missingConfig.checks.find((check) => check.id === 'production-config-identity').status,
      'fail',
    );
    assert.equal(missingConfig.delivery.status, 'blocked');

    const invalidConfigPath = path.join(tempRoot, 'invalid-config.json');
    let invalidConfigRefreshCount = 0;
    const invalidConfig = await runExternalSkillMarketplaceProductionProbe({
      app: { getPath: () => tempRoot, getVersion: () => '0.0.1-test', isPackaged: true },
      appAsarPath,
      deliveryService: { refreshCatalog: async () => { invalidConfigRefreshCount += 1; } },
      env: {
        DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_REPORT: invalidConfigPath,
        DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_USER_DATA_DIR: tempRoot,
      },
      productionConfigPaths: {
        deliveryConfigPath: tempRoot,
        rootKeyRegistryPath,
      },
      readinessService: createReadinessService(() => false),
    });
    assert.equal(invalidConfig.ok, false);
    assert.equal(invalidConfigRefreshCount, 0);
    assert.equal(
      invalidConfig.checks.find((check) => check.id === 'production-config-identity').status,
      'fail',
    );
    assert.equal(invalidConfig.delivery.status, 'blocked');

    let unsafeDelivered = false;
    const unsafe = await runExternalSkillMarketplaceProductionProbe({
      app: { getPath: () => tempRoot, getVersion: () => '0.0.1-test', isPackaged: true },
      appAsarPath,
      deliveryService: {
        async refreshCatalog() {
          unsafeDelivered = true;
          return {
            catalogDigest: 'b'.repeat(64),
            expiresAt: '2026-08-29T00:00:00.000Z',
            ok: true,
            publisherCount: 1,
            sequence: 4,
            status: 'provisioned',
            totalBytes: 2048,
            transportOrigin: 'https://catalog.example.test',
          };
        },
      },
      env: {
        DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_REPORT: path.join(tempRoot, 'unsafe.json'),
        DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_USER_DATA_DIR: tempRoot,
      },
      productionConfigPaths,
      readinessService: createReadinessService(() => unsafeDelivered, 'packaged-production', true),
    });
    assert.equal(unsafe.ok, false);
    assert.equal(unsafe.marketReleaseAllowed, true);
    assert.equal(unsafe.checks.find((check) => check.id === 'market-release-disabled').status, 'fail');

    const mainSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf8');
    const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf8');
    assert.match(mainSource, /shouldRunPackagedMarketplaceProductionProbe/u);
    assert.match(mainSource, /runExternalSkillMarketplaceProductionProbe/u);
    assert.match(mainSource, /packagedProfileRoot[\s\S]*runtime-logs/u);
    assert.match(mainSource, /app\.exit\(report\.ok \? 0 : 1\)/u);
    assert.match(mainSource, /packaged marketplace production probe failed[\s\S]*app\.exit\(1\)/u);
    assert.equal(preloadSource.includes('MarketplaceProductionProbe'), false);
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
}

run().then(() => console.log('agent skill marketplace production probe smoke passed')).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
