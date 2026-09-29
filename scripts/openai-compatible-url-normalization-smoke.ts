import assert from 'node:assert/strict';
import {
  normalizeOpenAICompatibleModelsUrl,
  normalizeOpenAICompatibleUrl,
  parseOpenAICompatibleModelIds,
} from '../src/modelProviderSettings';

assert.equal(
  normalizeOpenAICompatibleUrl('https://chat.example.com/v1'),
  'https://chat.example.com/v1/chat/completions',
);
assert.equal(
  normalizeOpenAICompatibleUrl('https://chat.example.com/v1/chat/completions'),
  'https://chat.example.com/v1/chat/completions',
);
assert.equal(
  normalizeOpenAICompatibleUrl('https://ark.example.com/api/v3/responses'),
  'https://ark.example.com/api/v3/chat/completions',
);
assert.equal(
  normalizeOpenAICompatibleUrl('https://ark.example.com/api/v3/responses?timeout=60'),
  'https://ark.example.com/api/v3/chat/completions?timeout=60',
);
assert.equal(
  normalizeOpenAICompatibleModelsUrl('https://chat.example.com/v1'),
  'https://chat.example.com/v1/models',
);
assert.equal(
  normalizeOpenAICompatibleModelsUrl('https://chat.example.com/v1/chat/completions'),
  'https://chat.example.com/v1/models',
);
assert.deepEqual(
  parseOpenAICompatibleModelIds({ data: [{ id: 'model-b' }, { id: 'model-a' }, { id: 'model-a' }] }),
  ['model-a', 'model-b'],
);
assert.deepEqual(parseOpenAICompatibleModelIds({ data: [{ object: 'model' }] }), []);

console.log('openai compatible url normalization smoke ok');
