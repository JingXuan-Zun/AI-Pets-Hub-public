import { useCallback, useEffect } from 'react';
import { advanceGroupTopicRepositoryTime } from '../../../../group-topic';
import type { PetConfig, PetConfigUpdateHandler } from '../../../../types';
import type { ActiveGroupRuntimeRef } from '../runtime/activeGroupRuntimeRef';

const GROUP_TOPIC_SCHEDULER_INTERVAL_MS = 60 * 1000;

export function useGroupTopicLifecycleScheduler(options: {
  activeGroupRuntimeRef: ActiveGroupRuntimeRef;
  configRef: { current: PetConfig };
  onUpdateConfig: PetConfigUpdateHandler;
}) {
  const runLifecycleTick = useCallback(() => {
    const activeSessionId = options.activeGroupRuntimeRef.get()
      ?.controller.getSnapshot().groupSessionId ?? null;
    const repository = advanceGroupTopicRepositoryTime({
      excludedGroupSessionId: activeSessionId,
      now: Date.now(),
      repository: options.configRef.current.groupTopicRepository,
    });
    if (repository === options.configRef.current.groupTopicRepository) return false;
    const nextConfig = { ...options.configRef.current, groupTopicRepository: repository };
    options.configRef.current = nextConfig;
    options.onUpdateConfig(nextConfig, { normalize: false, persist: true, priority: 'low' });
    return true;
  }, [options.activeGroupRuntimeRef, options.configRef, options.onUpdateConfig]);

  useEffect(() => {
    runLifecycleTick();
    const intervalId = window.setInterval(runLifecycleTick, GROUP_TOPIC_SCHEDULER_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [runLifecycleTick]);
}
