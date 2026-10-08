const path = require('path');

const CONFIG_ASSET_PROTOCOL_ROOT = 'desktop-pet-file://local';

const INLINE_IMAGE_EXTERNALIZE_THRESHOLD_BYTES = 64 * 1024;

const IMAGE_EXTENSION_BY_MIME_TYPE = new Map([
  ['image/avif', 'avif'],
  ['image/bmp', 'bmp'],
  ['image/gif', 'gif'],
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/png', 'png'],
  ['image/svg+xml', 'svg'],
  ['image/webp', 'webp'],
  ['image/x-icon', 'ico'],
]);

function normalizeSequenceAssetFolderName(value, fallback) {
  const normalized = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/[. ]+$/u, '')
    .slice(0, 80);
  return normalized || fallback;
}

function buildLocalConfigAssetUrl(assetPath) {
  const normalizedPath = path.resolve(assetPath).replace(/\\/g, '/');
  const protocolUrl = new URL(`${CONFIG_ASSET_PROTOCOL_ROOT}/`);

  if (normalizedPath.startsWith('//')) {
    protocolUrl.pathname = `/unc/${normalizedPath.replace(/^\/+/, '')}`;
  } else {
    protocolUrl.pathname = `/${normalizedPath.replace(/^\/+/, '')}`;
  }

  return protocolUrl.toString();
}

function parseInlineImageDataUrl(value, options = {}) {
  if (
    typeof value !== 'string'
    || (!options.force && value.length < INLINE_IMAGE_EXTERNALIZE_THRESHOLD_BYTES)
    || !value.startsWith('data:image/')
  ) {
    return null;
  }

  const separatorIndex = value.indexOf(',');
  if (separatorIndex < 0) {
    return null;
  }

  const header = value.slice(5, separatorIndex);
  const headerParts = header.split(';');
  const mimeType = (headerParts.shift() || '').toLowerCase();
  const isBase64 = headerParts.some((part) => part.toLowerCase() === 'base64');
  const extension = IMAGE_EXTENSION_BY_MIME_TYPE.get(mimeType);
  if (!isBase64 || !extension) {
    return null;
  }

  try {
    const payload = value.slice(separatorIndex + 1).replace(/\s+/g, '');
    const buffer = Buffer.from(payload, 'base64');
    if (!buffer.length) {
      return null;
    }

    return {
      buffer,
      extension,
      mimeType,
    };
  } catch {
    return null;
  }
}

module.exports = {
  INLINE_IMAGE_EXTERNALIZE_THRESHOLD_BYTES,
  normalizeSequenceAssetFolderName,
  buildLocalConfigAssetUrl,
  parseInlineImageDataUrl,
};
