export type RuntimeWorldLifecycleState = 'idle' | 'running' | 'paused' | 'shutdown';

export type RuntimeWorldMainState =
  | 'idle'
  | 'interacting'
  | 'listening'
  | 'speaking'
  | 'thinking'
  | 'walking'
  | 'working'
  | 'sleeping';

export type RuntimeWorldOverlayState =
  | 'curious'
  | 'dragging'
  | 'happy'
  | 'nervous'
  | 'tool-running';

export type RuntimeWorldEventSource =
  | 'agent'
  | 'plugin'
  | 'runtime'
  | 'system'
  | 'user';

export type RuntimeWorldEventKind =
  | 'agent.conversation-ended'
  | 'agent.conversation-started'
  | 'agent.reply-generated'
  | 'agent.task-blocked'
  | 'agent.task-cancelled'
  | 'agent.task-failed'
  | 'agent.task-progressed'
  | 'agent.task-started'
  | 'agent.task-succeeded'
  | 'agent.approval-required'
  | 'input.keyboard'
  | 'input.mouse-click'
  | 'input.mouse-move'
  | 'plugin.installed'
  | 'plugin.triggered'
  | 'system.app-switch'
  | 'system.tick'
  | 'system.window-focus';

export type RuntimeWorldEvent = {
  id: string;
  kind: RuntimeWorldEventKind;
  payload?: Record<string, unknown>;
  priority?: number;
  source: RuntimeWorldEventSource;
  timestampMs: number;
};

export type RuntimeWorldBehaviorKind =
  | 'express-emotion'
  | 'follow-mouse'
  | 'greet'
  | 'idle-think'
  | 'look-at-user'
  | 'react';

export type RuntimeWorldBehaviorRequest = {
  id: string;
  kind: RuntimeWorldBehaviorKind;
  priority: number;
  reasonEventId?: string | null;
  timestampMs: number;
};

export type RuntimeWorldEmotionVector = {
  affection: number;
  calm: number;
  curiosity: number;
  excitement: number;
  happiness: number;
  shyness: number;
};

export type RuntimeWorldContextSnapshot = {
  appFocus: string | null;
  conversationActive: boolean;
  nowMs: number;
  systemLoad: 'high' | 'low' | 'normal' | 'unknown';
  userActivity: string | null;
};

export type RuntimeWorldMemorySnapshot = {
  currentStateStartedAtMs: number;
  lastBehaviorKind: RuntimeWorldBehaviorKind | null;
  recentBehaviorKinds: RuntimeWorldBehaviorKind[];
  repeatedBehaviorCount: number;
};

export type RuntimeWorldState = {
  context: RuntimeWorldContextSnapshot;
  emotion: RuntimeWorldEmotionVector;
  lifecycle: RuntimeWorldLifecycleState;
  mainState: RuntimeWorldMainState;
  memory: RuntimeWorldMemorySnapshot;
  overlayStates: RuntimeWorldOverlayState[];
};

export type RuntimeWorldStatePatch = Partial<Omit<
  RuntimeWorldState,
  'context' | 'emotion' | 'memory' | 'overlayStates'
>> & {
  context?: Partial<RuntimeWorldContextSnapshot>;
  emotion?: Partial<RuntimeWorldEmotionVector>;
  memory?: Partial<RuntimeWorldMemorySnapshot>;
  overlayStates?: RuntimeWorldOverlayState[];
};

export type RuntimeWorldSystemResult = {
  behaviorRequests?: RuntimeWorldBehaviorRequest[];
  events?: RuntimeWorldEvent[];
  state?: RuntimeWorldStatePatch;
};

export type RuntimeWorldSystem = {
  id: string;
  update: (input: {
    deltaMs: number;
    events: RuntimeWorldEvent[];
    state: RuntimeWorldState;
    timestampMs: number;
  }) => RuntimeWorldSystemResult | void;
};

export type RuntimeWorldTickResult = {
  behaviorRequests: RuntimeWorldBehaviorRequest[];
  emittedEvents: RuntimeWorldEvent[];
  processedEvents: RuntimeWorldEvent[];
  state: RuntimeWorldState;
};
