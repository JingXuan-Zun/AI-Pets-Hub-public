import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { GroupChatRuntime } from '../src/components/chat/group/runtime/groupChatRuntime';
import {
  commitGroupTopicRuntimeSnapshot,
  restoreGroupTopicRuntime,
} from '../src/components/chat/group/topic/groupTopicPersistence';
import {
  EMPTY_GROUP_TOPIC_REPOSITORY,
  normalizeGroupTopicRepository,
} from '../src/group-topic';
import type { PetConfig, PetConfigUpdateHandler } from '../src/types';

const require = createRequire(import.meta.url);
const { createPersistedConfigStore } = require('../electron/persistedConfigStore.cjs') as {
  createPersistedConfigStore: (options: { userDataPath: string }) => {
    load: () => { config: PetConfig; ok: boolean };
    save: (config: PetConfig) => { ok: boolean };
  };
};

function commitRuntime(config: PetConfig, runtime: GroupChatRuntime) {
  const configRef = { current: config };
  const onUpdateConfig: PetConfigUpdateHandler = (nextConfig) => {
    configRef.current = nextConfig;
  };
  assert.equal(commitGroupTopicRuntimeSnapshot({
    configRef, groupKey: 'a|b', onUpdateConfig, runtime,
  }), true);
  return configRef.current;
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'group-topic-restart-'));

try {
  const firstRuntime = new GroupChatRuntime({
    activeRoleIds: ['a', 'b'], groupSessionId: 'group-first', mode: 'infinite',
  });
  firstRuntime.controller.updateTopic({ hasNewUserInput: true, topicId: 'topic-first' });
  firstRuntime.controller.updateTopic({ hasNewInformation: true, repeatedReplyCount: 0 });
  firstRuntime.beginPlanning();
  firstRuntime.controller.waitForTask('task-1');
  const firstAudit = firstRuntime.controller.getSnapshot().topicAuditTrail;

  const store = createPersistedConfigStore({ userDataPath: tempRoot });
  const baseConfig = { groupTopicRepository: EMPTY_GROUP_TOPIC_REPOSITORY } as PetConfig;
  assert.equal(store.save(commitRuntime(baseConfig, firstRuntime)).ok, true);
  const firstLoad = store.load();
  assert.equal(firstLoad.ok, true);

  const restartedRuntime = new GroupChatRuntime({
    activeRoleIds: ['a', 'b'], groupSessionId: 'group-restarted', mode: 'single-round',
  });
  const restartedConfig = {
    ...firstLoad.config,
    groupTopicRepository: normalizeGroupTopicRepository(firstLoad.config.groupTopicRepository),
  };
  restoreGroupTopicRuntime({ config: restartedConfig, roleIds: ['b', 'a'], runtime: restartedRuntime });
  const restarted = restartedRuntime.controller.getSnapshot();
  assert.deepEqual(restarted.topicAuditTrail, firstAudit);
  assert.equal(restarted.topicHistory.at(-1)?.id, 'topic-first');

  restartedRuntime.controller.updateTopic({ hasNewUserInput: true, topicId: 'topic-after-restart' });
  assert.equal(store.save(commitRuntime(restartedConfig, restartedRuntime)).ok, true);
  const secondLoad = store.load();
  const secondSnapshot = normalizeGroupTopicRepository(
    secondLoad.config.groupTopicRepository,
  ).snapshots[0];
  assert.equal(secondSnapshot.currentTopicId, 'topic-after-restart');
  assert.equal(secondSnapshot.topicAuditTrail.length, firstAudit.length + 1);
  assert.equal(secondSnapshot.topicAuditTrail.at(-1)?.source, 'user-input');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}

console.log('group topic packaged restart smoke ok');
