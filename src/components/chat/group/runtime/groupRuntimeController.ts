import type { DesktopPetGroupChatContinuationMode } from '../../../../chatState';
import {
  createGroupSessionRecord,
  type GroupSessionRecord,
  updateGroupSessionRecord,
} from '../state/groupSessionRecord';
import { transitionGroupSession } from '../state/groupStateTransitions';
import { resolveGroupTopicStatus, type GroupTopicLifecycleInput } from '../topic/topicLifecycle';
import {
  createArchiveTopicPatch,
  createDecayTopicPatch,
  createDerivedTopicPatch,
} from '../topic/topicStateOperations';
import { resolveTopicDerivationSuggestion } from '../topic/topicDerivationPolicy';
import {
  appendGroupTopicTransitionAudit,
  inferGroupTopicTransitionContext,
  type GroupTopicTransitionContext,
} from '../topic/topicTransitionAudit';
import { buildRestoredTopicHistory, type GroupTopicSnapshot } from '../../../../group-topic';
import {
  createGroupUserTopicState,
  markGroupUserTopicRoleAnswered,
} from '../topic/groupUserTopicState';
import {
  cancelGroupGenerationBatch,
  createGroupGenerationBatch,
  markGroupGenerationBatchFailed,
  markGroupGenerationBatchPublished,
  startGroupGenerationBatch,
} from '../orchestration/groupGenerationBatch';
import type { GroupTaskCollaborationPlan } from '../task/groupTaskCollaborationPlan';

export class GroupRuntimeController {
  private record: GroupSessionRecord;

  constructor(options: {
    activeRoleIds: string[];
    groupSessionId: string;
    mode: DesktopPetGroupChatContinuationMode;
    now?: number;
  }) {
    this.record = createGroupSessionRecord(options);
  }

  getSnapshot() {
    return {
      ...this.record,
      activeRoleIds: [...this.record.activeRoleIds],
      topicHistory: this.record.topicHistory.map((entry) => ({ ...entry })),
      topicAuditTrail: this.record.topicAuditTrail.map((entry) => ({ ...entry })),
      topicDerivationSuggestions: this.record.topicDerivationSuggestions.map((item) => ({ ...item })),
      generationBatch: this.record.generationBatch ? {
        ...this.record.generationBatch,
        candidateRoleIds: [...this.record.generationBatch.candidateRoleIds],
        failedRoleIds: [...this.record.generationBatch.failedRoleIds],
        publishedRoleIds: [...this.record.generationBatch.publishedRoleIds],
      } : null,
    };
  }

  beginPlanning() {
    this.record = transitionGroupSession(this.record, 'planning');
  }

  beginGenerationBatch(options: {
    batchId: string; candidateRoleIds: string[]; contextVersion: string; sourceMessageId: string | null;
  }) {
    this.record = updateGroupSessionRecord(this.record, {
      generationBatch: startGroupGenerationBatch(createGroupGenerationBatch(options)),
    });
  }

  markBatchRolePublished(roleId: string) {
    if (!this.record.generationBatch) return;
    this.record = updateGroupSessionRecord(this.record, {
      generationBatch: markGroupGenerationBatchPublished(this.record.generationBatch, roleId),
    });
  }

  markBatchRoleFailed(roleId: string) {
    if (!this.record.generationBatch) return;
    this.record = updateGroupSessionRecord(this.record, {
      generationBatch: markGroupGenerationBatchFailed(this.record.generationBatch, roleId),
    });
  }

  setTaskCollaborationPlan(plan: GroupTaskCollaborationPlan) {
    this.record = updateGroupSessionRecord(this.record, { taskCollaborationPlan: { ...plan } });
  }

  restoreTopicTimeline(snapshot: GroupTopicSnapshot) {
    this.record = updateGroupSessionRecord(this.record, {
      currentTopicId: null,
      groupUserTopicState: snapshot.groupUserTopicState
        ? { ...snapshot.groupUserTopicState }
        : null,
      currentTopicParentId: null,
      topicDerivationSequence: snapshot.topicDerivationSequence,
      topicDerivationSuggestions: [],
      topicHistory: buildRestoredTopicHistory(snapshot),
      topicAuditTrail: snapshot.topicAuditTrail.map((entry) => ({ ...entry })),
      topicStatus: null,
      topicUpdatedAt: snapshot.topicUpdatedAt,
    });
  }

  updateTopic(
    options: GroupTopicLifecycleInput & { topicId?: string },
    context = inferGroupTopicTransitionContext(options),
  ) {
    const topicId = options.topicId ?? this.record.currentTopicId;
    const now = Date.now();
    const topicStatus = resolveGroupTopicStatus(this.record.topicStatus, options);
    this.record = updateGroupSessionRecord(this.record, {
      currentTopicId: topicId,
      ...(topicId !== this.record.currentTopicId ? { topicDerivationSuggestions: [] } : {}),
      topicAuditTrail: appendGroupTopicTransitionAudit({
        auditTrail: this.record.topicAuditTrail,
        context,
        fromStatus: this.record.topicStatus,
        now,
        toStatus: topicStatus,
        topicId,
      }),
      topicStatus,
      topicUpdatedAt: now,
    }, now);
  }

  beginUserTopic(options: { addressedRoleIds: string[]; roleIds: string[]; sourceMessageId: string; topicId: string }) {
    const deferredTopicId = this.record.currentTopicId === options.topicId
      ? null
      : this.record.currentTopicId;
    this.record = updateGroupSessionRecord(this.record, {
      groupUserTopicState: createGroupUserTopicState({ ...options, deferredTopicId }),
    });
    this.updateTopic({ hasNewUserInput: true, topicId: options.topicId });
  }

