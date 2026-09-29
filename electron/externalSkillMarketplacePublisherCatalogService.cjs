const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CATALOG_KIND = 'external-skill-marketplace-publisher-catalog.v1';
const ENVELOPE_KIND = 'external-skill-marketplace-publisher-catalog-envelope.v1';
const PAYLOAD_KIND = 'external-skill-marketplace-publisher-catalog-signature-payload.v1';
const ROOT_REGISTRY_KIND = 'external-skill-marketplace-catalog-root-key-registry.v1';
const STATE_KIND = 'external-skill-marketplace-publisher-catalog-state.v1';
const SIGNATURE_DIGEST = 'sha256:canonical-marketplace-publisher-catalog-v1';
const MAX_CATALOG_BYTES = 256 * 1024;
const MAX_CATALOG_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_PUBLISHERS = 64;
const MAX_ROOT_KEYS = 8;
const MAX_SNAPSHOTS = 4;
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@-]{0,159}$/u;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeJsonValue(value) {
  if (Array.isArray(value)) return value.map(normalizeJsonValue);
  if (!isRecord(value)) return value;
  return Object.keys(value).filter((key) => value[key] !== undefined).sort((a, b) => a.localeCompare(b))
    .reduce((result, key) => ({ ...result, [key]: normalizeJsonValue(value[key]) }), {});
}

function createCanonicalPublisherCatalogPayload(catalog) {
  return JSON.stringify(normalizeJsonValue({ catalog, kind: PAYLOAD_KIND }));
}

function normalizePublisher(value) {
  if (!isRecord(value)) return null;
  const publisher = {
    keyFingerprint: getString(value.keyFingerprint).toLowerCase(),
    keyId: getString(value.keyId),
    publisherId: getString(value.publisherId),
    status: value.status === 'active' || value.status === 'revoked' ? value.status : '',
    verifiedAt: getString(value.verifiedAt),
  };
  return ID_PATTERN.test(publisher.keyId)
    && ID_PATTERN.test(publisher.publisherId)
    && FINGERPRINT_PATTERN.test(publisher.keyFingerprint)
    && publisher.status
    && Number.isFinite(Date.parse(publisher.verifiedAt))
    ? publisher
    : null;
}

function normalizeCatalog(value) {
  if (!isRecord(value) || value.kind !== CATALOG_KIND || !Array.isArray(value.publishers)) return null;
  const issuedAt = getString(value.issuedAt);
  const expiresAt = getString(value.expiresAt);
  const sequence = Number(value.sequence);
  const publishers = value.publishers.map(normalizePublisher).filter(Boolean);
  if (
    !Number.isSafeInteger(sequence)
    || sequence < 1
    || !Number.isFinite(Date.parse(issuedAt))
    || !Number.isFinite(Date.parse(expiresAt))
    || Date.parse(expiresAt) <= Date.parse(issuedAt)
    || Date.parse(expiresAt) - Date.parse(issuedAt) > MAX_CATALOG_LIFETIME_MS
    || publishers.length !== value.publishers.length
    || publishers.length > MAX_PUBLISHERS
    || new Set(publishers.map((publisher) => publisher.publisherId)).size !== publishers.length
  ) {
    return null;
  }
  return { expiresAt, issuedAt, kind: CATALOG_KIND, publishers, sequence };
}

function normalizeRootKey(value) {
  if (!isRecord(value) || value.algorithm !== 'ed25519') return null;
  const keyId = getString(value.keyId);
  const publicKey = getString(value.publicKey);
  const status = value.status === 'active' || value.status === 'revoked' ? value.status : '';
  if (!ID_PATTERN.test(keyId) || !publicKey || !status) return null;
  try {
    const keyObject = crypto.createPublicKey(publicKey);
    if (keyObject.asymmetricKeyType !== 'ed25519') return null;
    const normalizedInput = publicKey.replace(/\r\n/gu, '\n').trim();
    const canonicalPublicKey = keyObject.export({ format: 'pem', type: 'spki' })
      .toString()
      .replace(/\r\n/gu, '\n')
      .trim();
    if (normalizedInput !== canonicalPublicKey) return null;
    const keyFingerprint = crypto.createHash('sha256')
      .update(keyObject.export({ format: 'der', type: 'spki' }))
      .digest('hex');
    return { algorithm: 'ed25519', keyFingerprint, keyId, publicKey: canonicalPublicKey, status };
  } catch {
    return null;
  }
}

