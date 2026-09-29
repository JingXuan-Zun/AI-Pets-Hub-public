const REPORT_KIND = 'external-skill-marketplace-production-readiness-report.v1';

function createCheck(id, status, detail) {
  return { detail, id, status };
}

function createExternalSkillMarketplaceProductionReadinessService({
  catalogService,
  configSource = 'bundled-default',
  deliveryService,
  now = Date.now,
} = {}) {
  if (!catalogService || typeof catalogService.getRootRegistryStatus !== 'function') {
    throw new Error('marketplace_catalog_service_missing');
  }
  if (!deliveryService || typeof deliveryService.getConfigStatus !== 'function') {
    throw new Error('marketplace_catalog_delivery_service_missing');
  }
  const getNow = typeof now === 'function' ? now : Date.now;

  function createReport() {
    const rootRegistry = catalogService.getRootRegistryStatus();
    const deliveryConfig = deliveryService.getConfigStatus();
    const activeCatalog = catalogService.readActiveCatalog();
    const checks = [];

    const rootInvalid = rootRegistry.status !== 'ready';
    const rootConfigured = rootRegistry.activeKeyCount > 0;
    checks.push(createCheck(
      'catalog-root-registry',
      rootInvalid ? 'fail' : rootConfigured ? 'pass' : 'warning',
      rootInvalid
        ? rootRegistry.error || 'Catalog root registry is unavailable.'
        : rootConfigured
          ? `${rootRegistry.activeKeyCount} active root key(s); minimum sequence ${rootRegistry.minimumSequence}.`
          : 'No active production catalog root key is enrolled.',
    ));

    const deliveryInvalid = deliveryConfig.status === 'unavailable';
    const deliveryConfigured = deliveryConfig.status === 'ready' && deliveryConfig.enabled === true;
    checks.push(createCheck(
      'catalog-delivery-config',
      deliveryInvalid ? 'fail' : deliveryConfigured ? 'pass' : 'warning',
      deliveryInvalid
        ? deliveryConfig.error || 'Catalog delivery configuration is unavailable.'
        : deliveryConfigured
          ? `HTTPS delivery is configured for ${new URL(deliveryConfig.catalogUrl).origin}.`
          : 'Production catalog delivery is disabled.',
    ));

    const catalogReady = activeCatalog.ok === true;
    const catalogExpected = rootConfigured && deliveryConfigured;
    checks.push(createCheck(
      'active-publisher-catalog',
      catalogReady ? 'pass' : catalogExpected ? 'fail' : 'warning',
      catalogReady
        ? `Catalog sequence ${activeCatalog.catalog.sequence} has ${activeCatalog.catalog.publishers.length} publisher(s).`
        : activeCatalog.error || 'No verified active publisher catalog is available.',
    ));
    checks.push(createCheck(
      'marketplace-release-switch',
      'pass',
      'Marketplace release remains hard-disabled.',
    ));

    const structurallyInvalid = rootInvalid || deliveryInvalid;
    const unconfigured = rootRegistry.totalKeyCount === 0 || deliveryConfig.status === 'disabled';
    const operationalConfigurationReady = rootConfigured && deliveryConfigured && catalogReady;
    const status = structurallyInvalid
      ? 'invalid'
      : unconfigured
        ? 'not-configured'
        : operationalConfigurationReady
          ? 'ready-disabled'
          : 'incomplete';
    const transportOrigin = deliveryConfigured ? new URL(deliveryConfig.catalogUrl).origin : null;

    return {
      activeCatalog: {
        expiresAt: catalogReady ? activeCatalog.catalog.expiresAt : null,
        publisherCount: catalogReady ? activeCatalog.catalog.publishers.length : 0,
        rootKeyId: catalogReady ? activeCatalog.rootKeyId : null,
        sequence: catalogReady ? activeCatalog.catalog.sequence : null,
        status: activeCatalog.status,
      },
      checks,
      configSource: configSource === 'packaged-production' ? 'packaged-production' : 'bundled-default',
      delivery: {
        enabled: deliveryConfigured,
        maxResponseBytes: deliveryConfigured ? deliveryConfig.maxResponseBytes : null,
        requestTimeoutMs: deliveryConfigured ? deliveryConfig.requestTimeoutMs : null,
        status: deliveryConfig.status,
        transportOrigin,
      },
      generatedAt: new Date(getNow()).toISOString(),
      issueCodes: [
        'marketplace-release-disabled',
        ...checks.filter((check) => check.status !== 'pass').map((check) => check.id),
      ],
      kind: REPORT_KIND,
      marketReleaseAllowed: false,
      marketReleaseStatus: 'disabled',
      ok: true,
      operationalConfigurationReady,
      rootRegistry: {
        activeKeyCount: rootRegistry.activeKeyCount,
        minimumSequence: rootRegistry.minimumSequence,
        revokedKeyCount: rootRegistry.revokedKeyCount,
        status: rootRegistry.status,
        totalKeyCount: rootRegistry.totalKeyCount,
      },
      status,
      version: 1,
    };
  }

  function exportReport() {
    const report = createReport();
    return {
      fileName: `external-skill-marketplace-production-readiness-${report.generatedAt.replace(/[:.]/gu, '-')}.json`,
      mimeType: 'application/json',
      ok: true,
      text: `${JSON.stringify(report, null, 2)}\n`,
    };
  }

  return { createReport, exportReport };
}

module.exports = { createExternalSkillMarketplaceProductionReadinessService };
