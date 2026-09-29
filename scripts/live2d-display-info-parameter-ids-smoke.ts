import assert from 'node:assert/strict';
import { loadLive2DDeclaredParameterIds } from '../src/pet-runtime/live2d/live2dDisplayInfoParameters';

let requestedUrl = '';
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  value: async (url: string) => {
    requestedUrl = url;
    return {
      json: async () => ({
        Parameters: [
          { Id: 'ParamAngleX', Name: 'Angle X' },
          { Id: ' ParamAngleY ', Name: 'Angle Y' },
          { Id: '' },
          { Name: 'Missing ID' },
        ],
      }),
      ok: true,
    };
  },
});

const parameterIds = await loadLive2DDeclaredParameterIds({
  internalModel: {
    settings: {
      json: {
        FileReferences: {
          DisplayInfo: 'character.cdi3.json',
        },
      },
      resolveURL: (path: string) => `desktop-pet-file://local/models/${path}`,
    },
  },
});

assert.equal(requestedUrl, 'desktop-pet-file://local/models/character.cdi3.json');
assert.deepEqual(parameterIds, new Set(['ParamAngleX', 'ParamAngleY']));
assert.equal(await loadLive2DDeclaredParameterIds({ internalModel: {} }), null);

Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  value: async () => {
    throw new Error('display info unavailable');
  },
});
assert.equal(await loadLive2DDeclaredParameterIds({
  internalModel: {
    settings: {
      json: { FileReferences: { DisplayInfo: 'missing.cdi3.json' } },
      resolveURL: (path: string) => path,
    },
  },
}), null);

console.log('live2d display info parameter ids smoke passed');