function readRootRegistry(rootKeyRegistryPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(rootKeyRegistryPath, 'utf8'));
    const minimumSequence = Number(parsed?.minimumSequence ?? 1);
    const keys = Array.isArray(parsed?.keys) ? parsed.keys.map(normalizeRootKey).filter(Boolean) : [];
    if (
      !isRecord(parsed)
      || parsed.kind !== ROOT_REGISTRY_KIND
      || !Array.isArray(parsed.keys)
      || keys.length !== parsed.keys.length
      || keys.length > MAX_ROOT_KEYS
      || new Set(keys.map((key) => key.keyId)).size !== keys.length
      || !Number.isSafeInteger(minimumSequence)
      || minimumSequence < 1
    ) {
      return { error: 'marketplace_catalog_root_registry_invalid', keys: [], minimumSequence: 1, status: 'invalid' };
    }
    return { error: null, keys, minimumSequence, status: 'ready' };
  } catch (error) {
    return error?.code === 'ENOENT'
      ? { error: 'marketplace_catalog_root_registry_missing', keys: [], minimumSequence: 1, status: 'missing' }
      : { error: 'marketplace_catalog_root_registry_invalid', keys: [], minimumSequence: 1, status: 'invalid' };
  }
}

function parseEnvelope(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!isRecord(parsed) || parsed.kind !== ENVELOPE_KIND || !isRecord(parsed.signature)) return null;
    const catalog = normalizeCatalog(parsed.catalog);
    const signature = {
      algorithm: getString(parsed.signature.algorithm),
      digest: getString(parsed.signature.digest),
      keyId: getString(parsed.signature.keyId),
      signature: getString(parsed.signature.signature),
    };
    if (
      !catalog
      || signature.algorithm !== 'ed25519'
      || signature.digest !== SIGNATURE_DIGEST
      || !ID_PATTERN.test(signature.keyId)
      || !signature.signature
    ) return null;
    return { catalog, kind: ENVELOPE_KIND, signature };
  } catch {
    return null;
  }
}

function writeJsonAtomically(targetPath, value) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, targetPath);
}

