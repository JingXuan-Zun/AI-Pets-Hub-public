import type { DesktopPetGroupChatContinuationMode } from '../../../../chatState';
import type { ChatGroupTaskEvent } from '../../../../types';
import type { ActiveGroupRuntimeRef } from '../runtime/activeGroupRuntimeRef';
import { GroupChatRuntime } from '../runtime/groupChatRuntime';
import type { GroupTaskCandidate } from './groupTaskBridge';

export type GroupTaskRuntimeResumeResult =
  | 'waiting'
  | 'resumed'
  | 'missing-runtime'
  | 'session-mismatch'
  | 'topic-mismatch'
  | 'task-mismatch';

export function startGroupTaskRuntime(options: {
  activeGroupRuntimeRef: ActiveGroupRuntimeRef;
  activeRoleIds: string[];
  candidate: GroupTaskCandidate;
  mode: DesktopPetGroupChatContinuationMode;
}) {
  const runtime = new GroupChatRuntime({
    activeRoleIds: options.activeRoleIds,
    groupSessionId: options.candidate.groupSessionId,
    mode: options.mode,
  });
  if (options.candidate.collaborationPlan) {
    runtime.controller.setTaskCollaborationPlan(options.candidate.collaborationPlan);
  }
  runtime.controller.updateTopic({
    hasNewUserInput: true,
    topicId: options.candidate.topicId ?? undefined,
  }, { reason: 'new-user-task', source: 'user-input' });
  runtime.beginPlanning();
  runtime.controller.waitForTask(options.candidate.taskId);
  options.activeGroupRuntimeRef.set(runtime);
  return runtime;
}

export function resumeGroupRuntimeFromTaskEvent(
  activeGroupRuntimeRef: ActiveGroupRuntimeRef,
  event: ChatGroupTaskEvent,
): GroupTaskRuntimeResumeResult {
  const runtime = activeGroupRuntimeRef.get();
  if (!runtime) {
    return 'missing-runtime';
  }
  const snapshot = runtime.controller.getSnapshot();
  if (snapshot.groupSessionId !== event.groupSessionId) {
    return 'session-mismatch';
  }
  if (snapshot.currentTopicId !== event.topicId) {
    return 'topic-mismatch';
  }
  if (snapshot.pendingTaskId !== event.taskId) {
    return 'task-mismatch';
  }
  if (event.type === 'task-pending-approval') {
    return 'waiting';
  }
  runtime.controller.resumeAfterTask(event.taskId);
  return 'resumed';
}

export function beginGroupTaskExplanation(
  activeGroupRuntimeRef: ActiveGroupRuntimeRef,
  event: ChatGroupTaskEvent,
  roleId: string,
) {
  const runtime = activeGroupRuntimeRef.get();
  const snapshot = runtime?.controller.getSnapshot();
  if (!runtime || snapshot?.groupSessionId !== event.groupSessionId || snapshot.status !== 'planning') {
    return false;
  }
  runtime.controller.beginSpeaking({
    speakerId: roleId,
    turnId: `${event.taskId}-result`,
  });
  return true;
}

export function completeGroupTaskExplanation(
  activeGroupRuntimeRef: ActiveGroupRuntimeRef,
  event: ChatGroupTaskEvent,
  roleId: string,
) {
  const runtime = activeGroupRuntimeRef.get();
  const snapshot = runtime?.controller.getSnapshot();
  if (!runtime || snapshot?.groupSessionId !== event.groupSessionId || snapshot.currentSpeakerId !== roleId) {
    return false;
  }
  runtime.controller.completeSpeaker(roleId);
  if (snapshot.mode === 'infinite') {
    runtime.waitForNextSpeaker([]);
    return true;
  }
  runtime.complete();
  activeGroupRuntimeRef.clear(runtime);
  return true;
}
