import { PERSONA_MAX_CATALOG_BYTES, PERSONA_MAX_ENTRIES, parsePersonaCatalog } from '../../src/persona-community/personaCommunitySchema.ts';
import { readPersonaBody } from '../../src/persona-community/personaCommunityBody.ts';
import { boundedJson, PersonaHttpError } from './http.mjs';

const REPOSITORY = '575738264/ai-desktop-pet-personas';
const API_BASE = 'https://api.github.com/repos/' + REPOSITORY;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;

function safeErrorDetail(error) {
  if (!(error instanceof Error)) return { name: 'unknown', message: 'unknown' };
  return {
    name: error.name.slice(0, 40),
    message: error.message.replace(/https?:\/\/[^\s]+/gu, '<url>').slice(0, 120),
  };
}

export function createPersonaGithub(env, fetchImpl, signal) {
  async function call(path, method = 'GET', body) {
    const response = await fetchImpl(API_BASE + path, {
      method, redirect: 'manual', signal, cache: 'no-store',
      headers: {
        Authorization: 'Bearer ' + env.GITHUB_TOKEN,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'AI-Desktop-Pet-Persona-Community',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new PersonaHttpError(response.status, 'github-unavailable');
    }
    return response;
  }
  const json = async (...args) => boundedJson(await call(...args), PERSONA_MAX_CATALOG_BYTES * 2);
  const decodeContent = (payload) => {
    if (!payload || typeof payload !== 'object' || payload.encoding !== 'base64' || typeof payload.content !== 'string') {
      throw new PersonaHttpError(502, 'github-content-invalid');
    }
    const encoded = payload.content.replace(/\s+/gu, '');
    let binary;
    try { binary = atob(encoded); } catch { throw new PersonaHttpError(502, 'github-content-invalid'); }
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
  };
  const fileBytes = async (filePath, ref = 'main', maxBytes = PERSONA_MAX_CATALOG_BYTES) => {
    try {
      const payload = await boundedJson(await call('/contents/' + filePath + '?ref=' + encodeURIComponent(ref)), maxBytes * 2);
      const bytes = decodeContent(payload);
      if (bytes.byteLength > maxBytes) throw new PersonaHttpError(502, 'github-content-too-large');
      return bytes;
    } catch (error) {
      if (error instanceof PersonaHttpError && ['github-content-too-large', 'github-content-invalid'].includes(error.code)) throw error;
      const rawUrl = 'https://raw.githubusercontent.com/' + REPOSITORY + '/' + encodeURIComponent(ref) + '/' + filePath.split('/').map(encodeURIComponent).join('/');
      console.error('persona-community github api read failed', JSON.stringify({ code: error instanceof PersonaHttpError ? error.code : error instanceof SyntaxError ? 'github-json-invalid' : 'github-api-runtime-error', detail: safeErrorDetail(error) }));
      try {
        const rawResponse = await fetchImpl(rawUrl, { method: 'GET', redirect: 'manual', signal, cache: 'no-store', headers: { Accept: 'text/plain', 'User-Agent': 'AI-Desktop-Pet-Persona-Community' } });
        if (!rawResponse.ok) { await rawResponse.body?.cancel(); throw new PersonaHttpError(rawResponse.status, 'github-raw-unavailable'); }
        return readPersonaBody(rawResponse, maxBytes);
      } catch (rawError) {
        console.error('persona-community github raw read failed', JSON.stringify({ code: rawError instanceof PersonaHttpError ? rawError.code : rawError instanceof SyntaxError ? 'github-raw-invalid' : 'github-raw-runtime-error', detail: safeErrorDetail(rawError) }));
        throw rawError;
      }
    }
  };
  const catalog = async (ref = 'main') => {
    const bytes = await fileBytes('catalog/index.json', ref, PERSONA_MAX_CATALOG_BYTES);
    let catalogPayload;
    try { catalogPayload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { throw new PersonaHttpError(502, 'catalog-json-invalid'); }
    return parsePersonaCatalog(catalogPayload);
  };
  return { call, json, fileBytes, catalog };
}

async function readSnapshot(github) {
  const head = await github.json('/git/ref/heads/main');
  const sha = head.object?.sha;
  if (!/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('head-invalid');
  const [commit, catalog] = await Promise.all([
    github.json('/git/commits/' + sha), github.catalog(sha),
  ]);
  if (!/^[a-f0-9]{40}$/.test(commit.tree?.sha ?? '')) throw new Error('tree-invalid');
  return { sha, tree: commit.tree.sha, catalog };
}

function encodeBase64(bytes) {
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += 16384) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 16384)));
  return btoa(chunks.join(''));
}

function updatedCatalog(catalog, entry) {
  if (catalog.items.length >= PERSONA_MAX_ENTRIES || catalog.items.reduce((total, item) => total + item.sizeBytes, entry.sizeBytes) > MAX_TOTAL_BYTES) throw new PersonaHttpError(507, 'catalog-full');
  const text = JSON.stringify({ items: [entry, ...catalog.items] }, null, 2) + '\n';
  if (new TextEncoder().encode(text).length > PERSONA_MAX_CATALOG_BYTES) throw new PersonaHttpError(507, 'catalog-full');
  return text;
}

async function commitPersona(github, snapshot, entry, blobSha, content) {
  const tree = await github.json('/git/trees', 'POST', { base_tree: snapshot.tree, tree: [
    { path: 'personas/' + entry.id + '.' + entry.format, mode: '100644', type: 'blob', sha: blobSha },
    { path: 'catalog/index.json', mode: '100644', type: 'blob', content },
  ] });
  const commit = await github.json('/git/commits', 'POST', { message: 'Share persona ' + entry.id.slice(0, 12), tree: tree.sha, parents: [snapshot.sha] });
  await github.json('/git/refs/heads/main', 'PATCH', { sha: commit.sha, force: false });
}

export async function publishPersona(github, entry, bytes) {
  let blobSha;
  for (let attempt = 0; attempt < 3; attempt++) {
    const snapshot = await readSnapshot(github);
    if (snapshot.catalog.items.some((item) => item.id === entry.id)) return snapshot.catalog.items.find((item) => item.id === entry.id);
    const content = updatedCatalog(snapshot.catalog, entry);
    if (!blobSha) blobSha = (await github.json('/git/blobs', 'POST', { encoding: 'base64', content: encodeBase64(bytes) })).sha;
    try { await commitPersona(github, snapshot, entry, blobSha, content); return entry; }
    catch (error) {
      if (!(error instanceof PersonaHttpError) || ![409, 422].includes(error.status)) throw error;
    }
  }
  throw new PersonaHttpError(409, 'upload-conflict');
}
