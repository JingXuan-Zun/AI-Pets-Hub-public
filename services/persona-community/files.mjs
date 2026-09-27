import { PERSONA_MAX_FILE_BYTES, personaSha256, validatePersonaBytes } from '../../src/persona-community/personaCommunitySchema.ts';
import { readPersonaBody } from '../../src/persona-community/personaCommunityBody.ts';
import { PersonaHttpError, PUBLIC_HEADERS } from './http.mjs';

export async function readPersonaUpload(request, now) {
  if (request.headers.get('X-Persona-Upload') !== '1'
    || !request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;')) {
    throw new PersonaHttpError(400, 'upload-format');
  }
  let raw;
  try { raw = await readPersonaBody(new Response(request.body, { headers: request.headers }), PERSONA_MAX_FILE_BYTES + 16384); }
  catch { throw new PersonaHttpError(413, 'file-size'); }
  let form;
  try { form = await new Response(raw, { headers: { 'content-type': request.headers.get('content-type') } }).formData(); }
  catch { throw new PersonaHttpError(400, 'upload-format'); }
  const parts = [...form.entries()];
  const file = parts[0]?.[1];
  if (parts.length !== 1 || parts[0][0] !== 'file' || typeof file === 'string' || !file) {
    throw new PersonaHttpError(400, 'upload-format');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let metadata;
  try { metadata = validatePersonaBytes(bytes, file.name); }
  catch (error) { throw new PersonaHttpError(400, error.message); }
  const sha256 = await personaSha256(bytes);
  const id = await personaSha256(new TextEncoder().encode(`${metadata.format}:${sha256}`));
  return {
    bytes, entry: { ...metadata, id, sha256, sizeBytes: bytes.length, createdAt: new Date(now).toISOString() },
  };
}

export async function downloadPersona(github, id) {
  const { items } = await github.catalog();
  const entry = items.find((item) => item.id === id);
  if (!entry) throw new PersonaHttpError(404, 'persona-not-found');
  const bytes = await github.fileBytes('personas/' + entry.id + '.' + entry.format, 'main', PERSONA_MAX_FILE_BYTES);
  if (bytes.length !== entry.sizeBytes || await personaSha256(bytes) !== entry.sha256) {
    throw new PersonaHttpError(502, 'download-invalid');
  }
  const encodedName = encodeURIComponent(entry.filename).replace(/['()*]/g, (value) => `%${value.charCodeAt(0).toString(16)}`);
  return new Response(bytes, {
    headers: {
      ...PUBLIC_HEADERS, 'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename="persona.${entry.format}"; filename*=UTF-8''${encodedName}`,
    },
  });
}
