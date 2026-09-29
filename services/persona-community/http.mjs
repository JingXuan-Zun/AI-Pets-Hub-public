import { readPersonaBody } from '../../src/persona-community/personaCommunityBody.ts';

export class PersonaHttpError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

export const PUBLIC_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Persona-Upload',
  'Access-Control-Expose-Headers': 'Content-Disposition, Retry-After',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
  'Cache-Control': 'no-store',
};

export function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status, headers: { ...PUBLIC_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function boundedJson(response, maxBytes) {
  const bytes = await readPersonaBody(response, maxBytes);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

export function requireConfig(env, write = false) {
  if (!env.GITHUB_TOKEN || !env.RATE_DB || !env.RATE_SALT) {
    throw new PersonaHttpError(503, 'service-unavailable');
  }
  if (write && env.UPLOADS_ENABLED !== 'true') throw new PersonaHttpError(503, 'uploads-paused');
}
