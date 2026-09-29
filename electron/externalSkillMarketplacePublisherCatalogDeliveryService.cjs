const path = require('path');
const fs = require('fs');
const {
  createExternalSkillMarketplacePublisherCatalogService,
} = require('./externalSkillMarketplacePublisherCatalogService.cjs');

const CONFIG_KIND = 'external-skill-marketplace-publisher-catalog-delivery-config.v1';
const MAX_ALLOWED_ORIGINS = 4;
const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_TIMEOUT_MS = 30_000;
const MIN_RESPONSE_BYTES = 1024;
const MIN_TIMEOUT_MS = 100;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeOrigin(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== 'https:'
      || parsed.username
      || parsed.password
      || parsed.pathname !== '/'
      || parsed.search
      || parsed.hash
    ) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function normalizeCatalogUrl(value, allowedOrigins) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== 'https:'
      || parsed.username
      || parsed.password
      || parsed.hash
      || !allowedOrigins.includes(parsed.origin)
    ) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function readDeliveryConfig(configPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!isRecord(parsed) || parsed.kind !== CONFIG_KIND || typeof parsed.enabled !== 'boolean') {
      return { error: 'marketplace_catalog_delivery_config_invalid', status: 'unavailable' };
    }
    if (!parsed.enabled) return { enabled: false, status: 'disabled' };
    if (!Array.isArray(parsed.allowedOrigins) || parsed.allowedOrigins.length > MAX_ALLOWED_ORIGINS) {
      return { error: 'marketplace_catalog_delivery_config_invalid', status: 'unavailable' };
    }
    const allowedOrigins = parsed.allowedOrigins.map(normalizeOrigin).filter(Boolean);
    if (
      allowedOrigins.length !== parsed.allowedOrigins.length
      || !allowedOrigins.length
      || new Set(allowedOrigins).size !== allowedOrigins.length
    ) {
      return { error: 'marketplace_catalog_delivery_config_invalid', status: 'unavailable' };
    }
    const catalogUrl = normalizeCatalogUrl(parsed.catalogUrl, allowedOrigins);
    const maxResponseBytes = Number(parsed.maxResponseBytes ?? MAX_RESPONSE_BYTES);
    const requestTimeoutMs = Number(parsed.requestTimeoutMs ?? 10_000);
    if (
      !catalogUrl
      || !Number.isSafeInteger(maxResponseBytes)
      || maxResponseBytes < MIN_RESPONSE_BYTES
      || maxResponseBytes > MAX_RESPONSE_BYTES
      || !Number.isSafeInteger(requestTimeoutMs)
      || requestTimeoutMs < MIN_TIMEOUT_MS
      || requestTimeoutMs > MAX_TIMEOUT_MS
    ) {
      return { error: 'marketplace_catalog_delivery_config_invalid', status: 'unavailable' };
    }
    return {
      allowedOrigins,
      catalogUrl,
      enabled: true,
      maxResponseBytes,
      requestTimeoutMs,
      status: 'ready',
    };
  } catch (error) {
    return {
      error: error?.code === 'ENOENT'
        ? 'marketplace_catalog_delivery_config_missing'
        : 'marketplace_catalog_delivery_config_invalid',
      status: 'unavailable',
    };
  }
}

function getHeader(response, name) {
  const value = response?.headers?.get?.(name);
  return typeof value === 'string' ? value.trim() : '';
}

function isJsonContentType(value) {
  const mediaType = value.split(';', 1)[0].trim().toLowerCase();
  return mediaType === 'application/json' || (mediaType.startsWith('application/') && mediaType.endsWith('+json'));
}

async function readBoundedBody(response, maxBytes) {
  const contentLengthText = getHeader(response, 'content-length');
  if (contentLengthText) {
    const contentLength = Number(contentLengthText);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > maxBytes) {
      return { error: 'marketplace_catalog_delivery_response_too_large', ok: false };
    }
  }
  const reader = response?.body?.getReader?.();
  if (!reader) return { error: 'marketplace_catalog_delivery_body_unavailable', ok: false };
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    const chunk = Buffer.from(part.value);
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => {});
      return { error: 'marketplace_catalog_delivery_response_too_large', ok: false };
    }
    chunks.push(chunk);
  }
  return { body: Buffer.concat(chunks, totalBytes).toString('utf8'), ok: true, totalBytes };
}