  markUserTopicRoleAnswered(roleId: string) {
    if (!this.record.groupUserTopicState) return;
    this.record = updateGroupSessionRecord(this.record, {
      groupUserTopicState: markGroupUserTopicRoleAnswered(this.record.groupUserTopicState, roleId),
    });
  }

  archiveTopic(now = Date.now()) {
    const patch = createArchiveTopicPatch(this.record, now);
    if (patch) this.applyTopicPatch(patch, {
      reason: 'archive-requested', source: 'user-input',
    }, now);
  }

  deriveTopic(topicId: string, now = Date.now()) {
    const patch = createDerivedTopicPatch(this.record, topicId, now);
    if (patch) {
      this.applyTopicPatch({
        ...patch,
        topicDerivationSuggestions: [],
      }, { reason: 'topic-derived', source: 'derivation' }, now);
    }
  }

  suggestTopicDerivation(options: { roleId: string; turnId: string }, now = Date.now()) {
    const decision = resolveTopicDerivationSuggestion({ ...options, now, record: this.record });
    this.record = updateGroupSessionRecord(this.record, {
      topicDerivationSequence: decision.nextSequence,
      topicDerivationSuggestions: decision.suggestions,
    }, now);
    if (decision.confirmedTopicId) this.deriveTopic(decision.confirmedTopicId, now);
    return decision.confirmedTopicId;
  }

  decayTopic(inactivityMs: number, now = Date.now()) {
    const patch = createDecayTopicPatch(this.record, inactivityMs, now);
    if (patch) this.applyTopicPatch(patch, {
      reason: 'inactivity-threshold', source: 'inactivity',
    }, now);
  }

  private applyTopicPatch(
    patch: Partial<GroupSessionRecord>,
    context: GroupTopicTransitionContext,
    now: number,
  ) {
    const topicId = patch.currentTopicId ?? this.record.currentTopicId;
    const topicStatus = patch.topicStatus ?? this.record.topicStatus;
    if (!topicStatus) return;
    this.record = updateGroupSessionRecord(this.record, {
      ...patch,
      topicAuditTrail: appendGroupTopicTransitionAudit({
        auditTrail: this.record.topicAuditTrail, context,
        fromStatus: topicId === this.record.currentTopicId ? this.record.topicStatus : null,
        now, toStatus: topicStatus, topicId,
      }),
    }, now);
  }

  beginSpeaking(options: { turnId: string; speakerId: string; replyTargetIds?: string[] }) {
    this.record = transitionGroupSession(this.record, 'speaking');
    this.record = updateGroupSessionRecord(this.record, {
      currentTurnId: options.turnId,
      currentSpeakerId: options.speakerId,
      replyTargetIds: [...(options.replyTargetIds ?? [])],
      turnQueue: this.record.turnQueue.filter((roleId) => roleId !== options.speakerId),
    });
  }

  completeSpeaker(speakerId: string) {
    const completedSpeakerIds = this.record.completedSpeakerIds.includes(speakerId)
      ? this.record.completedSpeakerIds
      : [...this.record.completedSpeakerIds, speakerId];
    this.record = updateGroupSessionRecord(this.record, { completedSpeakerIds });
  }

  waitForNextSpeaker(turnQueue: string[]) {
    this.record = transitionGroupSession(this.record, 'waiting-next-speaker');
    this.record = updateGroupSessionRecord(this.record, {
      currentSpeakerId: null,
      replyTargetIds: [],
      turnQueue: [...turnQueue],
    });
  }

  waitForTask(taskId: string) {
    this.record = transitionGroupSession(this.record, 'waiting-task');
    this.record = updateGroupSessionRecord(this.record, {
      currentSpeakerId: null,
      pendingTaskId: taskId,
    });
    if (this.record.currentTopicId) this.updateTopic(
      { waitingForInformation: true },
      { reason: 'waiting-for-task-information', source: 'task' },
    );
  }

  resumeAfterTask(taskId: string) {
    if (this.record.pendingTaskId !== taskId) {
      throw new Error(`Group task receipt mismatch: expected ${this.record.pendingTaskId}, received ${taskId}`);
    }
    this.record = transitionGroupSession(this.record, 'resuming');
    this.record = updateGroupSessionRecord(this.record, { pendingTaskId: null });
    this.record = transitionGroupSession(this.record, 'planning');
    if (this.record.currentTopicId) this.updateTopic(
      { hasNewInformation: true },
      { reason: 'new-task-information', source: 'task' },
    );
  }

  complete() {
    this.record = transitionGroupSession(this.record, 'completing');
    this.record = transitionGroupSession(this.record, 'completed');
  }

  fail() {
    if (this.record.status === 'failed' || this.record.status === 'cancelled') {
      return;
    }
    this.record = transitionGroupSession(this.record, 'failed');
  }

  cancel(scope: 'current-turn' | 'group-session' = 'group-session') {
    if (this.record.status === 'completed' || this.record.status === 'cancelled') {
      return;
    }
    this.record = updateGroupSessionRecord(this.record, {
      cancellationScope: scope,
      generationBatch: this.record.generationBatch
        ? cancelGroupGenerationBatch(this.record.generationBatch) : null,
    });
    this.record = transitionGroupSession(this.record, 'cancelled');
  }
}
