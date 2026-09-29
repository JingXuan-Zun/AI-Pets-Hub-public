import type {
  StoryPromptInputMode,
  StoryPromptPreset,
  StoryPromptRole,
} from './storyPromptPresetTypes';

export type StorySource = 'manual' | 'imported' | 'random' | 'hybrid';

export interface StoryEntry {
  enabled: boolean;
  id: string;
  text: string;
}

export interface StorySectionOptions {
  goals: boolean;
  rules: boolean;
  tasks: boolean;
}

export type StoryParticipantEntryMode = 'opening' | 'condition';

export interface StoryParticipantRoute {
  entryCondition: string;
  entryMode: StoryParticipantEntryMode;
  participantId: string;
  priority: number;
}

export interface StoryDefinition {
  createdAt: number;
  customPrompt: string;
  customPromptEnabled: boolean;
  customPromptManualRole: StoryPromptRole;
  customPromptMode: StoryPromptInputMode;
  customPromptPreset: StoryPromptPreset | null;
  customPromptPresetName: string;
  customScript: string;
  failureCondition: string;
  id: string;
  openingScene: string;
  initialTime: string;
  participantIds: string[];
  participantRoutes: StoryParticipantRoute[];
  premise: string;
  rules: StoryEntry[];
  sections: StorySectionOptions;
  setting: string;
  source: StorySource;
  successCondition: string;
  tasks: StoryEntry[];
  title: string;
  updatedAt: number;
  userRole: string;
  version: 1;
  goals: StoryEntry[];
}

export type StoryTaskStatus = 'pending' | 'completed' | 'failed' | 'skipped';
export type StorySessionStatus = 'active' | 'completed' | 'failed' | 'stopped';

export type StoryParticipantRuntimeStatus = 'locked' | 'available' | 'active' | 'away' | 'removed';

export interface StoryParticipantRuntimeState {
  currentGoal: string;
  currentLocation: string;
  emotionalState: string;
  introducedTurn: number | null;
  knowledgeState: string;
  lastSeenTurn: number | null;
  participantId: string;
  status: StoryParticipantRuntimeStatus;
}

export interface StoryRelationshipUpdate {
  delta: number;
  reason: string;
  sourceParticipantId: string;
  targetParticipantId: string;
}

export interface StoryCharacterStateUpdate {
  currentGoal?: string;
  currentLocation?: string;
  emotionalState?: string;
  knowledgeState?: string;
  participantId: string;
  status?: StoryParticipantRuntimeStatus;
}

export interface StoryTaskUpdate {
  reason: string;
  status: StoryTaskStatus;
  taskId: string;
}

export interface StoryEventRecord {
  participantIds: string[];
  scene: string;
  text: string;
  turn: number;
  type: 'action' | 'arrival' | 'departure' | 'discovery' | 'relationship' | 'task' | 'scene';
}

export interface StoryStatePatch {
  characterUpdates: StoryCharacterStateUpdate[];
  currentTime?: string;
  goalUpdates: Array<{ goalId: string; progress: string }>;
  inventoryAdd: string[];
  inventoryRemove: string[];
  relationshipUpdates: StoryRelationshipUpdate[];
  taskUpdates: StoryTaskUpdate[];
  events: StoryEventRecord[];
}

export interface StorySceneTransition {
  changed: boolean;
  from: string;
  process: string;
  reason: string;
  to: string;
}

export interface StoryNarrativeBeat {
  action: string;
  innerState: string;
  participantId: string;
  visibleCue: string;
}

export interface StoryTurnPublicAnalysis {
  characterPlan: string;
  outputPlan: string;
  plotPlan: string;
  requestUnderstanding: string;
}

export type StoryTurnPacingMode = 'event' | 'progression' | 'response';

export interface StoryTurnPlan {
  actionResult: string;
  activeSpeakerIds: string[];
  elapsedMinutes: number;
  enteringParticipantIds: string[];
  leavingParticipantIds: string[];
  mediaHint: string;
  narrativeBeats: StoryNarrativeBeat[];
  narrationFocus: string;
  pacingMode: StoryTurnPacingMode;
  publicAnalysis: StoryTurnPublicAnalysis;
  sceneTransition: StorySceneTransition;
  statePatch: StoryStatePatch;
  suggestedActions: string[];
}

export interface StorySessionState {
  activeCast: string[];
  characterStates: Record<string, StoryParticipantRuntimeState>;
  currentScene: string;
  currentTime: string;
  currentTurn: number;
  definition: StoryDefinition;
  elapsedMinutes: number;
  eventLog: StoryEventRecord[];
  goalProgress: Record<string, string>;
  inventory: string[];
  lastTurnPlan: StoryTurnPlan | null;
  recentEvents: string[];
  relationships: Record<string, number>;
  startedAt: number;
  status: StorySessionStatus;
  suggestedActions: string[];
  taskStatuses: Record<string, StoryTaskStatus>;
  triggeredRuleIds: string[];
}

export interface StoryParticipantOption {
  id: string;
  name: string;
}

export type StoryGenerationMode = 'random' | 'complete';
