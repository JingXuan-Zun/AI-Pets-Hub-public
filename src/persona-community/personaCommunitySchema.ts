import type { PublicPersonaEntry } from './personaCommunityTypes';

export const PERSONA_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const PERSONA_MAX_CATALOG_BYTES = 1024 * 1024;
export const PERSONA_MAX_ENTRIES = 1000;
export const PERSONA_ID_PATTERN = /^[a-f0-9]{64}$/;
export const PERSONA_FORMATS = ['txt', 'md', 'json'] as const;

export function personaFilename(name: string) {
  const basename = name.split(/[/\\]/u).pop() ?? '';
  const cleaned = basename.normalize('NFC').replace(/[<>:"/\\|?*\p{Cc}\p{Cf}]/gu, '_');
  const format = cleaned.split('.').pop()?.toLowerCase();
  if (!PERSONA_FORMATS.some((value) => value === format)) throw new Error('file-format');
  let stem = cleaned.slice(0, -(format!.length + 1)).trim().replace(/[. ]+$/u, '');
  stem = Array.from(stem).slice(0, 80).join('') || 'persona';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(stem)) stem = `_${stem}`;
  return `${stem}.${format}`;
}

export function validatePersonaBytes(bytes: Uint8Array, filename: string) {
  if (!bytes.byteLength || bytes.byteLength > PERSONA_MAX_FILE_BYTES) throw new Error('file-size');
  const safeName = personaFilename(filename);
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('file-encoding'); }
  if (!text.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text)) throw new Error('file-content');
  const format = safeName.split('.').pop() as PublicPersonaEntry['format'];
  if (format === 'json') {
    try { JSON.parse(text); } catch { throw new Error('file-json'); }
  }
  return { filename: safeName, format, title: safeName.slice(0, -(format.length + 1)) };
}

export function parsePublicPersona(value: unknown): PublicPersonaEntry {
  if (!value || typeof value !== 'object') throw new Error('catalog-invalid');
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || !PERSONA_ID_PATTERN.test(item.id)
    || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 200
    || !PERSONA_FORMATS.some((format) => format === item.format)
    || typeof item.filename !== 'string' || personaFilename(item.filename) !== item.filename
    || !item.filename.endsWith(`.${item.format}`)
    || typeof item.sizeBytes !== 'number' || !Number.isInteger(item.sizeBytes)
    || item.sizeBytes < 1 || item.sizeBytes > PERSONA_MAX_FILE_BYTES
    || typeof item.sha256 !== 'string' || !PERSONA_ID_PATTERN.test(item.sha256)
    || typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt))) {
    throw new Error('catalog-invalid');
  }
  return {
    id: item.id, title: item.title, filename: item.filename,
    format: item.format as PublicPersonaEntry['format'], sizeBytes: item.sizeBytes,
    createdAt: item.createdAt, sha256: item.sha256,
    // Treat labels as plain text; never accept remote HTML or download URLs.
    author: typeof item.author === 'string' ? item.author.slice(0, 80) : undefined,
    description: typeof item.description === 'string' ? item.description.slice(0, 300) : undefined,
  };
}

export function parsePersonaCatalog(payload: unknown) {
  if (!payload || typeof payload !== 'object' || !('items' in payload)
    || !Array.isArray(payload.items) || payload.items.length > PERSONA_MAX_ENTRIES) {
    throw new Error('catalog-invalid');
  }
  const items = payload.items.map(parsePublicPersona);
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error('catalog-invalid');
  return { items };
}

export async function personaSha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}
