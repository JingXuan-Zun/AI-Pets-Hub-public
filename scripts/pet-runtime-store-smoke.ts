import assert from 'node:assert/strict';
import {
  arePetRuntimePositionsEqual,
  shouldSyncPetRuntimeLivePosition,
} from '../src/pet-runtime/core/petRuntimeStore';

assert.equal(
  arePetRuntimePositionsEqual({ x: 10, y: 20 }, { x: 10, y: 20 }),
  true,
  'matching runtime positions should be equal',
);
assert.equal(
  arePetRuntimePositionsEqual({ x: 10, y: 20 }, { x: 11, y: 20 }),
  false,
  'different runtime positions should not be equal',
);

assert.equal(
  shouldSyncPetRuntimeLivePosition({
    lastSyncedAt: 1000,
    lastSyncedPosition: { x: 10, y: 10 },
    nextPosition: { x: 18, y: 16 },
    timestamp: 1080,
  }),
  false,
  'small recent movement should not force a live config sync',
);

assert.equal(
  shouldSyncPetRuntimeLivePosition({
    lastSyncedAt: 1000,
    lastSyncedPosition: { x: 10, y: 10 },
    nextPosition: { x: 42, y: 16 },
    timestamp: 1080,
  }),
  true,
  'large movement should force a live config sync even before the time threshold',
);

assert.equal(
  shouldSyncPetRuntimeLivePosition({
    lastSyncedAt: 1000,
    lastSyncedPosition: { x: 10, y: 10 },
    nextPosition: { x: 14, y: 12 },
    timestamp: 1200,
  }),
  true,
  'old sync timestamps should force a live config sync',
);

console.log('pet runtime store smoke ok');
