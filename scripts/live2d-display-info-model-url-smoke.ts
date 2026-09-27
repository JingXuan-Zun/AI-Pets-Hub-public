import assert from 'node:assert/strict';
import {
  loadLive2DDeclaredParameterIdsFromModelUrl,
  resolveLive2DDisplayInfoParameterIds,
} from '../src/pet-runtime/live2d/live2dDisplayInfoParameters';

assert.deepEqual(
  [...(resolveLive2DDisplayInfoParameterIds({
    Parameters: [
      { Id: 'ParamAngleX' },
      { Id: ' ParamAngleY ' },
      { Id: '' },
      null,
    ],
  }) ?? [])],
  ['ParamAngleX', 'ParamAngleY'],
);

const originalFetch = globalThis.fetch;
const requestedUrls: string[] = [];
globalThis.fetch = (async (input: string | URL | Request) => {
  const url = String(input);
  requestedUrls.push(url);
  if (url.endsWith('/character.model3.json')) {
    return new Response(JSON.stringify({ FileReferences: { DisplayInfo: 'character.cdi3.json' } }));
  }
  return new Response(JSON.stringify({ Parameters: [{ Id: 'ParamAngleX' }, { Id: 'CustomHeadY' }] }));
}) as typeof fetch;

try {
  const ids = await loadLive2DDeclaredParameterIdsFromModelUrl('https://example.test/live2d/character.model3.json');
  assert.deepEqual([...ids!], ['ParamAngleX', 'CustomHeadY']);
  assert.deepEqual(requestedUrls, [
    'https://example.test/live2d/character.model3.json',
    'https://example.test/live2d/character.cdi3.json',
  ]);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('live2d display info model URL smoke passed');
