import { randomBytes } from 'node:crypto';
import { PERSONA_ID_PATTERN } from '../../src/persona-community/personaCommunitySchema.ts';
import { readPersonaUpload, downloadPersona } from '../persona-community/files.mjs';
import { enforcePersonaQuota } from '../persona-community/rate-limit.mjs';
import { jsonResponse, PersonaHttpError, PUBLIC_HEADERS } from '../persona-community/http.mjs';

export function createLocalPersonaHandler({ store, uploadsEnabled = false, now = Date.now }) {
  const salt = store.getOrCreateSecret('quota-salt', () => randomBytes(32).toString('hex'));
  return async function handle(request, remoteAddress) {
    try {
      const pathname = new URL(request.url).pathname;
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: PUBLIC_HEADERS });
      if (request.method === 'GET' && ['/', '/health'].includes(pathname)) {
        return jsonResponse({ ok: true, configured: true, uploadsEnabled });
      }
      const match = /^\/personas\/([a-f0-9]{64})\/download$/.exec(pathname);
      if (pathname !== '/personas' && !match) throw new PersonaHttpError(404, 'not-found');
      const write = pathname === '/personas' && request.method === 'POST';
      if (request.method !== 'GET' && !write) throw new PersonaHttpError(405, 'method-not-allowed');
      if (write && !uploadsEnabled) throw new PersonaHttpError(503, 'uploads-paused');
      // The socket is authoritative. Never trust forwarded IP headers from users.
      const quotaRequest = new Request('http://localhost/quota', {
        headers: { 'CF-Connecting-IP': remoteAddress ?? '' },
      });
      await enforcePersonaQuota(quotaRequest, { RATE_DB: store.quotaBinding, RATE_SALT: salt }, write, now());
      if (write) {
        const { entry, bytes } = await readPersonaUpload(request, now());
        if (request.signal.aborted) throw new PersonaHttpError(408, 'request-rejected');
        return jsonResponse(store.publish(entry, bytes), 201);
      }
      if (match && PERSONA_ID_PATTERN.test(match[1])) return await downloadPersona(store, match[1]);
      return jsonResponse(store.catalog());
    } catch (error) {
      const known = error instanceof PersonaHttpError;
      console.error('persona selfhost request failed', JSON.stringify({ code: known ? error.code : 'internal-error' }));
      const response = jsonResponse({ error: known ? error.code : 'service-unavailable' }, known ? error.status : 503);
      if (response.status === 429) response.headers.set('Retry-After', '60');
      return response;
    }
  };
}
