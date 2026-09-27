import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const {
  createCanonicalPublisherCatalogPayload,
  createExternalSkillMarketplacePublisherCatalogService,
} = require('../electron/externalSkillMarketplacePublisherCatalogService.cjs');
const {
  readDeliveryConfig,
} = require('../electron/externalSkillMarketplacePublisherCatalogDeliveryService.cjs');

const DEFAULT_ROOT_KEY_ID = 'ai-desktop-pet-market-root-2026-v1';
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@-]{0,159}$/u;

function parseArguments(argv) {
  const values = new Map();
  for (const argument of argv) {
    const match = /^--([^=]+)=(.*)$/u.exec(String(argument));
    if (match) values.set(match[1], match[2].trim());
  }
  return {
    catalogDays: Number(values.get('catalog-days') || 60),
    catalogUrl: values.get('catalog-url') || '',
    outputDirectory: values.get('output-dir') || '',
    rootKeyId: values.get('root-key-id') || DEFAULT_ROOT_KEY_ID,
  };
}

function requireEmptyTargetDirectories(outputDirectory) {
  for (const name of ['private', 'production', 'publish']) {
    if (fs.existsSync(path.join(outputDirectory, name))) {
      throw new Error(`Refusing to overwrite existing marketplace production directory: ${name}`);
    }
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
}

function validateInputs({ catalogDays, catalogUrl, outputDirectory, rootKeyId }) {
  if (!outputDirectory) throw new Error('--output-dir is required.');
  if (!ID_PATTERN.test(rootKeyId)) throw new Error('--root-key-id is invalid.');
  if (!Number.isSafeInteger(catalogDays) || catalogDays < 1 || catalogDays > 89) {
    throw new Error('--catalog-days must be an integer between 1 and 89.');
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(catalogUrl);
  } catch {
    throw new Error('--catalog-url must be a valid HTTPS URL.');
  }
  if (
    parsedUrl.protocol !== 'https:'
    || parsedUrl.username
    || parsedUrl.password
    || parsedUrl.hash
  ) {
    throw new Error('--catalog-url must be an HTTPS URL without credentials or a fragment.');
  }
  return { parsedUrl };
}

function validateGeneratedMaterials({ deliveryConfig, envelope, rootRegistry }) {
  const validationRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'marketplace-production-bootstrap-'));
  try {
    const rootRegistryPath = path.join(validationRoot, 'marketplaceCatalogRootKeys.json');
    const deliveryConfigPath = path.join(validationRoot, 'marketplaceCatalogDelivery.json');
    writeJson(rootRegistryPath, rootRegistry);
    writeJson(deliveryConfigPath, deliveryConfig);
    const catalogService = createExternalSkillMarketplacePublisherCatalogService({
      rootKeyRegistryPath: rootRegistryPath,
      userDataPath: validationRoot,
    });
    const rootStatus = catalogService.getRootRegistryStatus();
    const envelopeStatus = catalogService.verifyEnvelope(envelope);
    const deliveryStatus = readDeliveryConfig(deliveryConfigPath);
    if (rootStatus.status !== 'ready' || rootStatus.activeKeyCount !== 1) {
      throw new Error(rootStatus.error || 'Generated root registry failed validation.');
    }
    if (!envelopeStatus.ok) {
      throw new Error(envelopeStatus.error || 'Generated Catalog envelope failed validation.');
    }
    if (deliveryStatus.status !== 'ready' || deliveryStatus.enabled !== true) {
      throw new Error(deliveryStatus.error || 'Generated delivery config failed validation.');
    }
    return {
      catalogDigest: envelopeStatus.catalogDigest,
      rootKeyFingerprint: envelopeStatus.rootKeyFingerprint,
    };
  } finally {
    fs.rmSync(validationRoot, { force: true, recursive: true });
  }
}

