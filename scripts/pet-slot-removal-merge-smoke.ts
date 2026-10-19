import assert from 'node:assert/strict';
import { mergePetConfigUpdateFromBase } from '../src/petConfigUpdateMerge';
import { type PetConfig } from '../src/types';

// A pet slot deleted in settings must stay deleted, and one added elsewhere must survive,
// even when the settings panel's diff base is older than the live config.
const pet = (id: string, name = id) => ({ id, personality: { name } });
const config = (...ids: string[]) => ({ companionPets: ids.map((id) => pet(id)), scale: 1 }) as unknown as PetConfig;
const ids = (value: PetConfig) => value.companionPets.map((item) => item.id);

// Deleting slot 3: base and next differ only by it, live config has it.
assert.deepEqual(ids(mergePetConfigUpdateFromBase(config('p2', 'p3'), config('p2'), config('p2', 'p3'))), ['p2']);
// A pet created from chat while settings was open (not in base, not in next) is kept.
assert.deepEqual(ids(mergePetConfigUpdateFromBase(config('p2', 'p3'), config('p2'), config('p2', 'p3', 'p4'))), ['p2', 'p4']);
// A pet deleted elsewhere does not come back when settings saves an unrelated change.
assert.deepEqual(ids(mergePetConfigUpdateFromBase(
  { ...config('p2', 'p3'), scale: 1 } as PetConfig,
  { ...config('p2', 'p3'), scale: 2 } as PetConfig,
  config('p2'),
)), ['p2']);
const renamed = { companionPets: [pet('p2'), pet('p3', 'renamed')], scale: 1 } as unknown as PetConfig;
assert.deepEqual(ids(mergePetConfigUpdateFromBase(config('p2', 'p3'), renamed, config('p2'))), ['p2', 'p3']);
// The settings delete widens a stale base to contain the pet; the delete then applies.
assert.deepEqual(ids(mergePetConfigUpdateFromBase(config('p2', 'p5'), config('p2'), config('p2', 'p5'))), ['p2']);
console.log('pet slot removal merge smoke ok');
