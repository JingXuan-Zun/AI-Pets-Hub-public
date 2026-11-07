import type { ChatMessage, ChatMessageImageAttachment } from '../types';

// Pictures in chat messages are kept inline (data URLs) and the whole history is copied between
// windows and saved to disk. Full-size screenshots (up to ~9 MB each) made the history 42 MB and
// the pet stutter (2026-11-07). Large ones become a JPEG at most 1600 px on the long side.

export const CHAT_IMAGE_COMPRESS_OVER_BYTES = 300 * 1024;
const MAX_SIDE = 1600;
const QUALITY = 0.85;

/** Rough byte size of a base64 data URL. */
export function dataUrlBytes(dataUrl: string) {
  const comma = dataUrl.indexOf(',');
  return comma < 0 ? dataUrl.length : Math.floor((dataUrl.length - comma - 1) * 0.75);
}

export function fitWithin(width: number, height: number, maxSide = MAX_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { height: Math.max(1, Math.round(height * scale)), width: Math.max(1, Math.round(width * scale)) };
}

async function blobToDataUrl(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type};base64,${btoa(binary)}`;
}

/** A smaller copy of a large inline image; small ones (or anything that fails) come back unchanged. */
export async function compressImageAttachment(attachment: ChatMessageImageAttachment): Promise<ChatMessageImageAttachment> {
  if (!attachment.dataUrl?.startsWith('data:image/') || dataUrlBytes(attachment.dataUrl) <= CHAT_IMAGE_COMPRESS_OVER_BYTES) return attachment;
  try {
    const bitmap = await createImageBitmap(await (await fetch(attachment.dataUrl)).blob());
    const size = fitWithin(bitmap.width, bitmap.height);
    const canvas = new OffscreenCanvas(size.width, size.height);
    const context = canvas.getContext('2d');
    if (!context) return attachment;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    const blob = await canvas.convertToBlob({ quality: QUALITY, type: 'image/jpeg' });
    const dataUrl = await blobToDataUrl(blob);
    if (dataUrl.length >= attachment.dataUrl.length) return attachment;
    return {
      ...attachment,
      dataUrl,
      height: size.height,
      mimeType: 'image/jpeg',
      name: attachment.name.replace(/\.(png|webp|bmp)$/iu, '.jpg'),
      sizeBytes: blob.size,
      width: size.width,
    };
  } catch {
    return attachment;
  }
}

export function hasLargeInlineImage(message: ChatMessage) {
  return (message.attachments ?? []).some((item) => item.dataUrl?.startsWith('data:image/') && dataUrlBytes(item.dataUrl) > CHAT_IMAGE_COMPRESS_OVER_BYTES);
}
