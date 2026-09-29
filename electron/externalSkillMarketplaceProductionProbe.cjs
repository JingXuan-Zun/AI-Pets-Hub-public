const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let physicalFs = fs;
try {
  physicalFs = require('original-fs');
} catch {
  // Plain Node smoke tests do not provide Electron's physical filesystem module.
}

const REPORT_KIND = 'external-skill-marketplace-production-probe-report.v1';

function createCheck(id, passed, detail) {
  return { detail, id, status: passed ? 'pass' : 'fail' };
}

function safeErrorCode(value) {
  const code = typeof value === 'string' ? value.trim() : '';
  return /^[a-z0-9][a-z0-9_-]{0,159}$/u.test(code)
    ? code
    : 'marketplace_production_probe_execution_failed';
}

function safeHttpsOrigin(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.origin : null;
  } catch {
    return null;
  }
}

function safeStatus(value) {
  const status = typeof value === 'string' ? value.trim() : '';
  return /^[a-z0-9][a-z0-9_-]{0,79}$/u.test(status) ? status : 'unknown';
}

async function hashRegularFile(filePath, sourceFs = fs) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new Error('marketplace_production_probe_identity_path_missing');
  }
  const pathStat = await sourceFs.promises.lstat(filePath);
  if (!pathStat.isFile() || pathStat.isSymbolicLink()) {
    throw new Error('marketplace_production_probe_identity_file_invalid');
  }
  const noFollowFlag = Number.isInteger(sourceFs.constants.O_NOFOLLOW)
    ? sourceFs.constants.O_NOFOLLOW
    : 0;
  const handle = await sourceFs.promises.open(
    filePath,
    sourceFs.constants.O_RDONLY | noFollowFlag,
  );
  try {
    const openedStat = await handle.stat();
    if (
      !openedStat.isFile()
      || openedStat.dev !== pathStat.dev
      || openedStat.ino !== pathStat.ino
    ) {
      throw new Error('marketplace_production_probe_identity_file_changed');
    }
    const hash = crypto.createHash('sha256');
    await new Promise((resolve, reject) => {
      const stream = handle.createReadStream({ autoClose: false, start: 0 });
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('error', reject);
      stream.on('end', resolve);
    });
    const finalStat = await handle.stat();
    if (
      finalStat.size !== openedStat.size
      || finalStat.mtimeMs !== openedStat.mtimeMs
      || finalStat.dev !== openedStat.dev
      || finalStat.ino !== openedStat.ino
    ) {
      throw new Error('marketplace_production_probe_identity_file_changed');
    }
    return { sha256: hash.digest('hex'), sizeBytes: finalStat.size };
  } finally {
    await handle.close();
  }
}

async function hashBundledAsarFile(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new Error('marketplace_production_probe_identity_path_missing');
  }
  const before = await fs.promises.lstat(filePath);
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new Error('marketplace_production_probe_identity_file_invalid');
  }
  const content = await fs.promises.readFile(filePath);
  const after = await fs.promises.lstat(filePath);
  if (
    !after.isFile()
    || after.isSymbolicLink()
    || after.size !== before.size
    || after.mtimeMs !== before.mtimeMs
    || content.length !== after.size
  ) {
    throw new Error('marketplace_production_probe_identity_file_changed');
  }
  return {
    sha256: crypto.createHash('sha256').update(content).digest('hex'),
    sizeBytes: content.length,
  };
}

function summarizeDelivery(result) {
  const digest = typeof result?.catalogDigest === 'string'
    && /^[a-f0-9]{64}$/u.test(result.catalogDigest)
    ? result.catalogDigest
    : null;
  return {
    catalogDigest: digest,
    error: result?.error ? safeErrorCode(result.error) : null,
    expiresAt: typeof result?.expiresAt === 'string' && Number.isFinite(Date.parse(result.expiresAt))
      ? result.expiresAt
      : null,
    httpStatus: Number.isSafeInteger(result?.httpStatus) ? result.httpStatus : null,
    ok: result?.ok === true,
    publisherCount: Number.isSafeInteger(result?.publisherCount) ? result.publisherCount : 0,
    sequence: Number.isSafeInteger(result?.sequence) ? result.sequence : null,
    status: safeStatus(result?.status),
    totalBytes: Number.isSafeInteger(result?.totalBytes) ? result.totalBytes : 0,
    transportOrigin: safeHttpsOrigin(result?.transportOrigin),
  };
}

