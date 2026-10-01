import assert from 'node:assert/strict';
import { resolveConfig } from 'vite';

const previousKey = process.env.GEMINI_API_KEY;
const sentinel = 'review-only-do-not-inline-this-credential';
try {
  process.env.GEMINI_API_KEY = sentinel;
  const config = await resolveConfig({}, 'build', 'production');
  assert.equal(Object.hasOwn(config.define ?? {}, 'process.env.GEMINI_API_KEY'), false,
    'Renderer builds must not inject provider credentials.');
  assert.equal(JSON.stringify(config.define).includes(sentinel), false);
} finally {
  if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = previousKey;
}
console.log('gemini build credentials smoke passed');
