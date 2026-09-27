import type { PetConfig, PetConfigUpdateHandler } from '../../../../types';
import {
  buildGroupTopicKey,
  createGroupTopicSnapshot,
  findGroupTopicSnapshot,
  upsertGroupTopicSnapshot,
} from '../../../../group-topic';
import type { GroupChatRuntime } from '../runtime/groupChatRuntime';

export function restoreGroupTopicRuntime(options: {
  config: PetConfig;
  roleIds: string[];
  runtime: GroupChatRuntime;
}) {
  const groupKey = buildGroupTopicKey(options.roleIds);
  const snapshot = findGroupTopicSnapshot(options.config.groupTopicRepository, groupKey);
  if (snapshot) options.runtime.controller.restoreTopicTimeline(snapshot);
  return groupKey;
}

export function commitGroupTopicRuntimeSnapshot(options: {
  configRef: { current: PetConfig };
  groupKey: string;
  onUpdateConfig: PetConfigUpdateHandler;
  runtime: GroupChatRuntime;
}) {
  const snapshot = createGroupTopicSnapshot(
    options.groupKey,
    options.runtime.controller.getSnapshot(),
  );
  const repository = upsertGroupTopicSnapshot(
    options.configRef.current.groupTopicRepository,
    snapshot,
  );
  if (repository === options.configRef.current.groupTopicRepository) return false;
  const nextConfig = { ...options.configRef.current, groupTopicRepository: repository };
  options.configRef.current = nextConfig;
  options.onUpdateConfig(nextConfig, { normalize: false, persist: true, priority: 'low' });
  return true;
}
