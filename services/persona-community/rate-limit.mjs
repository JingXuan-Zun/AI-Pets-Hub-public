import { PersonaHttpError } from './http.mjs';
import { personaSha256 } from '../../src/persona-community/personaCommunitySchema.ts';

const SQL = `INSERT INTO persona_request_limits (bucket, window_start, used)
  VALUES (?, ?, 1) ON CONFLICT (bucket, window_start)
  DO UPDATE SET used = used + 1 WHERE used < ? RETURNING used`;

export async function enforcePersonaQuota(request, env, write, now) {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip || ip.length > 64) throw new PersonaHttpError(403, 'request-rejected');
  const minute = Math.floor(now / 60000) * 60;
  const day = Math.floor(now / 86400000) * 86400;
  const hash = await personaSha256(new TextEncoder().encode(`${env.RATE_SALT}:${day}:${ip}`));
  const rules = write
    ? [[`write:${hash}`, minute, 5], ['write:global', minute, 10], ['write:daily', day, 100]]
    : [[`read:${hash}`, minute, 30], ['read:global', minute, 30]];
  // Quotas are atomically capped in D1, shared by all Worker instances/regions.
  const results = await env.RATE_DB.batch([
    env.RATE_DB.prepare('DELETE FROM persona_request_limits WHERE window_start < ?').bind(day - 86400),
    ...rules.map(([key, window, limit]) => env.RATE_DB.prepare(SQL).bind(key, window, limit)),
  ]);
  if (results.length !== rules.length + 1 || results.some((result) => result.success !== true)) {
    throw new PersonaHttpError(503, 'service-unavailable');
  }
  if (results.slice(1).some((result) => result.results?.length !== 1)) {
    throw new PersonaHttpError(429, 'rate-limited');
  }
}
