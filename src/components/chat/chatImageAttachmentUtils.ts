import { type ChatMessageImageAttachment } from '../../types';

export const MAX_CHAT_IMAGE_ATTACHMENTS = 4;
export const MAX_CHAT_IMAGE_EDGE = 1280;
export const MAX_CHAT_IMAGE_FILE_SIZE_BYTES = 12 * 1024 * 1024;
export const SUPPORTED_CHAT_IMAGE_ACCEPT = 'image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif';
const CHAT_IMAGE_FILE_EXTENSION_PATTERN = /\.(?:avif|bmp|gif|jpe?g|png|webp)$/iu;

function createChatImageAttachmentId() {
  return `chat-image-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeImageName(name: string) {
  const normalizedName = name.replace(/\s+/gu, ' ').trim();
  return normalizedName || 'image';
}

function resolveOutputMimeType(mimeType: string) {
  if (mimeType === 'image/png' || mimeType === 'image/webp') {
    return mimeType;
  }

  return 'image/jpeg';
}

export function isChatImageFile(file: File) {
  return file.type.startsWith('image/') || CHAT_IMAGE_FILE_EXTENSION_PATTERN.test(file.name);
}

function loadImageFromFile(file: File) {
  const objectUrl = URL.createObjectURL(file);

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`无法读取图片：${file.name}`));
    image.src = objectUrl;
  }).finally(() => {
    URL.revokeObjectURL(objectUrl);
  });
}

async function fileToChatImageAttachment(file: File): Promise<ChatMessageImageAttachment> {
  if (!isChatImageFile(file)) {
    throw new Error(`不是受支持的图片文件：${file.name}`);
  }

  if (file.size > MAX_CHAT_IMAGE_FILE_SIZE_BYTES) {
    throw new Error(`图片太大：${file.name}`);
  }

  const image = await loadImageFromFile(file);
  const sourceWidth = Math.max(1, image.naturalWidth || image.width || 1);
  const sourceHeight = Math.max(1, image.naturalHeight || image.height || 1);
  const longestEdge = Math.max(sourceWidth, sourceHeight);
  const scale = Math.min(1, MAX_CHAT_IMAGE_EDGE / longestEdge);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas context unavailable');
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const mimeType = resolveOutputMimeType(file.type);
  const dataUrl = canvas.toDataURL(mimeType, 0.88);

  return {
    dataUrl,
    height,
    id: createChatImageAttachmentId(),
    kind: 'image',
    mimeType,
    name: normalizeImageName(file.name),
    sizeBytes: file.size,
    width,
  };
}

export async function createChatImageAttachmentsFromFiles(
  files: File[],
  existingAttachmentCount = 0,
) {
  const availableSlots = Math.max(0, MAX_CHAT_IMAGE_ATTACHMENTS - existingAttachmentCount);
  if (availableSlots <= 0) {
    return [];
  }

  const imageFiles = files
    .filter(isChatImageFile)
    .slice(0, availableSlots);

  return Promise.all(imageFiles.map((file) => fileToChatImageAttachment(file)));
}

export function getChatImageAttachmentSummary(attachments?: ChatMessageImageAttachment[] | null) {
  const imageAttachments = Array.isArray(attachments)
    ? attachments.filter((attachment) => attachment?.kind === 'image' && attachment.dataUrl)
    : [];

  if (imageAttachments.length === 0) {
    return '';
  }

  const names = imageAttachments
    .map((attachment) => attachment.name.trim())
    .filter(Boolean)
    .slice(0, 3);
  const countText = imageAttachments.length === 1
    ? '用户发送了一张图片'
    : `用户发送了 ${imageAttachments.length} 张图片`;
  const nameText = names.length ? `：${names.join('、')}` : '';

  return `${countText}${nameText}。`;
}

export function hasImageFiles(files: FileList | File[] | null | undefined) {
  return Array.from(files ?? []).some(isChatImageFile);
}

export function hasImageDataTransfer(dataTransfer: DataTransfer | null | undefined) {
  if (!dataTransfer) {
    return false;
  }

  const items = Array.from(dataTransfer.items ?? []);
  if (items.length > 0) {
    return items.some((item) => (
      item.kind === 'file'
      && (item.type.startsWith('image/') || item.type === '')
    ));
  }

  return hasImageFiles(dataTransfer.files);
}
