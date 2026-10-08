function normalizeDesktopIconMetadata(value) {
  const optionalStringFields = {};
  for (const key of ['filePath', 'itemKind', 'path', 'positionSource', 'targetPath']) {
    if (typeof value[key] === 'string' && value[key].trim()) {
      optionalStringFields[key] = value[key].trim();
    }
  }

  const rawExtension = typeof value.extension === 'string'
    ? value.extension.trim().replace(/^\./, '').toLowerCase()
    : '';
  if (/^[a-z0-9][a-z0-9-]{0,15}$/.test(rawExtension)) {
    optionalStringFields.extension = rawExtension;
  }

  const optionalBooleanFields = {};
  for (const key of ['canMove', 'isDirectory', 'isFile', 'isShortcut', 'isSystemIcon']) {
    if (typeof value[key] === 'boolean') {
      optionalBooleanFields[key] = value[key];
    }
  }

  return { ...optionalStringFields, ...optionalBooleanFields };
}

function normalizeDesktopIcon(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const index = Number(value.index);
  const x = Number(value.x);
  const y = Number(value.y);
  const width = Number(value.width);
  const height = Number(value.height);
  const centerX = Number(value.centerX);
  const centerY = Number(value.centerY);
  const desktopGridCellWidth = Number(value.desktopGridCellWidth);
  const desktopGridCellHeight = Number(value.desktopGridCellHeight);
  if (![index, x, y, width, height, centerX, centerY].every(Number.isFinite)) {
    return null;
  }

  const rawName = typeof value.name === 'string' ? value.name : '';
  const sanitizedName = rawName
    .replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e]/g, '')
    .trim();
  const normalizedIndex = Math.max(0, Math.round(index));
  const metadata = normalizeDesktopIconMetadata(value);

  return {
    ...metadata,
    id: `desktop-icon-${normalizedIndex}`,
    index: normalizedIndex,
    name: sanitizedName || `Desktop item ${normalizedIndex + 1}`,
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    centerX: Math.round(centerX),
    centerY: Math.round(centerY),
    desktopGridCellWidth: Number.isFinite(desktopGridCellWidth) && desktopGridCellWidth > 0
      ? Math.round(desktopGridCellWidth)
      : undefined,
    desktopGridCellHeight: Number.isFinite(desktopGridCellHeight) && desktopGridCellHeight > 0
      ? Math.round(desktopGridCellHeight)
      : undefined,
  };
}

module.exports = { normalizeDesktopIcon };
