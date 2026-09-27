const LOCAL_ASSET_PROTOCOL = 'desktop-pet-file:';

export function resolveStoredAssetDisplayPath(assetUrl: string) {
  const normalizedUrl = assetUrl.trim();
  if (!normalizedUrl) return '';

  try {
    const parsedUrl = new URL(normalizedUrl);
    if (parsedUrl.protocol !== LOCAL_ASSET_PROTOCOL || parsedUrl.hostname !== 'local') {
      return normalizedUrl;
    }

    const pathname = decodeURIComponent(parsedUrl.pathname);
    if (pathname.startsWith('/unc/')) {
      return `\\\\${pathname.slice('/unc/'.length).replace(/\//g, '\\')}`;
    }

    return pathname.replace(/^\/+/u, '').replace(/\//g, '\\');
  } catch {
    return normalizedUrl;
  }
}
