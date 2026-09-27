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

function normalizeRuntimeContractIdPart(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 64) || 'runtime';
}

export function createAgentRuntimeRunId(sourceText: string, now: number, nonce?: number | null) {
  const noncePart = Number.isFinite(nonce) && Number(nonce) > 0
    ? `-${Math.floor(Number(nonce))}`
    : '';
  return `run-${now}-${normalizeRuntimeContractIdPart(sourceText)}${noncePart}`;
}

export function createAgentRuntimeSurfaceId(owner: AgentRuntimeOperationSurfaceOwner, now: number) {
  const ownerPart = normalizeRuntimeContractIdPart([
    owner.processName,
    owner.windowTitle,
    owner.hwnd == null ? '' : String(owner.hwnd),
    owner.pid == null ? '' : String(owner.pid),
  ].filter(Boolean).join('-'));
  return `surface-${now}-${ownerPart}`;
}

export function createAgentRuntimeEvidenceId(options: {
  capturedAt: number;
  kind: AgentRuntimeEvidenceKind;
  sourceId?: string | null;
  taskId: string;
}) {
  // Keep the source discriminator before the long task id so normalization
  // cannot truncate away the part that distinguishes two same-time actions.
  const sourcePart = normalizeRuntimeContractIdPart(options.sourceId ?? 'source');
  const taskPart = normalizeRuntimeContractIdPart(options.taskId);
  const kindPart = normalizeRuntimeContractIdPart(options.kind);
  return `evidence-${options.capturedAt}-${normalizeRuntimeContractIdPart(`${sourcePart}-${kindPart}-${taskPart}`)}`;
}

export function createAgentRuntimeActionId(options: {
  runId: string;
  startedAt: number;
  tool: string;
  toolCallId?: string | null;
  inputFingerprint?: string | null;
}) {
  const discriminator = options.toolCallId?.trim()
    || options.inputFingerprint?.trim()
    || options.tool;
  return `action-${options.startedAt}-${normalizeRuntimeContractIdPart(`${discriminator}-${options.runId}-${options.tool}`)}`;
}

export function createAgentRuntimeOperationSurface(options: {
  capabilities?: Partial<AgentRuntimeOperationSurfaceCapabilities>;
  generation?: number;
  owner?: AgentRuntimeOperationSurfaceOwner;
  presence?: AgentRuntimeOperationSurfacePresence;
  profile?: AgentRuntimeOperationSurfaceProfile;
  surfaceId?: string;
  now?: number;
}): AgentRuntimeOperationSurface {
  const owner = options.owner ?? {};
  const now = options.now ?? Date.now();
  return {
    capabilities: {
      desktopInput: options.capabilities?.desktopInput ?? false,
      screenRegionCapture: options.capabilities?.screenRegionCapture ?? false,
      uia: options.capabilities?.uia ?? false,
      windowCapture: options.capabilities?.windowCapture ?? false,
    },
    evidenceRefs: [],
    generation: Math.max(0, Math.floor(options.generation ?? 0)),
    owner,
    presence: options.presence ?? 'starting',
    profile: options.profile ?? 'unknown',
    surfaceId: options.surfaceId?.trim() || createAgentRuntimeSurfaceId(owner, now),
  };
}

export function createAgentRuntimeEvidenceEnvelope(options: {
  capturedAt?: number;
  confidence?: number | null;
  expiresAt?: number | null;
  kind: AgentRuntimeEvidenceKind;
  payload: unknown;
  sourceId?: string | null;
  surface?: Pick<AgentRuntimeOperationSurface, 'generation' | 'surfaceId'> | null;
  taskId: string;
}): AgentRuntimeEvidenceEnvelope {
  const capturedAt = options.capturedAt ?? Date.now();
  return {
    capturedAt,
    confidence: options.confidence ?? null,
    evidenceId: createAgentRuntimeEvidenceId({
      capturedAt,
      kind: options.kind,
      sourceId: options.sourceId,
      taskId: options.taskId,
    }),
    expiresAt: options.expiresAt ?? null,
    kind: options.kind,
    payload: options.payload,
    sourceId: options.sourceId ?? null,
    surfaceGeneration: options.surface?.generation ?? null,
    surfaceId: options.surface?.surfaceId ?? null,
    taskId: options.taskId,
  };
}

export function isAgentRuntimeTargetBindingCurrent(options: {
  surface: Pick<AgentRuntimeOperationSurface, 'generation' | 'surfaceId'> | null | undefined;
  target: Pick<AgentRuntimeTargetBinding, 'surfaceGeneration' | 'surfaceId'> | null | undefined;
}) {
  return Boolean(
    options.surface
      && options.target
      && options.surface.surfaceId === options.target.surfaceId
      && options.surface.generation === options.target.surfaceGeneration,
  );
}
