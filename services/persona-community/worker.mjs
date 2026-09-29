import { PERSONA_ID_PATTERN } from '../../src/persona-community/personaCommunitySchema.ts';
import { createPersonaGithub, publishPersona } from './github.mjs';
import { downloadPersona, readPersonaUpload } from './files.mjs';
import { enforcePersonaQuota } from './rate-limit.mjs';
import { jsonResponse, PersonaHttpError, PUBLIC_HEADERS, requireConfig } from './http.mjs';

async function routePersonaRequest(request, env, fetchImpl, now) {
  const path = new URL(request.url).pathname;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: PUBLIC_HEADERS });
  if (request.method === 'GET' && ['/', '/health'].includes(path)) {
    const configured = Boolean(env.GITHUB_TOKEN && env.RATE_DB && env.RATE_SALT);
    return jsonResponse({ ok: true, configured, uploadsEnabled: configured && env.UPLOADS_ENABLED === 'true' });
  }
  const downloadMatch = /^\/personas\/([a-f0-9]{64})\/download$/.exec(path);
  const write = path === '/personas' && request.method === 'POST';
  if (!(path === '/personas' || downloadMatch)) throw new PersonaHttpError(404, 'not-found');
  if (!(request.method === 'GET' || write)) throw new PersonaHttpError(405, 'method-not-allowed');
  requireConfig(env, write);
  try {
    await enforcePersonaQuota(request, env, write, now);
  } catch (error) {
    console.error('persona-community stage failed', JSON.stringify({
      code: error instanceof PersonaHttpError ? error.code : 'quota-runtime-error', stage: 'quota',
    }));
    throw error;
  }
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(25000)]);
  const github = createPersonaGithub(env, fetchImpl, signal);
  if (write) {
    const { entry, bytes } = await readPersonaUpload(request, now);
    return jsonResponse(await publishPersona(github, entry, bytes), 201);
  }
  if (downloadMatch && PERSONA_ID_PATTERN.test(downloadMatch[1])) return downloadPersona(github, downloadMatch[1]);
  try {
    return jsonResponse(await github.catalog());
  } catch (error) {
    console.error('persona-community stage failed', JSON.stringify({
      code: error instanceof PersonaHttpError ? error.code : error instanceof SyntaxError ? 'catalog-json-invalid' : 'github-read-runtime-error', stage: 'github-read',
    }));
    throw error;
  }
}

export function createPersonaCommunityWorker({ fetchImpl = fetch, now = Date.now } = {}) {
  return {
    async fetch(request, env) {
      let stage = 'route';
      try {
        stage = 'routing';
        const path = new URL(request.url).pathname;
        if (path === '/personas') stage = request.method === 'POST' ? 'upload' : 'list';
        else if (path.startsWith('/personas/')) stage = 'download';
        return await routePersonaRequest(request, env, fetchImpl, now());
      }
      catch (error) {
        // Never echo GitHub/D1 errors, credentials, input text, or stack traces.
        const diagnosticCode = error instanceof PersonaHttpError ? error.code : 'internal-error';
        console.error('persona-community request failed', JSON.stringify({ code: diagnosticCode, stage }));
        const known = error instanceof PersonaHttpError && error.code !== 'github-unavailable';
        const response = jsonResponse({ error: known ? error.code : 'service-unavailable' }, known ? error.status : 503);
        if (response.status === 429) response.headers.set('Retry-After', '60');
        return response;
      }
    },
  };
}

export default createPersonaCommunityWorker();
