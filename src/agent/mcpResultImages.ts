import type { AgentMcpToolContent } from './agentMcpTypes';

// Pictures an MCP tool hands back, for the chat: ones sent inline (type image), and ones it
// saved to a file and only named ("Saved screenshot to C:\…\Temp\….png" — a browser plugin does
// this for big full-page screenshots). She does not see them; the user does, in the chat.

export interface McpResultImage {
  dataUrl: string;
  mimeType: string;
  name: string;
}

const MAX_IMAGES = 4;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const IMAGE_PATH = /(?:[A-Za-z]:\\|\/)[^\s"'<>|*?\n]*?\.(?:png|jpe?g|webp|gif)\b/giu;
const MIME: Record<string, string> = { gif: 'image/gif', jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Absolute image file paths named in the text, each once. */
export function findImagePaths(text: string) {
  return [...new Set((text.match(IMAGE_PATH) ?? []).map((path) => path.trim()))].slice(0, MAX_IMAGES);
}

/** The app's address for a local file (see electron/localModelProtocol.cjs). */
export function localFileUrl(path: string) {
  const slashed = path.replace(/\\/gu, '/').replace(/^\/+/u, '');
  return `desktop-pet-file://local/${slashed.split('/').map(encodeURIComponent).join('/')}`;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function loadImageFile(path: string): Promise<McpResultImage | null> {
  try {
    const response = await fetch(localFileUrl(path));
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.size || blob.size > MAX_FILE_BYTES) return null;
    const extension = path.split('.').pop()?.toLowerCase() ?? 'png';
    const mimeType = MIME[extension] ?? 'image/png';
    const dataUrl = (await blobToDataUrl(blob)).replace(/^data:[^;,]*/u, `data:${mimeType}`);
    return { dataUrl, mimeType, name: path.split(/[\\/]/u).pop() ?? `image.${extension}` };
  } catch {
    return null;
  }
}

export async function collectMcpResultImages(content: AgentMcpToolContent[], label: string): Promise<McpResultImage[]> {
  const inline = content.filter((item) => item.type === 'image' && item.data).map((item, index) => {
    const mimeType = item.mimeType || 'image/png';
    return { dataUrl: `data:${mimeType};base64,${item.data}`, mimeType, name: `${label}-${index + 1}.${mimeType.split('/')[1] || 'png'}` };
  });
  const words = content.filter((item) => item.type !== 'image').map((item) => item.text).join('\n');
  const files = (await Promise.all(findImagePaths(words).map(loadImageFile))).filter((image): image is McpResultImage => Boolean(image));
  return [...inline, ...files].slice(0, MAX_IMAGES);
}