function writeReport(outputPath, report) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const tempPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, outputPath);
}

function isExternalSkillMarketplaceProductionProbeEnabled(env = process.env) {
  return env.DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_ENABLE === '1';
}

async function runExternalSkillMarketplaceProductionProbe(options = {}) {
  const env = options.env || process.env;
  const outputValue = typeof env.DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_REPORT === 'string'
    ? env.DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_REPORT.trim()
    : '';
  if (!outputValue) throw new Error('marketplace_production_probe_report_path_missing');
  const outputPath = path.resolve(outputValue);
  const checks = [];
  let buildIdentity = { appAsarSha256: null, appAsarSizeBytes: 0 };
  let configurationIdentity = {
    deliveryConfigSha256: null,
    rootKeyRegistrySha256: null,
  };
  let delivery = summarizeDelivery({ ok: false, status: 'not-attempted' });
  let readiness = null;

  try {
    const appIsPackaged = Boolean(options.app?.isPackaged);
    const configuredProfile = typeof env.DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_USER_DATA_DIR === 'string'
      ? env.DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_USER_DATA_DIR.trim()
      : '';
    const activeProfile = options.app?.getPath?.('userData') || '';
    const isolatedProfile = Boolean(configuredProfile)
      && path.resolve(configuredProfile) === path.resolve(activeProfile);
    checks.push(createCheck('packaged-runtime', appIsPackaged, appIsPackaged
      ? 'Probe is running in an Electron packaged process.'
      : 'Probe is not running in an Electron packaged process.'));
    checks.push(createCheck('isolated-user-data', isolatedProfile, isolatedProfile
      ? 'Probe is using the explicitly configured isolated userData directory.'
      : 'Probe userData does not match the explicit diagnostic profile.'));
    if (!appIsPackaged || !isolatedProfile) {
      throw new Error('marketplace_production_probe_runtime_isolation_required');
    }
    if (!options.deliveryService || typeof options.deliveryService.refreshCatalog !== 'function') {
      throw new Error('marketplace_production_probe_delivery_service_missing');
    }
    if (!options.readinessService || typeof options.readinessService.createReport !== 'function') {
      throw new Error('marketplace_production_probe_readiness_service_missing');
    }

    let artifactIdentityReady = false;
    try {
      const appAsar = await hashRegularFile(options.appAsarPath, physicalFs);
      buildIdentity = {
        appAsarSha256: appAsar.sha256,
        appAsarSizeBytes: appAsar.sizeBytes,
      };
      artifactIdentityReady = true;
      checks.push(createCheck(
        'packaged-artifact-identity',
        true,
        `Packaged app.asar identity is ${appAsar.sha256}.`,
      ));
    } catch (error) {
      checks.push(createCheck(
        'packaged-artifact-identity',
        false,
        safeErrorCode(error?.message || error),
      ));
    }

    let configurationIdentityReady = false;
    try {
      const hashConfigFile = options.productionConfigPaths?.configSource === 'bundled-default'
        ? hashBundledAsarFile
        : (filePath) => hashRegularFile(filePath, physicalFs);
      const [rootRegistry, deliveryConfig] = await Promise.all([
        hashConfigFile(options.productionConfigPaths?.rootKeyRegistryPath),
        hashConfigFile(options.productionConfigPaths?.deliveryConfigPath),
      ]);
      configurationIdentity = {
        deliveryConfigSha256: deliveryConfig.sha256,
        rootKeyRegistrySha256: rootRegistry.sha256,
      };
      configurationIdentityReady = true;
      checks.push(createCheck(
        'production-config-identity',
        true,
        'Root registry and delivery configuration identities were recorded.',
      ));
    } catch (error) {
      checks.push(createCheck(
        'production-config-identity',
        false,
        safeErrorCode(error?.message || error),
      ));
    }

    const preflight = options.readinessService.createReport();
    const packagedConfiguration = preflight.configSource === 'packaged-production';
    const rootsReady = preflight.rootRegistry?.status === 'ready'
      && preflight.rootRegistry?.activeKeyCount > 0;
    const deliveryReady = preflight.delivery?.status === 'ready'
      && preflight.delivery?.enabled === true
      && Boolean(safeHttpsOrigin(preflight.delivery?.transportOrigin));
    checks.push(createCheck('packaged-production-config', packagedConfiguration, packagedConfiguration
      ? 'Runtime selected the fixed packaged production configuration.'
      : 'Runtime is using the bundled disabled marketplace configuration.'));
    checks.push(createCheck('catalog-root-registry', rootsReady, rootsReady
      ? `${preflight.rootRegistry.activeKeyCount} active production root key(s) are enrolled.`
      : 'No ready active production root key is enrolled.'));
    checks.push(createCheck('catalog-delivery-config', deliveryReady, deliveryReady
      ? `HTTPS delivery is configured for ${safeHttpsOrigin(preflight.delivery.transportOrigin)}.`
      : 'Production HTTPS catalog delivery is not ready.'));

    if (
      artifactIdentityReady
      && configurationIdentityReady
      && packagedConfiguration
      && rootsReady
      && deliveryReady
    ) {
      delivery = summarizeDelivery(await options.deliveryService.refreshCatalog());
    } else {
      delivery = summarizeDelivery({ error: 'marketplace_production_probe_preflight_failed', ok: false, status: 'blocked' });
    }
    const deliveryPassed = delivery.ok && delivery.status === 'provisioned';
    checks.push(createCheck('catalog-delivery', deliveryPassed, deliveryPassed
      ? `Verified catalog sequence ${delivery.sequence} was provisioned from ${delivery.transportOrigin}.`
      : delivery.error || 'Catalog delivery did not provision a verified catalog.'));

    readiness = options.readinessService.createReport();
    const operationallyReady = readiness.configSource === 'packaged-production'
      && readiness.status === 'ready-disabled'
      && readiness.operationalConfigurationReady === true;
    checks.push(createCheck('production-readiness', operationallyReady, operationallyReady
      ? 'Production configuration and active catalog are ready while release remains disabled.'
      : `Production readiness status is ${readiness.status || 'unknown'}.`));
    const marketDisabled = readiness.marketReleaseAllowed === false
      && readiness.marketReleaseStatus === 'disabled';
    checks.push(createCheck('market-release-disabled', marketDisabled, marketDisabled
      ? 'Marketplace release remains explicitly disabled.'
      : 'Marketplace release disablement evidence is incomplete.'));
  } catch (error) {
    checks.push(createCheck('probe-execution', false, safeErrorCode(error?.message || error)));
  }

  const generatedAt = new Date().toISOString();
  const report = {
    buildIdentity,
    checks,
    configurationIdentity,
    delivery,
    generatedAt,
    kind: REPORT_KIND,
    marketReleaseAllowed: readiness?.marketReleaseAllowed ?? null,
    ok: checks.length === 10 && checks.every((check) => check.status === 'pass'),
    readiness,
    runtime: {
      appIsPackaged: Boolean(options.app?.isPackaged),
      arch: process.arch,
      electronVersion: process.versions.electron ?? null,
      platform: process.platform,
      version: options.app?.getVersion?.() ?? null,
    },
    summary: {
      failed: checks.filter((check) => check.status === 'fail').length,
      passed: checks.filter((check) => check.status === 'pass').length,
      total: checks.length,
    },
    version: 1,
  };
  writeReport(outputPath, report);
  return report;
}

module.exports = {
  isExternalSkillMarketplaceProductionProbeEnabled,
  runExternalSkillMarketplaceProductionProbe,
};
