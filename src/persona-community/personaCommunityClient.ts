import { readPersonaBody } from './personaCommunityBody';
import { PERSONA_MAX_CATALOG_BYTES, PERSONA_MAX_FILE_BYTES, parsePersonaCatalog, parsePublicPersona, personaSha256, validatePersonaBytes } from './personaCommunitySchema';
import type { PersonaCommunityConfig, PublicPersonaEntry } from './personaCommunityTypes';

const ERROR_MESSAGES: Record<string, string> = {
  'file-format': '仅支持 TXT、MD、JSON 文件。',
  'file-size': '请选择非空且不超过 2 MB 的文件。',
  'file-encoding': '文件需要使用 UTF-8 文本编码。',
  'file-content': '请选择有效的文本文件。',
  'file-json': 'JSON 文件格式不正确。',
  'rate-limited': '操作过于频繁，请稍后再试。',
  'uploads-paused': '分享服务暂时停止接收上传。',
  'catalog-full': '分享空间暂时已满，请稍后再试。',
  'upload-conflict': '同时上传的人较多，请稍后重试同一文件。',
  'persona-not-found': '这个分享文件已不可用。',
  'download-invalid': '文件校验失败，请重新下载。',
};

export function personaCommunityErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? ERROR_MESSAGES[error.message] ?? fallback : fallback;
}

function endpoint(config: PersonaCommunityConfig, path: string) {
  const url = new URL(config.apiUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('api-url-invalid');
  return `${url.href.replace(/\/$/u, '')}${path}`;
}

async function ensureSuccess(response: Response) {
  if (response.ok) return;
  const bytes = await readPersonaBody(response, 4096);
  let payload: { error?: string };
  try { payload = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('service-unavailable'); }
  throw new Error(payload.error && ERROR_MESSAGES[payload.error] ? payload.error : 'service-unavailable');
}

export function createPersonaCommunityClient(config: PersonaCommunityConfig, fetchImpl: typeof fetch = fetch) {
  async function request(path: string, init: RequestInit, signal?: AbortSignal) {
    const timeout = AbortSignal.timeout(40000);
    const response = await fetchImpl(endpoint(config, path), {
      ...init, redirect: 'error', credentials: 'omit', cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    await ensureSuccess(response);
    return response;
  }
  return {
    async list(signal?: AbortSignal) {
      const response = await request('/personas', { method: 'GET' }, signal);
      const bytes = await readPersonaBody(response, PERSONA_MAX_CATALOG_BYTES);
      return parsePersonaCatalog(JSON.parse(new TextDecoder().decode(bytes))).items;
    },
    async upload(file: File, signal?: AbortSignal) {
      if (file.size < 1 || file.size > PERSONA_MAX_FILE_BYTES) throw new Error('file-size');
      validatePersonaBytes(new Uint8Array(await file.arrayBuffer()), file.name);
      if (signal?.aborted) throw signal.reason;
      const body = new FormData();
      body.append('file', file, file.name);
      const response = await request('/personas', { method: 'POST', body, headers: { 'X-Persona-Upload': '1' } }, signal);
      const bytes = await readPersonaBody(response, 8192);
      return parsePublicPersona(JSON.parse(new TextDecoder().decode(bytes)));
    },
    async download(item: PublicPersonaEntry, signal?: AbortSignal) {
      const entry = parsePublicPersona(item);
      const response = await request(`/personas/${entry.id}/download`, { method: 'GET' }, signal);
      const bytes = await readPersonaBody(response, PERSONA_MAX_FILE_BYTES);
      if (bytes.length !== entry.sizeBytes || await personaSha256(bytes) !== entry.sha256) throw new Error('download-invalid');
      return { blob: new Blob([new Uint8Array(bytes).buffer], { type: 'application/octet-stream' }), filename: entry.filename };
    },
  };
}