function createExternalSkillMarketplacePublisherCatalogDeliveryService({
  userDataPath,
  catalogService,
  configPath = path.join(__dirname, 'marketplaceCatalogDelivery.json'),
  log,
  now = Date.now,
  request = globalThis.fetch,
} = {}) {
  if (typeof userDataPath !== 'string' || !userDataPath.trim()) throw new Error('user_data_path_missing');
  const catalog = catalogService ?? createExternalSkillMarketplacePublisherCatalogService({
    log,
    now,
    userDataPath,
  });

  async function refreshCatalog() {
    const config = readDeliveryConfig(configPath);
    if (config.status === 'disabled') return { ok: true, status: 'disabled' };
    if (config.status !== 'ready') return { error: config.error, ok: false, status: config.status };
    if (typeof request !== 'function') {
      return { error: 'marketplace_catalog_delivery_transport_unavailable', ok: false, status: 'unavailable' };
    }

    const controller = new AbortController();
    let timedOut = false;
    let timer;
    const timeoutResult = new Promise((resolve) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        resolve({ error: 'marketplace_catalog_delivery_timeout', ok: false, status: 'failed' });
      }, config.requestTimeoutMs);
    });
    const delivery = (async () => {
      try {
        const response = await request(config.catalogUrl, {
          cache: 'no-store',
          credentials: 'omit',
          headers: { accept: 'application/json' },
          redirect: 'manual',
          signal: controller.signal,
        });
        if (timedOut) return { error: 'marketplace_catalog_delivery_timeout', ok: false, status: 'failed' };
        if (response.status >= 300 && response.status < 400) {
          return { error: 'marketplace_catalog_delivery_redirect_rejected', ok: false, status: 'rejected' };
        }
        if (response.status !== 200) {
          return {
            error: 'marketplace_catalog_delivery_http_error',
            httpStatus: Number(response.status) || null,
            ok: false,
            status: 'failed',
          };
        }
        if (!isJsonContentType(getHeader(response, 'content-type'))) {
          return { error: 'marketplace_catalog_delivery_content_type_rejected', ok: false, status: 'rejected' };
        }
        const body = await readBoundedBody(response, config.maxResponseBytes);
        if (!body.ok) return { ...body, status: 'rejected' };
        if (timedOut) return { error: 'marketplace_catalog_delivery_timeout', ok: false, status: 'failed' };
        const provisioned = catalog.provisionCatalog(body.body);
        if (!provisioned.ok) {
          return {
            error: provisioned.error,
            ok: false,
            status: provisioned.status === 'failed' ? 'failed' : 'rejected',
          };
        }
        const result = {
          catalogDigest: provisioned.catalogDigest,
          expiresAt: provisioned.expiresAt,
          ok: true,
          publisherCount: provisioned.publisherCount,
          sequence: provisioned.sequence,
          status: 'provisioned',
          totalBytes: body.totalBytes,
          transportOrigin: new URL(config.catalogUrl).origin,
        };
        log?.('Marketplace publisher catalog delivery completed', result);
        return result;
      } catch (error) {
        return {
          error: timedOut || error?.name === 'AbortError'
            ? 'marketplace_catalog_delivery_timeout'
            : 'marketplace_catalog_delivery_transport_failed',
          ok: false,
          status: 'failed',
        };
      }
    })();
    const result = await Promise.race([delivery, timeoutResult]);
    clearTimeout(timer);
    if (!result.ok) log?.('Marketplace publisher catalog delivery incomplete', result);
    return result;
  }

  return {
    getConfigStatus: () => readDeliveryConfig(configPath),
    refreshCatalog,
  };
}

module.exports = {
  createExternalSkillMarketplacePublisherCatalogDeliveryService,
  readDeliveryConfig,
};
