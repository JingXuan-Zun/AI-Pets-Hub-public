export const SUPPORTED_3D_MODEL_FORMATS = ['glb', 'gltf', 'vrm', 'fbx', 'obj', 'stl', 'pmx'] as const;
const LOCAL_3D_MODEL_PROTOCOL = 'desktop-pet-file://local';

export type Supported3DModelFormat = (typeof SUPPORTED_3D_MODEL_FORMATS)[number];

const SUPPORTED_3D_MODEL_FORMAT_SET = new Set<string>(SUPPORTED_3D_MODEL_FORMATS);
// Prefer the original local file path for every custom 3D format in the desktop app.
// This keeps relative textures / sidecar resources working and avoids oversized data URLs.
const LOCAL_PATH_PREFERRED_3D_MODEL_FORMAT_SET = new Set<Supported3DModelFormat>(SUPPORTED_3D_MODEL_FORMATS);
const SUPPORTED_3D_MODEL_ACCEPT_ATTRIBUTE = SUPPORTED_3D_MODEL_FORMATS.map((format) => `.${format}`).join(',');
const SUPPORTED_3D_MODEL_LABEL = SUPPORTED_3D_MODEL_FORMATS.map((format) => format.toUpperCase()).join(' / ');

function isDesktopFileRendererEnvironment() {
  return typeof window !== 'undefined'
    && Boolean(window.desktopPetShell?.desktopMode)
    && typeof window.location?.href === 'string'
    && /^file:/iu.test(window.location.href);
}

function resolveDesktopRendererPublicAssetUrl(url: string) {
  const normalizedUrl = url.trim().replace(/\\/g, '/');
  if (
    !isDesktopFileRendererEnvironment()
    || !normalizedUrl.startsWith('/')
    || normalizedUrl.startsWith('//')
  ) {
    return null;
  }

  try {
    return new URL(`.${normalizedUrl}`, window.location.href).toString();
  } catch {
    return null;
  }
}

export function getSupported3DModelAcceptAttribute() {
  return SUPPORTED_3D_MODEL_ACCEPT_ATTRIBUTE;
}

export function getSupported3DModelLabel() {
  return SUPPORTED_3D_MODEL_LABEL;
}

export function isSupported3DModelFormat(value: string): value is Supported3DModelFormat {
  return SUPPORTED_3D_MODEL_FORMAT_SET.has(value.toLowerCase());
}

export function shouldPersist3DModelAsLocalPath(format: Supported3DModelFormat) {
  return LOCAL_PATH_PREFERRED_3D_MODEL_FORMAT_SET.has(format);
}

export function resolve3DModelFormatFromFileName(fileName: string) {
  const normalizedFileName = fileName.trim().toLowerCase();
  const matchedExtension = normalizedFileName.match(/\.([a-z0-9]+)$/iu)?.[1] ?? '';
  return isSupported3DModelFormat(matchedExtension) ? matchedExtension : null;
}

export function inject3DModelFormatIntoDataUrl(
  dataUrl: string,
  format: Supported3DModelFormat,
) {
  const trimmedDataUrl = dataUrl.trim();
  if (!trimmedDataUrl.startsWith('data:')) {
    return trimmedDataUrl;
  }

  const separatorIndex = trimmedDataUrl.indexOf(',');
  if (separatorIndex < 0) {
    return trimmedDataUrl;
  }

  const header = trimmedDataUrl.slice(0, separatorIndex).replace(/;model-format=[^;,]+/iu, '');
  const payload = trimmedDataUrl.slice(separatorIndex + 1);
  const hasBase64Marker = /;base64$/iu.test(header);
  const normalizedHeader = header.replace(/;base64$/iu, '');
  return `${normalizedHeader};model-format=${format}${hasBase64Marker ? ';base64' : ''},${payload}`;
}

