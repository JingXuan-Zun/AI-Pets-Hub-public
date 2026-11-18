export type AgentRuntimeOperationSurfaceProfile =
  | 'direct_window_app'
  | 'launcher_managed_app'
  | 'tray_app'
  | 'background_app'
  | 'browser_app'
  | 'unknown';

export type AgentRuntimeOperationSurfacePresence =
  | 'absent'
  | 'starting'
  | 'present_unreadable'
  | 'present_interactable';

export interface AgentRuntimeOperationSurfaceOwner {
  hwnd?: number | null;
  pid?: number | null;
  processName?: string | null;
  windowTitle?: string | null;
}

export interface AgentRuntimeOperationSurfaceCapabilities {
  desktopInput: boolean;
  screenRegionCapture: boolean;
  uia: boolean;
  windowCapture: boolean;
}

export interface AgentRuntimeOperationSurface {
  capabilities: AgentRuntimeOperationSurfaceCapabilities;
  evidenceRefs: string[];
  generation: number;
  owner: AgentRuntimeOperationSurfaceOwner;
  presence: AgentRuntimeOperationSurfacePresence;
  profile: AgentRuntimeOperationSurfaceProfile;
  surfaceId: string;
}

export interface AgentRuntimeTargetBinding {
  confidence: 'high' | 'medium' | 'low' | null;
  evidenceRefs: string[];
  label: string;
  surfaceGeneration: number;
  surfaceId: string;
  stableId?: string | null;
}

export type AgentRuntimeEvidenceKind =
  | 'process'
  | 'window'
  | 'surface'
  | 'uia'
  | 'visual'
  | 'input'
  | 'verification'
  | 'system'
  | 'user';

export interface AgentRuntimeEvidenceEnvelope {
  capturedAt: number;
  confidence?: number | null;
  evidenceId: string;
  expiresAt?: number | null;
  kind: AgentRuntimeEvidenceKind;
  payload: unknown;
  sourceId?: string | null;
  surfaceGeneration?: number | null;
  surfaceId?: string | null;
  taskId: string;
}

export type AgentRuntimeActionReceiptStatus = 'executed' | 'failed' | 'uncertain';

export interface AgentRuntimeActionReceipt {
  actionId: string;
  completedAt: number;
  executionEvidenceRefs: string[];
  inputSummary: unknown;
  startedAt: number;
  status: AgentRuntimeActionReceiptStatus;
  surfaceGeneration?: number | null;
  surfaceId?: string | null;
  toolCallId?: string | null;
}

export type AgentRuntimeVerificationResultStatus =
  | 'verified_success'
  | 'verified_failure'
  | 'uncertain'
  | 'needs_recovery'
  | 'needs_user';

export interface AgentRuntimeVerificationResult {
  evidenceRefs: string[];
  expectedPostconditions: string[];
  matchedPostconditions: string[];
  missingPostconditions: string[];
  reasonCode: string;
  status: AgentRuntimeVerificationResultStatus;
}