function createExternalSkillMarketplacePublisherCatalogService({
  userDataPath,
  rootKeyRegistryPath = path.join(__dirname, 'marketplaceCatalogRootKeys.json'),
  log,
  now = Date.now,
} = {}) {
  if (typeof userDataPath !== 'string' || !userDataPath.trim()) throw new Error('user_data_path_missing');
  const getNow = typeof now === 'function' ? now : Date.now;
  const rootPath = path.join(path.resolve(userDataPath), 'external-skill-marketplace-trust-v1');
  const activeCatalogPath = path.join(rootPath, 'publishers.json');
  const inboxPath = path.join(rootPath, 'publisher-catalog-inbox.json');
  const statePath = path.join(rootPath, 'catalog-state.json');
  const snapshotDirectory = path.join(rootPath, 'catalog-snapshots');

  function verifyEnvelope(value, { allowExpired = false } = {}) {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_CATALOG_BYTES) {
      return { error: 'marketplace_publisher_catalog_too_large', ok: false, status: 'invalid' };
    }
    const envelope = parseEnvelope(value);
    if (!envelope) return { error: 'marketplace_publisher_catalog_invalid', ok: false, status: 'invalid' };
    const roots = readRootRegistry(rootKeyRegistryPath);
    if (roots.status !== 'ready') return { error: roots.error, ok: false, status: 'unavailable' };
    if (envelope.catalog.sequence < roots.minimumSequence) {
      return { error: 'marketplace_publisher_catalog_below_minimum_sequence', ok: false, status: 'invalid' };
    }
    const rootKey = roots.keys.find((key) => key.keyId === envelope.signature.keyId) ?? null;
    if (!rootKey) return { error: 'marketplace_publisher_catalog_root_key_missing', ok: false, status: 'unavailable' };
    if (rootKey.status === 'revoked') return { error: 'marketplace_publisher_catalog_root_key_revoked', ok: false, status: 'invalid' };
    let verified = false;
    try {
      verified = crypto.verify(
        null,
        Buffer.from(createCanonicalPublisherCatalogPayload(envelope.catalog)),
        rootKey.publicKey,
        Buffer.from(envelope.signature.signature, 'base64'),
      );
    } catch {
      verified = false;
    }
    if (!verified) return { error: 'marketplace_publisher_catalog_signature_invalid', ok: false, status: 'invalid' };
    const nowMs = Number(getNow());
    if (!allowExpired && Date.parse(envelope.catalog.issuedAt) > nowMs + MAX_CLOCK_SKEW_MS) {
      return { error: 'marketplace_publisher_catalog_not_yet_valid', ok: false, status: 'invalid' };
    }
    if (!allowExpired && Date.parse(envelope.catalog.expiresAt) <= nowMs) {
      return { error: 'marketplace_publisher_catalog_expired', ok: false, status: 'expired' };
    }
    return {
      catalog: envelope.catalog,
      catalogDigest: crypto.createHash('sha256').update(createCanonicalPublisherCatalogPayload(envelope.catalog)).digest('hex'),
      envelope,
      ok: true,
      rootKeyFingerprint: rootKey.keyFingerprint,
      rootKeyId: rootKey.keyId,
      status: 'ready',
    };
  }

  function readActiveCatalog(options = {}) {
    try {
      return verifyEnvelope(fs.readFileSync(activeCatalogPath, 'utf8'), options);
    } catch (error) {
      return error?.code === 'ENOENT'
        ? { error: 'marketplace_publisher_registry_missing', ok: false, status: 'missing' }
        : { error: 'marketplace_publisher_registry_invalid', ok: false, status: 'invalid' };
    }
  }

  function readState() {
    try {
      const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      return isRecord(parsed)
        && parsed.kind === STATE_KIND
        && Number.isSafeInteger(parsed.highestSequence)
        && parsed.highestSequence >= 0
        ? parsed
        : { highestSequence: 0, kind: STATE_KIND, latestIssuedAt: null };
    } catch {
      return { highestSequence: 0, kind: STATE_KIND, latestIssuedAt: null };
    }
  }

  function getRootRegistryStatus() {
    const registry = readRootRegistry(rootKeyRegistryPath);
    return {
      activeKeyCount: registry.keys.filter((key) => key.status === 'active').length,
      error: registry.error,
      minimumSequence: registry.minimumSequence,
      revokedKeyCount: registry.keys.filter((key) => key.status === 'revoked').length,
      status: registry.status,
      totalKeyCount: registry.keys.length,
    };
  }

  function archiveEnvelope(envelope) {
    const snapshotPath = path.join(snapshotDirectory, `catalog-${String(envelope.catalog.sequence).padStart(12, '0')}.json`);
    writeJsonAtomically(snapshotPath, envelope);
    const snapshots = fs.readdirSync(snapshotDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^catalog-\d{12}\.json$/u.test(entry.name))
      .sort((left, right) => right.name.localeCompare(left.name));
    snapshots.slice(MAX_SNAPSHOTS).forEach((entry) => fs.unlinkSync(path.join(snapshotDirectory, entry.name)));
  }

  function provisionCatalog(value) {
    const verified = verifyEnvelope(value);
    if (!verified.ok) return verified;
    const active = readActiveCatalog({ allowExpired: true });
    const state = readState();
    const highestSequence = Math.max(state.highestSequence, active.ok ? active.catalog.sequence : 0);
    if (verified.catalog.sequence <= highestSequence) {
      return { error: 'marketplace_publisher_catalog_replay_rejected', ok: false, status: 'rejected' };
    }
    if (state.latestIssuedAt && Date.parse(verified.catalog.issuedAt) <= Date.parse(state.latestIssuedAt)) {
      return { error: 'marketplace_publisher_catalog_issued_at_rollback', ok: false, status: 'rejected' };
    }
    try {
      archiveEnvelope(verified.envelope);
      writeJsonAtomically(activeCatalogPath, verified.envelope);
      writeJsonAtomically(statePath, {
        catalogDigest: verified.catalogDigest,
        highestSequence: verified.catalog.sequence,
        kind: STATE_KIND,
        latestIssuedAt: verified.catalog.issuedAt,
        rootKeyFingerprint: verified.rootKeyFingerprint,
        rootKeyId: verified.rootKeyId,
        verifiedAt: new Date(getNow()).toISOString(),
      });
      log?.('Marketplace publisher catalog provisioned', {
        publisherCount: verified.catalog.publishers.length,
        rootKeyId: verified.rootKeyId,
        sequence: verified.catalog.sequence,
      });
      return {
        catalogDigest: verified.catalogDigest,
        expiresAt: verified.catalog.expiresAt,
        ok: true,
        publisherCount: verified.catalog.publishers.length,
        rootKeyId: verified.rootKeyId,
        sequence: verified.catalog.sequence,
        status: 'provisioned',
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false, status: 'failed' };
    }
  }

  function recoverActiveCatalog() {
    const active = readActiveCatalog({ allowExpired: true });
    if (active.ok) return { ok: true, recovered: false, sequence: active.catalog.sequence, status: 'ready' };
    if (!fs.existsSync(snapshotDirectory)) return { error: active.error, ok: false, recovered: false, status: active.status };
    const state = readState();
    const candidates = fs.readdirSync(snapshotDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^catalog-\d{12}\.json$/u.test(entry.name))
      .sort((left, right) => right.name.localeCompare(left.name));
    for (const entry of candidates) {
      const candidate = verifyEnvelope(fs.readFileSync(path.join(snapshotDirectory, entry.name), 'utf8'));
      if (!candidate.ok || candidate.catalog.sequence < state.highestSequence) continue;
      writeJsonAtomically(activeCatalogPath, candidate.envelope);
      log?.('Marketplace publisher catalog recovered', { sequence: candidate.catalog.sequence });
      return { ok: true, recovered: true, sequence: candidate.catalog.sequence, status: 'ready' };
    }
    return { error: 'marketplace_publisher_catalog_recovery_unavailable', ok: false, recovered: false, status: 'invalid' };
  }

  function provisionCatalogFromInbox() {
    try {
      const result = provisionCatalog(fs.readFileSync(inboxPath, 'utf8'));
      if (result.ok) fs.unlinkSync(inboxPath);
      return result;
    } catch (error) {
      return error?.code === 'ENOENT'
        ? { ok: true, status: 'not-present' }
        : { error: error instanceof Error ? error.message : String(error), ok: false, status: 'failed' };
    }
  }

  function initialize() {
    const recovery = recoverActiveCatalog();
    const provisioning = provisionCatalogFromInbox();
    return {
      ok: provisioning.ok && (
        recovery.ok
        || recovery.status === 'missing'
        || provisioning.status === 'provisioned'
      ),
      provisioning,
      recovery,
    };
  }

  return {
    getRootRegistryStatus,
    getPaths: () => ({ activeCatalogPath, inboxPath, rootKeyRegistryPath, snapshotDirectory, statePath }),
    initialize,
    provisionCatalog,
    provisionCatalogFromInbox,
    readActiveCatalog,
    recoverActiveCatalog,
    verifyEnvelope,
  };
}

module.exports = {
  createCanonicalPublisherCatalogPayload,
  createExternalSkillMarketplacePublisherCatalogService,
};