export function resolve3DModelFormatFromUrl(url: string) {
  const trimmedUrl = url.trim();
  const matchedDataFormat = trimmedUrl.match(/;model-format=([a-z0-9.+-]+)/iu)?.[1] ?? '';
  if (isSupported3DModelFormat(matchedDataFormat)) {
    return matchedDataFormat;
  }

  const normalizedUrl = trimmedUrl
    .replace(/[?#].*$/u, '')
    .replace(/\\/g, '/')
    .toLowerCase();
  const matchedExtension = normalizedUrl.match(/\.([a-z0-9]+)$/iu)?.[1] ?? '';
  return isSupported3DModelFormat(matchedExtension) ? matchedExtension : null;
}

export function resolve3DModelLoaderUrl(url: string) {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return trimmedUrl;
  }

  const slashNormalizedUrl = trimmedUrl.replace(/\\/g, '/');
  const desktopRendererPublicAssetUrl = resolveDesktopRendererPublicAssetUrl(slashNormalizedUrl);
  if (desktopRendererPublicAssetUrl) {
    return desktopRendererPublicAssetUrl;
  }

  if (slashNormalizedUrl.startsWith('//')) {
    const normalizedNetworkPath = slashNormalizedUrl.replace(/^\/+/u, '');
    const protocolUrl = new URL(`${LOCAL_3D_MODEL_PROTOCOL}/`);
    protocolUrl.pathname = `/unc/${normalizedNetworkPath}`;
    return protocolUrl.toString();
  }

  if (/^[a-z]:\//iu.test(slashNormalizedUrl)) {
    const protocolUrl = new URL(`${LOCAL_3D_MODEL_PROTOCOL}/`);
    protocolUrl.pathname = `/${slashNormalizedUrl}`;
    return protocolUrl.toString();
  }

  if (/^[a-z][a-z0-9+.-]*:/iu.test(slashNormalizedUrl)) {
    return slashNormalizedUrl;
  }

  return slashNormalizedUrl;
}

export function resolve3DModelDirectoryUrl(url: string) {
  const loaderUrl = resolve3DModelLoaderUrl(url);
  if (!loaderUrl) {
    return loaderUrl;
  }

  try {
    const parsedUrl = new URL(loaderUrl);
    const pathname = parsedUrl.pathname || '/';
    parsedUrl.pathname = pathname.endsWith('/')
      ? pathname
      : pathname.replace(/[^/]*$/u, '');
    parsedUrl.search = '';
    parsedUrl.hash = '';
    return parsedUrl.toString();
  } catch {
    const normalizedUrl = loaderUrl.replace(/\\/g, '/');
    if (!normalizedUrl.includes('/')) {
      return normalizedUrl;
    }

    return normalizedUrl.replace(/[^/]*$/u, '');
  }
}

export function resolve3DModelDependencyUrl(requestUrl: string, sourceModelUrl: string) {
  const trimmedRequestUrl = requestUrl.trim();
  if (!trimmedRequestUrl) {
    return trimmedRequestUrl;
  }

  const normalizedRequestUrl = trimmedRequestUrl.replace(/\\/g, '/');

  if (/^(?:data|blob):/iu.test(normalizedRequestUrl)) {
    return normalizedRequestUrl;
  }

  const desktopRendererPublicAssetUrl = resolveDesktopRendererPublicAssetUrl(normalizedRequestUrl);
  if (desktopRendererPublicAssetUrl) {
    return desktopRendererPublicAssetUrl;
  }

  if (
    normalizedRequestUrl.startsWith('//')
    || /^[a-z]:\//iu.test(normalizedRequestUrl)
    || /^[a-z][a-z0-9+.-]*:/iu.test(normalizedRequestUrl)
  ) {
    return resolve3DModelLoaderUrl(normalizedRequestUrl);
  }

  const baseDirectoryUrl = resolve3DModelDirectoryUrl(sourceModelUrl);
  if (!baseDirectoryUrl) {
    return normalizedRequestUrl;
  }

  try {
    return new URL(normalizedRequestUrl, baseDirectoryUrl).toString();
  } catch {
    return normalizedRequestUrl;
  }
}
