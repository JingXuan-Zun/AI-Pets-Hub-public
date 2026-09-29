import type { DesktopPetGroupChatContinuationMode } from '../../../../chatState';
import type {
  GroupTopicHistoryEntry,
  GroupTopicStatus,
  GroupTopicTransitionAuditEntry,
} from '../topic/topicLifecycle';
import type { GroupUserTopicState } from '../topic/groupUserTopicState';
import type { GroupGenerationBatch } from '../orchestration/groupGenerationBatch';
import type { GroupTaskCollaborationPlan } from '../task/groupTaskCollaborationPlan';

export type GroupTopicDerivationSuggestion = {
  parentTopicId: string;
  roleId: string;
  suggestedAt: number;
  turnId: string;
};

export type GroupSessionStatus =
  | 'idle'
  | 'planning'
  | 'speaking'
  | 'waiting-next-speaker'
  | 'waiting-task'
  | 'paused'
  | 'resuming'
  | 'completing'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type GroupSessionCancellationScope =
  | 'none'
  | 'current-turn'
  | 'group-session';

export interface GroupSessionRecord {
  groupSessionId: string;
  mode: DesktopPetGroupChatContinuationMode;
  status: GroupSessionStatus;
  activeRoleIds: string[];
  currentTurnId: string | null;
  currentTopicId: string | null;
  groupUserTopicState: GroupUserTopicState | null;
  generationBatch: GroupGenerationBatch | null;
  taskCollaborationPlan: GroupTaskCollaborationPlan | null;
  currentTopicParentId: string | null;
  topicHistory: GroupTopicHistoryEntry[];
  topicAuditTrail: GroupTopicTransitionAuditEntry[];
  topicDerivationSequence: number;
  topicDerivationSuggestions: GroupTopicDerivationSuggestion[];
  topicStatus: GroupTopicStatus | null;
  topicUpdatedAt: number | null;
  currentSpeakerId: string | null;
  replyTargetIds: string[];
  turnQueue: string[];
  completedSpeakerIds: string[];
  pendingMention: string | null;
  pendingTaskId: string | null;
  cancellationScope: GroupSessionCancellationScope;
  createdAt: number;
  updatedAt: number;
}

export function createGroupSessionRecord(options: {
  activeRoleIds: string[];
  groupSessionId: string;
  mode: DesktopPetGroupChatContinuationMode;
  now?: number;
}): GroupSessionRecord {
  const now = options.now ?? Date.now();
  return {
    groupSessionId: options.groupSessionId,
    mode: options.mode,
    status: 'idle',
    activeRoleIds: [...options.activeRoleIds],
    currentTurnId: null,
    currentTopicId: null,
    groupUserTopicState: null,
    generationBatch: null,
    taskCollaborationPlan: null,
    currentTopicParentId: null,
    topicHistory: [],
    topicAuditTrail: [],
    topicDerivationSequence: 0,
    topicDerivationSuggestions: [],
    topicStatus: null,
    topicUpdatedAt: null,
    currentSpeakerId: null,
    replyTargetIds: [],
    turnQueue: [],
    completedSpeakerIds: [],
    pendingMention: null,
    pendingTaskId: null,
    cancellationScope: 'none',
    createdAt: now,
    updatedAt: now,
  };
}

export function updateGroupSessionRecord(
  record: GroupSessionRecord,
  patch: Partial<Omit<GroupSessionRecord, 'groupSessionId' | 'createdAt'>>,
  now = Date.now(),
): GroupSessionRecord {
  return { ...record, ...patch, updatedAt: now };
}
