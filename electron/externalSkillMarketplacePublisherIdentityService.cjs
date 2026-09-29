const {
  createExternalSkillMarketplacePublisherCatalogService,
} = require('./externalSkillMarketplacePublisherCatalogService.cjs');

const ASSESSMENT_KIND = 'external-skill-marketplace-publisher-assessment.v1';
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@-]{0,159}$/u;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function createExternalSkillMarketplacePublisherIdentityService({
  userDataPath,
  catalogService,
  rootKeyRegistryPath,
  log,
  now,
} = {}) {
  if (typeof userDataPath !== 'string' || !userDataPath.trim()) throw new Error('user_data_path_missing');
  const catalog = catalogService ?? createExternalSkillMarketplacePublisherCatalogService({
    log,
    now,
    rootKeyRegistryPath,
    userDataPath,
  });
  const initialization = catalog.initialize();
  if (!initialization.ok) {
    log?.('Marketplace publisher catalog initialization incomplete', {
      provisioningStatus: initialization.provisioning?.status ?? 'unknown',
      recoveryStatus: initialization.recovery?.status ?? 'unknown',
    });
  }

  function assessArtifact(artifact = {}) {
    const verification = isRecord(artifact.signatureVerification) ? artifact.signatureVerification : {};
    const publisherId = getString(verification.publisherId);
    const keyId = getString(verification.keyId);
    const keyFingerprint = getString(verification.keyFingerprint).toLowerCase();
    const activeCatalog = catalog.readActiveCatalog();
    const issueCodes = [];
    if (!publisherId) issueCodes.push('marketplace-publisher-id-missing');
    if (!ID_PATTERN.test(keyId)) issueCodes.push('marketplace-publisher-key-id-missing');
    if (!FINGERPRINT_PATTERN.test(keyFingerprint)) issueCodes.push('marketplace-publisher-key-fingerprint-missing');
    if (activeCatalog.status === 'missing') issueCodes.push('marketplace-publisher-registry-missing');
    if (activeCatalog.status === 'expired') issueCodes.push('marketplace-publisher-catalog-expired');
    if (activeCatalog.status === 'unavailable') issueCodes.push('marketplace-publisher-catalog-root-unavailable');
    if (activeCatalog.status === 'invalid') issueCodes.push('marketplace-publisher-registry-invalid');

    const trustedPublisher = publisherId && activeCatalog.ok
      ? activeCatalog.catalog.publishers.find((publisher) => publisher.publisherId === publisherId) ?? null
      : null;
    if (publisherId && activeCatalog.ok && !trustedPublisher) issueCodes.push('marketplace-publisher-not-trusted');
    if (trustedPublisher?.status === 'revoked') issueCodes.push('marketplace-publisher-revoked');
    if (trustedPublisher && trustedPublisher.keyId !== keyId) issueCodes.push('marketplace-publisher-key-id-mismatch');
    if (trustedPublisher && trustedPublisher.keyFingerprint !== keyFingerprint) {
      issueCodes.push('marketplace-publisher-key-fingerprint-mismatch');
    }

    return {
      catalogSequence: activeCatalog.ok ? activeCatalog.catalog.sequence : null,
      issueCodes: [...new Set(issueCodes)],
      keyFingerprint: FINGERPRINT_PATTERN.test(keyFingerprint) ? keyFingerprint : null,
      keyId: ID_PATTERN.test(keyId) ? keyId : null,
      kind: ASSESSMENT_KIND,
      publisherId: publisherId || null,
      registryStatus: activeCatalog.status,
      rootKeyId: activeCatalog.ok ? activeCatalog.rootKeyId : null,
      status: issueCodes.length ? 'blocked' : 'verified',
    };
  }

  return {
    assessArtifact,
    getCatalogInitialization: () => initialization,
    getPaths: () => ({ marketplacePublisherRegistryPath: catalog.getPaths().activeCatalogPath }),
  };
}

module.exports = { createExternalSkillMarketplacePublisherIdentityService };
