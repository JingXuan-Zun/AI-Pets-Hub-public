import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  normalizeDirectedRelationshipRepository,
  upsertDirectedRelationship,
} from '../src/character-relationship';
import type { PetConfig } from '../src/types';

const require = createRequire(import.meta.url);
const { createPersistedConfigStore } = require('../electron/persistedConfigStore.cjs') as {
  createPersistedConfigStore: (options: { userDataPath: string }) => {
    load: () => { config: PetConfig; ok: boolean };
    save: (config: PetConfig) => { ok: boolean };
  };
};

const repository = upsertDirectedRelationship(EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY, {
  dimensions: { intimacy: 71, trust: 82, vigilance: 19 }, evidenceSummary: 'manual restart test',
  sourceRoleId: 'alice', targetRoleId: 'berry', targetRoleName: 'Berry',
}, { now: 100, reason: 'created before restart', source: 'manual' });
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'relationship-restart-'));

try {
  const store = createPersistedConfigStore({ userDataPath: tempRoot });
  assert.equal(store.save({ directedRelationshipRepository: repository } as PetConfig).ok, true);
  const firstLoad = store.load();
  assert.equal(firstLoad.ok, true);
  const restored = normalizeDirectedRelationshipRepository(
    firstLoad.config.directedRelationshipRepository,
  );
  assert.deepEqual(restored, repository);

  const updated = upsertDirectedRelationship(restored, {
    ...restored.records[0]!, dimensions: { intimacy: 75, trust: 90, vigilance: 10 },
  }, { now: 200, reason: 'edited after restart', source: 'correction' });
  assert.equal(store.save({ ...firstLoad.config, directedRelationshipRepository: updated }).ok, true);
  const secondLoad = normalizeDirectedRelationshipRepository(
    store.load().config.directedRelationshipRepository,
  );
  assert.equal(secondLoad.records[0]?.dimensions.trust, 90);
  assert.equal(secondLoad.auditTrail.length, 2);
  assert.equal(secondLoad.auditTrail.at(-1)?.before?.dimensions.trust, 82);
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}

console.log('directed relationship packaged restart smoke ok');