export function bootstrapMarketplaceProduction({
  catalogDays = 60,
  catalogUrl,
  now = Date.now,
  outputDirectory,
  rootKeyId = DEFAULT_ROOT_KEY_ID,
} = {}) {
  const resolvedOutputDirectory = path.resolve(String(outputDirectory || ''));
  const { parsedUrl } = validateInputs({
    catalogDays,
    catalogUrl: String(catalogUrl || ''),
    outputDirectory: String(outputDirectory || ''),
    rootKeyId,
  });
  fs.mkdirSync(resolvedOutputDirectory, { recursive: true, mode: 0o700 });
  requireEmptyTargetDirectories(resolvedOutputDirectory);

  const nowMs = Number(now());
  if (!Number.isFinite(nowMs)) throw new Error('Marketplace bootstrap clock is invalid.');
  const issuedAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + catalogDays * 24 * 60 * 60 * 1000).toISOString();
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString()
    .replace(/\r\n/gu, '\n')
    .trim();
  const rootRegistry = {
    keys: [{
      algorithm: 'ed25519',
      keyId: rootKeyId,
      publicKey: publicKeyPem,
      status: 'active',
    }],
    kind: 'external-skill-marketplace-catalog-root-key-registry.v1',
    minimumSequence: 1,
  };
  const catalog = {
    expiresAt,
    issuedAt,
    kind: 'external-skill-marketplace-publisher-catalog.v1',
    publishers: [],
    sequence: 1,
  };
  const envelope = {
    catalog,
    kind: 'external-skill-marketplace-publisher-catalog-envelope.v1',
    signature: {
      algorithm: 'ed25519',
      digest: 'sha256:canonical-marketplace-publisher-catalog-v1',
      keyId: rootKeyId,
      signature: crypto.sign(
        null,
        Buffer.from(createCanonicalPublisherCatalogPayload(catalog)),
        privateKey,
      ).toString('base64'),
    },
  };
  const deliveryConfig = {
    allowedOrigins: [parsedUrl.origin],
    catalogUrl: parsedUrl.toString(),
    enabled: true,
    kind: 'external-skill-marketplace-publisher-catalog-delivery-config.v1',
    maxResponseBytes: 262144,
    requestTimeoutMs: 10000,
  };
  const validation = validateGeneratedMaterials({ deliveryConfig, envelope, rootRegistry });

  const stagingDirectory = path.join(
    resolvedOutputDirectory,
    `.bootstrap-${process.pid}-${Date.now()}`,
  );
  const privateDirectory = path.join(stagingDirectory, 'private');
  const productionDirectory = path.join(stagingDirectory, 'production');
  const publishDirectory = path.join(stagingDirectory, 'publish', 'v1');
  fs.mkdirSync(privateDirectory, { recursive: true, mode: 0o700 });
  fs.mkdirSync(productionDirectory, { recursive: true, mode: 0o700 });
  fs.mkdirSync(publishDirectory, { recursive: true, mode: 0o700 });
  try {
    fs.writeFileSync(path.join(privateDirectory, 'catalog-root-private-key.pem'), privateKeyPem, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    writeJson(path.join(productionDirectory, 'marketplaceCatalogRootKeys.json'), rootRegistry);
    writeJson(path.join(productionDirectory, 'marketplaceCatalogDelivery.json'), deliveryConfig);
    writeJson(path.join(publishDirectory, 'publishers.json'), envelope);
    fs.renameSync(privateDirectory, path.join(resolvedOutputDirectory, 'private'));
    fs.renameSync(productionDirectory, path.join(resolvedOutputDirectory, 'production'));
    fs.renameSync(path.dirname(publishDirectory), path.join(resolvedOutputDirectory, 'publish'));
  } finally {
    fs.rmSync(stagingDirectory, { force: true, recursive: true });
  }

  return {
    catalogDigest: validation.catalogDigest,
    catalogExpiresAt: expiresAt,
    catalogSequence: 1,
    catalogUrl: parsedUrl.toString(),
    outputDirectory: resolvedOutputDirectory,
    publisherCount: 0,
    rootKeyFingerprint: validation.rootKeyFingerprint,
    rootKeyId,
  };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = bootstrapMarketplaceProduction(options);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
