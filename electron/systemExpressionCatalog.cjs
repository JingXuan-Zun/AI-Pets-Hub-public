const fs = require('fs');
const path = require('path');

const MAX_CATALOG_ITEMS = 200;
const MAX_EXPRESSION_LENGTH = 48;

function normalizeCatalogItem(item, kind) {
  const id = String(item?.id ?? '').trim();
  const value = String(item?.value ?? '').trim();
  const intents = Array.isArray(item?.intents)
    ? item.intents.map((intent) => String(intent).trim()).filter(Boolean).slice(0, 8)
    : [];
  if (!id.startsWith(`system-${kind}-`) || !value || value.length > MAX_EXPRESSION_LENGTH || !intents.length) {
    return null;
  }
  return { id, intents, value };
}

function normalizeCatalog(rawCatalog) {
  const normalizeItems = (items, kind) => (Array.isArray(items) ? items : [])
    .slice(0, MAX_CATALOG_ITEMS)
    .map((item) => normalizeCatalogItem(item, kind))
    .filter(Boolean);
  return {
    emoji: normalizeItems(rawCatalog?.emoji, 'emoji'),
    kaomoji: normalizeItems(rawCatalog?.kaomoji, 'kaomoji'),
    version: Math.max(1, Math.trunc(Number(rawCatalog?.version) || 1)),
  };
}

function createSystemExpressionCatalogService({ appPath }) {
  const catalogPath = path.join(appPath, 'resources', 'system-expressions', 'catalog.json');
  let cachedCatalog = null;

  async function getCatalog() {
    if (!cachedCatalog) {
      const rawCatalog = JSON.parse(await fs.promises.readFile(catalogPath, 'utf8'));
      cachedCatalog = Object.freeze(normalizeCatalog(rawCatalog));
    }
    return { catalog: cachedCatalog, ok: true };
  }

  return { getCatalog };
}

module.exports = { createSystemExpressionCatalogService };
