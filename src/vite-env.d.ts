/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: {
    transcript: string;
  };
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructorLike {
  new (): SpeechRecognitionLike;
}

interface DesktopPetDisplayLike {
  id: string;
  label: string;
  isPrimary: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  nativeX?: number;
  nativeY?: number;
  nativeWidth?: number;
  nativeHeight?: number;
  nativeBoundsSource?: 'electron-scale' | 'windows';
  workAreaX?: number;
  workAreaY?: number;
  workAreaWidth?: number;
  workAreaHeight?: number;
  scaleFactor?: number;
}

interface DesktopPetSystemInfoLike {
  arch: string;
  chromeVersion?: string;
  computer?: {
    manufacturer?: string;
    model?: string;
    totalPhysicalMemoryBytes?: number;
  } | null;
  cpu?: {
    logicalCores?: number;
    manufacturer?: string;
    maxClockMHz?: number;
    model?: string;
    physicalCores?: number;
    speedMHz?: number;
    source?: string;
  };
  dataSources?: {
    native?: string | null;
    nativeError?: string;
    nativeWarnings?: string[];
  };
  electronVersion?: string;
  gpu?: {
    devices?: Array<{
      active?: boolean;
      adapterRamBytes?: number;
      deviceId?: string;
      deviceString?: string;
      driverVendor?: string;
      driverVersion?: string;
      pnpDeviceId?: string;
      source?: string;
      vendorId?: string;
      videoProcessor?: string;
    }>;
    error?: string;
    featureStatus?: Record<string, unknown> | null;
    source?: string;
  };
  memory?: {
    freeBytes?: number;
    freePhysicalBytes?: number;
    installedBytes?: number;
    source?: string;
    totalBytes?: number;
    totalVisibleBytes?: number;
  };
  nodeVersion?: string;
  osBuildNumber?: string;
  osCaption?: string;
  osInstallDate?: string;
  osLastBootUpTime?: string;
  osRelease?: string;
  osType?: string;
  osVersion?: string;
  platform: string;
  updatedAt?: number;
  uptimeSeconds?: number;
}

interface DesktopPetVideoLibraryInspection {
  error?: string;
  folders?: Array<{ folderPath: string; name: string; videoCount: number }>;
  ok: boolean;
  rootPath?: string;
}

interface DesktopPetWindowDragRestoreRequest {
  cursorX: number;
  cursorY: number;
  /** Grab point as a fraction of the window width. */
  ratioX: number;
  /** Grab point distance from the window top, in pixels. */
  offsetY: number;
}

type DesktopPetCaptureMode = 'screen' | 'window' | 'area';

interface DesktopPetCaptureRectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DesktopPetCaptureSourceLike {
  id: string;
  name: string;
  type: 'screen' | 'window';
  bounds?: DesktopPetCaptureRectLike | null;
  boundsCoordinateSpace?: 'native-screen' | 'dip' | string | null;
  displayId?: string | null;
  logicalBounds?: DesktopPetCaptureRectLike | null;
  nativeBoundsSource?: 'electron-scale' | 'windows' | string | null;
  scaleFactor?: number | null;
  width?: number;
  height?: number;
  thumbnail?: string;
  appIcon?: string;
}

interface DesktopPetScreenTextLineLike {
  height: number;
  text: string;
  width: number;
  x: number;
  y: number;
}

interface DesktopPetScreenRegionTextRequestLike {
  height: number;
  includeImage?: boolean;
  width: number;
  x: number;
  y: number;
}

interface DesktopPetScreenRegionTextResultLike extends DesktopPetScreenTextRecognitionResultLike {
  height?: number;
  imageDataUrl?: string | null;
  width?: number;
}

interface DesktopPetScreenTextRecognitionResultLike {
  language?: string;
  lines: DesktopPetScreenTextLineLike[];
  ok: boolean;
  reason?: string;
}

interface DesktopPetCaptureSourceListRequestLike {
  captureSourceTypes?: Array<'screen' | 'window'>;
  forceRefresh?: boolean;
  includeCaptureThumbnails?: boolean;
  preferCached?: boolean;
  sourceId?: string;
}

interface DesktopPetDesktopIconLike {
  canMove?: boolean;
  coordinateSpace?: 'dip' | 'native-screen';
  desktopGridCellHeight?: number;
  desktopGridCellWidth?: number;
  dipCenterX?: number;
  dipCenterY?: number;
  dipHeight?: number;
  dipWidth?: number;
  dipX?: number;
  dipY?: number;
  extension?: string;
  filePath?: string;
  id: string;
  index: number;
  isDirectory?: boolean;
  isFile?: boolean;
  isShortcut?: boolean;
  isSystemIcon?: boolean;
  itemKind?: string;
  name: string;
  path?: string;
  positionSource?: 'shell-list-view' | 'folder-view' | 'ui-automation' | 'filesystem-fallback' | string;
  nativeScreenCenterX?: number;
  nativeScreenCenterY?: number;
  nativeScreenHeight?: number;
  nativeScreenWidth?: number;
  nativeScreenX?: number;
  nativeScreenY?: number;
  targetPath?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

interface DesktopPetDesktopIconMoveResultLike {
  error?: string;
  icon?: DesktopPetDesktopIconLike;
  ok: boolean;
  verified?: boolean;
}

interface DesktopPetLocalAppShortcutLike {
  aliases?: string[];
  name: string;
  path: string;
  score?: number;
  sourceRoot?: string;
  type?: string;
  userDefined?: boolean;
}

interface DesktopPetLocalAppLaunchResultLike {
  action?: 'focused' | 'launched' | 'failed';
  app?: DesktopPetLocalAppShortcutLike | null;
  error?: string;
  forceNew?: boolean;
  matchCount?: number;
  focusedWindow?: {
    ok?: boolean;
    pid?: number;
    processName?: string;
    reason?: string;
    title?: string;
  };
  matches?: DesktopPetLocalAppShortcutLike[];
  ok: boolean;
  query?: string;
  status?:
    | 'focused-existing-window'
    | 'launched-new-process'
    | 'launched-unverified'
    | 'multiple-candidates'
    | 'launch-failed'
    | 'not-found';
  verification?: {
    action?: 'focused' | 'launched';
    ok?: boolean;
    reason?: string;
    window?: {
      ok?: boolean;
      pid?: number;
      processName?: string;
      reason?: string;
      title?: string;
    };
  } | null;
}

interface DesktopPetLocalAppMemoryResultLike {
  app?: DesktopPetLocalAppShortcutLike | null;
  error?: string;
  memoryPath?: string;
  ok: boolean;
}

interface DesktopPetActiveWindowInfoResultLike {
  error?: string;
  executablePath?: string | null;
  hwnd?: number | null;
  ok: boolean;
  pid?: number | null;
  processName?: string | null;
  title?: string | null;
  visible?: boolean;
}

interface DesktopPetLocalProjectDetectionLike {
  confidence: number;
  id: string;
  label: string;
  reason: string;
}

interface DesktopPetLocalProjectSuggestedActionLike {
  command: string;
  cwd: string;
  kind?: 'terminal-command' | 'open-path' | 'open-url';
  label: string;
  risk: 'read' | 'launch';
  source: string;
}

interface DesktopPetLocalProjectInspectionLike {
  details?: Record<string, unknown>;
  detectedProjectTypes?: DesktopPetLocalProjectDetectionLike[];
  entrySummary?: {
    directories?: string[];
    files?: string[];
  };
  error?: string;
  ok: boolean;
  path?: string;
  primaryType?: DesktopPetLocalProjectDetectionLike | null;
  readFiles?: string[];
  readmeHints?: string[];
  rootPath?: string;
  scannedAt?: number;
  suggestedActions?: DesktopPetLocalProjectSuggestedActionLike[];
  targetKind?: 'directory' | 'file';
  totalEntryCount?: number;
  warnings?: string[];
}

interface DesktopPetLocalProjectExecutionObservationLike {
  command?: string;
  cwd?: string;
  kind?: 'terminal-command' | 'open-path' | 'open-url';
  observation?: string;
  processName?: string;
  startedAt?: number;
  target?: string;
  visibleWindow?: boolean;
}

interface DesktopPetLocalProjectRunResultLike {
  action?: DesktopPetLocalProjectSuggestedActionLike | null;
  dryRun?: boolean;
  error?: string;
  execution?: DesktopPetLocalProjectExecutionObservationLike | null;
  inspection?: DesktopPetLocalProjectInspectionLike | null;
  ok: boolean;
  pid?: number | null;
  selectedActionIndex?: number | null;
  selectionReason?: string | null;
  verification?: {
    confidence?: 'started' | 'request-accepted' | 'failed';
    ok?: boolean;
    reason?: string;
    summary?: string;
  } | null;
}

interface DesktopPetLocalFileEntryLike {
  createdAt?: number;
  extension?: string;
  kind: 'directory' | 'file' | 'missing' | 'other' | 'symlink';
  modifiedAt?: number;
  name: string;
  path: string;
  sizeBytes?: number;
}

interface DesktopPetPathInfoResultLike {
  basename?: string;
  dirname?: string;
  error?: string;
  exists?: boolean;
  extension?: string;
  kind?: DesktopPetLocalFileEntryLike['kind'];
  modifiedAt?: number;
  ok: boolean;
  path: string;
  sizeBytes?: number;
}

interface DesktopPetDirectoryListResultLike {
  entries?: DesktopPetLocalFileEntryLike[];
  error?: string;
  kind?: DesktopPetLocalFileEntryLike['kind'];
  limit?: number;
  ok: boolean;
  path: string;
  totalEntryCount?: number;
  truncated?: boolean;
}

interface DesktopPetFileSearchResultLike {
  error?: string;
  limit?: number;
  matches?: DesktopPetLocalFileEntryLike[];
  maxDepth?: number;
  ok: boolean;
  path: string;
  query?: string;
  truncated?: boolean;
  visitedDirectoryCount?: number;
  visitedFileCount?: number;
}

interface DesktopPetTextFileReadResultLike {
  encoding?: string;
  error?: string;
  extension?: string;
  kind?: DesktopPetLocalFileEntryLike['kind'];
  modifiedAt?: number;
  ok: boolean;
  path: string;
  sizeBytes?: number;
  text?: string;
  truncated?: boolean;
}

interface DesktopPetFileManagementActionResultLike {
  action?: string;
  actionLabel?: string;
  changedPaths?: string[];
  conflictCount?: number;
  conflicts?: Array<{
    destinationPath?: string;
    name?: string;
    sourcePath?: string;
  }>;
  createdDirectories?: string[];
  desktopPath?: string;
  destinationExists?: boolean;
  destinationKind?: DesktopPetLocalFileEntryLike['kind'];
  destinationPath?: string;
  dryRun?: boolean;
  error?: string;
  groupBy?: 'none' | 'kind' | 'category' | 'extension';
  groups?: Array<{
    count: number;
    destinationDirectory: string;
    key: string;
    label: string;
  }>;
  itemKind?: DesktopPetLocalFileEntryLike['kind'];
  movedItemCount?: number;
  ok: boolean;
  plannedItemCount?: number;
  planItems?: Array<{
    category?: string;
    destinationDirectory?: string;
    destinationPath?: string;
    extension?: string;
    groupKey?: string;
    groupLabel?: string;
    kind?: string;
    name?: string;
    sizeBytes?: number;
    sourcePath?: string;
  }>;
  responseText?: string;
  skipped?: Array<{
    name?: string;
    reason?: string;
    sourcePath?: string;
  }>;
  skippedItemCount?: number;
  sourceExists?: boolean;
  sourcePath?: string;
  truncated?: boolean;
  verified?: boolean;
  willOverwrite?: boolean;
}

interface DesktopPetCursorPointLike {
  coordinateSpace?: 'dip';
  x: number;
  y: number;
  updatedAt?: number;
}

interface DesktopPetInteractiveRegionLike {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface DesktopPetInteractiveRegionSyncOptionsLike {
  blocksPointerPassthrough?: boolean;
  force?: boolean;
  guardScope?: string;
  source?: string;
}

interface DesktopPetCaptureOptionsLike {
  mode?: DesktopPetCaptureMode;
  sourceId?: string;
  sourceName?: string;
  sourceType?: 'screen' | 'window';
  cropRect?: DesktopPetCaptureRectLike | null;
  cropBasisX?: number;
  cropBasisY?: number;
  cropBasisWidth?: number;
  cropBasisHeight?: number;
  areaSources?: DesktopPetAreaSourceLike[];
}

interface DesktopPetDisplayEnvironmentLike {
  displays: DesktopPetDisplayLike[];
  captureSources: DesktopPetCaptureSourceLike[];
  captureSourcesPending?: boolean;
  captureSourcesIncluded?: boolean;
  captureSourceTypesIncluded?: Array<'screen' | 'window'>;
}

interface DesktopPetDisplayEnvironmentRequestLike {
  includeCaptureSources?: boolean;
  captureSourceTypes?: Array<'screen' | 'window'>;
  preferCachedCaptureSources?: boolean;
  forceRefreshCaptureSources?: boolean;
  includeCaptureThumbnails?: boolean;
}

interface DesktopPetAreaSelectionLike {
  displayId: string;
  displayLabel: string;
  sourceId: string;
  sourceName: string;
  sourceType: 'screen';
  cropRect: DesktopPetCaptureRectLike;
  cropBasisX?: number;
  cropBasisY?: number;
  cropBasisWidth: number;
  cropBasisHeight: number;
  areaSources?: DesktopPetAreaSourceLike[];
}

interface DesktopPetAreaSourceLike {
  displayId: string;
  displayLabel: string;
  sourceId: string;
  sourceName: string;
  sourceType: 'screen';
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DesktopPetAreaPickerDisplayLike extends DesktopPetDisplayLike {
  sourceId: string;
  sourceName: string;
  sourceType: 'screen';
  previewThumbnail?: string;
}

interface DesktopPetAreaPickerContextLike {
  virtualBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  displays: DesktopPetAreaPickerDisplayLike[];
}

interface DesktopPetLocalVoiceModelOptionLike {
  id: string;
  label: string;
  path: string;
}

interface DesktopPetLocalVoiceReferenceOptionLike {
  id: string;
  label: string;
  path: string;
  sampleCount: number;
  sampleFiles: string[];
}

interface DesktopPetLocalVoiceAssetsLike {
  rootPath: string | null;
  ttsModels: DesktopPetLocalVoiceModelOptionLike[];
  sttModels: DesktopPetLocalVoiceModelOptionLike[];
  references: DesktopPetLocalVoiceReferenceOptionLike[];
}

interface DesktopPetLocalVoiceAssetListOptionsLike {
  forceRefresh?: boolean;
}

interface DesktopPetLocalVoiceHealthLike {
  available: boolean;
  status: 'idle' | 'ready' | 'missing-runtime' | 'missing-dependencies' | 'missing-assets' | 'error';
  runtimeLabel: string | null;
  executable: string | null;
  pythonVersion: string | null;
  device: 'cpu' | 'cuda' | 'unknown';
  ttsReady: boolean;
  sttReady: boolean;
  referenceReady: boolean;
  missingPackages: string[];
  detectedPackages: string[];
  messages: string[];
}

interface DesktopPetLocalVoiceInstallResultLike {
  ok: boolean;
  executable: string | null;
  messages: string[];
  error: string | null;
  missingPackages: string[];
}

interface DesktopPetLocalVoiceInstallProgressLike {
  stage: 'starting' | 'running' | 'completed' | 'failed';
  currentStep: string | null;
  executable: string | null;
  messages: string[];
  error: string | null;
  missingPackages: string[];
}

interface DesktopPetLocalVoiceSynthesisResultLike {
  audioBase64?: string;
  mimeType?: string;
  audioFilePath?: string;
  audioFileUrl?: string;
  cacheHit?: boolean;
  cacheKey?: string;
  promptCacheHit?: boolean;
}

interface DesktopPetUnityBridgeCommandLike {
  type: 'loadAvatar' | 'setSemanticState' | 'setLayout' | 'setVisibility';
  petId?: string;
  runtimeKind?: 'unity';
  modelUrl?: string;
  motionKey?: string;
  expressionKey?: string;
  viseme?: string;
  scale?: number;
  screenHeight?: number;
  screenWidth?: number;
  presentationMode?: string;
  visible?: boolean;
  viewportHeight?: number;
  viewportWidth?: number;
  viewportX?: number;
  viewportY?: number;
  dragActive?: boolean;
  dragDeltaX?: number;
  dragDeltaY?: number;
  hoverRegion?: string;
  lookAtX?: number;
  lookAtY?: number;
}

  interface DesktopPetUnityBridgeCommandResultLike {
    connected: boolean;
    ok: boolean;
    queued: boolean;
    runtimeProcess?: DesktopPetUnityRuntimeProcessStatusLike | null;
  }

  interface DesktopPetUnityRuntimeProcessStatusLike {
    executablePath: string | null;
    lastError: string | null;
    lastExitAt: number | null;
    lastStartedAt: number | null;
    ok?: boolean;
    pid: number | null;
    running: boolean;
    started?: boolean;
  }

interface DesktopPetUnityBridgeEventLike {
  type: string;
  petId?: string;
  runtimeKind?: 'unity';
  bounds?: {
    bottom?: number;
    left?: number;
    right?: number;
    top?: number;
  };
  errorMessage?: string;
  expressionKey?: string | null;
  fps?: number | null;
  frameIntervalMs?: number | null;
  left?: number;
  message?: string;
  motionKey?: string | null;
  right?: number;
  source?: 'fallback' | 'measured';
  top?: number;
  bottom?: number;
}

  interface DesktopPetUnityBridgeStatusLike {
    clientAddress: string | null;
    clientPort: number | null;
    connected: boolean;
  host: string;
  lastCommandAt: number | null;
  lastConnectedAt: number | null;
  lastDisconnectAt: number | null;
    lastError: string | null;
    listening: boolean;
    port: number;
    runtimeProcess?: DesktopPetUnityRuntimeProcessStatusLike | null;
  }

interface DesktopPetPersistedConfigLoadResultLike {
  ok: boolean;
  config?: unknown;
  source?: string;
  bytes?: number;
  recoveredFromBackup?: boolean;
  repairedPrimary?: boolean;
  repairError?: string | null;
  primaryError?: string;
  backupError?: string;
  primaryPath?: string;
  backupPath?: string;
  error?: string;
}

interface DesktopPetPersistedConfigSaveResultLike {
  ok: boolean;
  bytes?: number;
  backupMode?: string;
  primaryPath?: string;
  backupPath?: string;
  error?: string;
}

type DesktopPetMcpContentTypeLike = 'json' | 'text';

interface DesktopPetMcpToolContentLike {
  text: string;
  type: DesktopPetMcpContentTypeLike;
}

interface DesktopPetMcpToolLike {
  annotations?: {
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
    readOnlyHint?: boolean;
    title?: string;
  };
  description?: string;
  inputSchema?: Record<string, unknown>;
  name: string;
  serverId: string;
  title: string;
}

interface DesktopPetMcpServerLike {
  description?: string;
  id: string;
  title: string;
}

interface DesktopPetMcpServerHealthLike {
  consecutiveFailures: number;
  lastError?: string | null;
  lastFailureAt?: number | null;
  lastOkAt?: number | null;
  lastRecoveryAt?: number | null;
  nextRetryAt?: number | null;
  serverId: string;
  status: 'ok' | 'unhealthy' | 'unknown' | string;
}

interface DesktopPetMcpToolListResultLike {
  ok: boolean;
  serverHealth?: DesktopPetMcpServerHealthLike[];
  servers: DesktopPetMcpServerLike[];
  tools: DesktopPetMcpToolLike[];
}

interface DesktopPetMcpServerDiagnosticLike {
  command: string;
  commandPathExists: boolean | null;
  compatibility?: {
    issueCode: 'command-missing' | 'cwd-missing' | 'package-unavailable' | 'permission-denied' | 'protocol-or-startup-error' | 'ready' | 'runtime-missing' | 'server-crash' | 'startup-timeout' | 'unknown-server';
    nextAction: string;
    status: 'blocked' | 'ready' | 'retryable';
    summary: string;
  };
  cwd: string;
  cwdExists: boolean;
  durationMs: number;
  error?: string | null;
  ok: boolean;
  serverId: string;
  stderrSnippet: string;
  timeoutMs: number;
  toolCount: number;
  tools: DesktopPetMcpToolLike[];
}

interface DesktopPetMcpServerEnvironmentPreflightLike {
  checks: Array<{
    detail: string;
    id: string;
    label: string;
    status: 'blocked' | 'ready' | 'warning';
  }>;
  commandKind: 'executable' | 'windows-command-script';
  ok: boolean;
  resolvedCommand: string | null;
  status: 'blocked' | 'ready' | 'warning';
}

interface DesktopPetMcpToolCallResultLike {
  content: DesktopPetMcpToolContentLike[];
  isError?: boolean;
  structuredContent?: Record<string, unknown> | null;
}

type DesktopPetMcpSessionCloseKindLike =
  | 'app-quit'
  | 'cancelled'
  | 'client-dispose'
  | 'config-save'
  | 'discarded'
  | 'idle-timeout'
  | 'manual-reset'
  | 'process-exit'
  | 'replaced'
  | 'rpc-failed'
  | 'rpc-timeout'
  | 'unknown'
  | string;

interface DesktopPetMcpSessionStatusLike {
  closed: boolean;
  closeKind?: DesktopPetMcpSessionCloseKindLike | null;
  closeReason?: string | null;
  idleTimeoutMs?: number;
  lastCloseKind?: DesktopPetMcpSessionCloseKindLike | null;
  lastCloseReason?: string | null;
  lastClosedAt?: number | null;
  lastUsedAt?: number;
  nextRestartAt?: number | null;
  pendingCount: number;
  restartConsecutiveFailures?: number;
  restartLastError?: string | null;
  restartLastFailureAt?: number | null;
  restartLastStartedAt?: number | null;
  restartStatus?: 'cooldown' | 'ok' | 'starting' | 'unknown' | string;
  restartWaitMs?: number;
  serverId: string;
}

interface DesktopPetMcpSessionStatusResultLike {
  ok: boolean;
  sessions: DesktopPetMcpSessionStatusLike[];
}

interface DesktopPetMcpSessionResetResultLike {
  closedAt?: number | null;
  closedCount: number;
  closeKind?: DesktopPetMcpSessionCloseKindLike | null;
  closeReason?: string | null;
  error?: string;
  ok: boolean;
  serverId?: string;
}

interface DesktopPetMcpHistoryEntryLike {
  closeKind?: DesktopPetMcpSessionCloseKindLike | null;
  createdAt: number;
  durationMs?: number;
  error?: string | null;
  id: string;
  ok?: boolean | null;
  requestId?: string;
  serverId?: string;
  status: string;
  toolCount?: number;
  toolName?: string;
  retryAfterMs?: number | null;
  type: 'cancellation' | 'diagnostic' | 'session' | 'tool-call';
}

interface DesktopPetMcpHistoryResultLike {
  entries: DesktopPetMcpHistoryEntryLike[];
  limit: number;
  ok: boolean;
  retentionLimit?: number;
  totalCount: number;
}

interface DesktopPetMcpHistoryMutationResultLike {
  ok: boolean;
  removedCount: number;
  retentionLimit: number;
  totalCount: number;
}

interface DesktopPetMcpHistoryExportResultLike {
  entryCount: number;
  fileName: string;
  mimeType: string;
  ok: boolean;
  text: string;
}

interface DesktopPetMcpConfigResultLike {
  config: Record<string, unknown>;
  error?: string | null;
  exists: boolean;
  ok: boolean;
  path: string;
  rawText: string;
}

interface DesktopPetMcpSoakReadinessResultLike {
  configPath: string;
  configPresent: boolean;
  generatedAt: string;
  kind: 'mcp-real-server-soak-readiness';
  reportDir: string;
  runbook: {
    allServers: string;
    indexReports: string;
    perServer: Array<{ command: string; serverId: string }>;
  };
  servers: unknown[];
  status: 'blocked' | 'ready';
  totals: {
    blockedServers: number;
    fakeFixtureServers: number;
    readyServers: number;
    servers: number;
  };
  version: 1;
}

interface DesktopPetExternalSkillReleaseAdmissionCheckLike {
  detail: string;
  id: string;
  status: 'fail' | 'not-applicable' | 'pass' | 'warning';
}

interface DesktopPetExternalSkillReleaseAdmissionRowLike {
  artifactDigest: string | null;
  checks: DesktopPetExternalSkillReleaseAdmissionCheckLike[];
  compatibilityIssueCodes: string[];
  controlledRuntimeStatus: 'blocked' | 'controlled-runtime-eligible' | 'review-required';
  marketReleaseAllowed: false;
  marketReleaseIssueCodes: string[];
  marketReleaseStatus: 'disabled';
  marketplaceChecks: DesktopPetExternalSkillReleaseAdmissionCheckLike[];
  marketplacePublisherIdentity: {
    catalogSequence: number | null;
    issueCodes: string[];
    keyFingerprint: string | null;
    keyId: string | null;
    kind: 'external-skill-marketplace-publisher-assessment.v1';
    publisherId: string | null;
    registryStatus: 'expired' | 'invalid' | 'missing' | 'ready' | 'unavailable';
    rootKeyId: string | null;
    status: 'blocked' | 'verified';
  };
  packageId: string;
  runtimeKind: string;
}

interface DesktopPetExternalSkillReleaseAdmissionReportLike {
  error?: string;
  generatedAt?: string;
  host?: {
    arch: string;
    electronVersion: string | null;
    nodeVersion: string;
    packaged: boolean;
    platform: string;
  };
  kind?: 'external-skill-release-admission-report.v1';
  marketReleaseEnabled?: false;
  ok: boolean;
  rows: DesktopPetExternalSkillReleaseAdmissionRowLike[];
  summary?: {
    blocked: number;
    eligible: number;
    marketplacePublisherBlocked: number;
    marketplacePublisherVerified: number;
    'review-required': number;
    total: number;
  };
  version?: 1;
}

interface DesktopPetExternalSkillMarketplaceProductionReadinessReportLike {
  activeCatalog: {
    expiresAt: string | null;
    publisherCount: number;
    rootKeyId: string | null;
    sequence: number | null;
    status: string;
  };
  checks: Array<{
    detail: string;
    id: string;
    status: 'fail' | 'pass' | 'warning';
  }>;
  configSource: 'bundled-default' | 'packaged-production';
  delivery: {
    enabled: boolean;
    maxResponseBytes: number | null;
    requestTimeoutMs: number | null;
    status: string;
    transportOrigin: string | null;
  };
  generatedAt: string;
  issueCodes: string[];
  kind: 'external-skill-marketplace-production-readiness-report.v1';
  marketReleaseAllowed: false;
  marketReleaseStatus: 'disabled';
  ok: true;
  operationalConfigurationReady: boolean;
  rootRegistry: {
    activeKeyCount: number;
    minimumSequence: number;
    revokedKeyCount: number;
    status: string;
    totalKeyCount: number;
  };
  status: 'incomplete' | 'invalid' | 'not-configured' | 'ready-disabled';
  version: 1;
}

interface DesktopPetExternalSkillJsonExportLike {
  error?: string;
  fileName?: string;
  mimeType?: 'application/json';
  ok: boolean;
  text?: string;
}

interface DesktopPetExternalSkillPackageUninstallSnapshotCleanupLike {
  artifactCleanupSkips?: Array<{ packageId: string; reason: string }>;
  deletedArtifactCount?: number;
  error?: string;
  invalidSnapshotCount?: number;
  invalidSnapshotIds?: string[];
  ok: boolean;
  policy?: { maxAgeDays: number; maxSnapshotsPerPackage: number };
  receipt?: DesktopPetExternalSkillPackageLifecycleReceiptLike;
  removedSnapshotCount?: number;
  removedSnapshotIds?: string[];
  skippedSnapshotCount?: number;
  skippedSnapshotIds?: string[];
  status: 'completed' | 'completed-with-skips' | 'failed';
}

interface DesktopPetExternalSkillPackageLifecycleReceiptLike {
  action: 'cleanup-uninstall-snapshots' | 'restore-quarantine' | 'rollback-uninstall' | 'uninstall';
  at: string;
  cleanup: {
    deletedArtifactCount: number;
    invalidSnapshotCount: number;
    removedSnapshotCount: number;
    skippedSnapshotCount: number;
    status: string;
  } | null;
  grantRevoked: boolean;
  healthReset: boolean;
  kind: 'external-skill-package-lifecycle-receipt.v1';
  packageId: string;
  receiptId: string;
  snapshotId: string | null;
  status: 'failed' | 'succeeded';
}

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructorLike;
  webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  desktopPetShell?: {
    platform: string;
    packaged: boolean;
    desktopMode: boolean;
    getPathForFile?: (file: File) => string;
    loadPersistedConfigSync?: () => DesktopPetPersistedConfigLoadResultLike;
    savePersistedConfig?: (config: unknown) => Promise<DesktopPetPersistedConfigSaveResultLike>;
    openModelRequest?: (request: import('./services/modelTransport').DesktopModelRequest & { id: string }) => Promise<{ status: number; contentType: string }>;
    readModelRequest?: (id: string) => Promise<{ done: boolean; value?: Uint8Array }>;
    cancelModelRequest?: (id: string) => Promise<void>;
    probeDeepSeekHarness?: (request?: { pythonPath?: string }) => Promise<{ available: boolean; error?: string | null; pythonVersion?: string | null; sdkVersion?: string | null }>;
    checkDeepSeekHarnessUpdate?: (request?: { pythonPath?: string }) => Promise<{ checked: boolean; error?: string | null; latestVersion?: string | null }>;
    prepareDeepSeekHarnessProfile?: (request?: { dshHome?: string }) => Promise<{ error?: string; ok: boolean; profilePath?: string }>;
    validateDeepSeekHarnessSetup?: (request?: { dshHome?: string; model?: string; pythonPath?: string; workspace?: string }) => Promise<{ checks?: Record<string, boolean>; error?: string; ok: boolean; profilePath?: string; sdkVersion?: string | null }>;
    runDeepSeekHarness?: (request?: { apiKey?: string; baseUrl?: string; capabilityBridgeReady?: boolean; dshHome?: string; model?: string; pythonPath?: string; requestId?: string; sessionId?: string; userGoal?: string; workspace?: string }) => Promise<{ cancelled?: boolean; error?: string; finalResponse?: string; ok: boolean }>;
    cancelDeepSeekHarness?: (request?: { requestId?: string; sessionId?: string }) => Promise<{ cancelled?: boolean; error?: string; ok: boolean }>;
    loadPersistedChatHistory?: () => Promise<{
      error?: string;
      messages?: import('./types').ChatMessage[];
      ok: boolean;
      source?: string;
    }>;
    savePersistedChatHistory?: (messages: import('./types').ChatMessage[]) => Promise<{
      error?: string;
      messageCount?: number;
      ok: boolean;
    }>;
    archiveChatHistory?: (messages: import('./types').ChatMessage[]) => Promise<{
      archivedCount?: number;
      error?: string;
      ok: boolean;
    }>;
    getAppRuntimeInfo?: () => Promise<{
      appVersion?: string;
      buildId?: string;
      builtAt?: string | null;
      sessionMs: number;
      totalMs: number;
    } | null>;
    resetUserDataAndRelaunch?: () => Promise<{ error?: string; ok: boolean }>;
    readNeuralPersonaRecord?: (request: { roleId: string }) => Promise<{
      error?: string;
      ok: boolean;
      value: string | null;
    }>;
    compareAndSwapNeuralPersonaRecord?: (request: {
      expectedValue: string | null;
      nextValue: string;
      roleId: string;
    }) => Promise<{
      error?: string;
      matched: boolean;
      ok: boolean;
    }>;
    runSkillSandboxSupervisorProbe?: (request: {
      bootstrapPlanId: string;
      packageId: string;
      requestId: string;
      timeoutMs?: number;
    }) => Promise<unknown>;
    runSkillSandboxPackage?: (request: {
      input: Record<string, unknown>;
      packageId: string;
      permissionScopes?: string[];
      requestId: string;
      timeoutMs?: number;
    }) => Promise<{
      error?: string;
      capabilityDecision?: {
        allowedScopes: string[];
        artifactDigest: string | null;
        issueCodes: string[];
        packageId: string;
        requestedScopes: string[];
        status: 'allowed' | 'denied';
      };
      capabilityReceipt?: {
        artifactDigest: string | null;
        decision: string;
        grantedScopes: string[];
        kind: 'external-skill-capability-receipt.v1';
        packageId: string;
        rateLimit: {
          allowed: boolean;
          kind: 'external-skill-capability-rate-limit.v1';
          limit: number;
          packageId: string;
          remaining: number;
          retryAfterMs: number;
          scope: 'storage.read';
          windowMs: number;
        } | null;
        reason: string;
        receiptId: string;
        requestId: string;
        requestedScopes: string[];
        status: string;
        usedScopes: string[];
      };
      capabilityFlow?: {
        calls: number;
        maxCalls: number;
        status: string;
      };
      capabilityReceipts?: Array<{
        kind: 'external-skill-capability-receipt.v1';
        status: string;
        usedScopes: string[];
      }>;
      executionKind?: 'wasm-pure-i32-v1' | 'wasm-pure-json-v1';
      executionPhase?: 'primary' | 'capability-response';
      output?: Record<string, unknown>;
      packageCodeLoaded?: boolean;
      packageHealth?: {
        allowed: boolean;
        artifactDigest: string | null;
        backoffUntil: number;
        blocked?: boolean;
        classification?: 'failure' | 'ignored' | 'success';
        consecutiveFailures: number;
        error?: string;
        kind: 'external-skill-package-health-result.v1';
        packageId: string;
        quarantineApplied?: boolean;
        quarantineError?: string | null;
        reason: string;
        retryAfterMs: number;
        statePersisted?: boolean;
        status: 'backoff' | 'healthy' | 'quarantined' | 'untracked';
        totalFailures: number;
      };
      status: string;
      workerRequestIds?: string[];
    }>;
    listSkillCapabilityGrants?: () => Promise<{
      grants: Array<{ artifactDigest: string | null; packageId: string; reviewedAt: string; scopes: string[]; skillId: string }>;
      kind: 'external-skill-capability-grants.v1';
      path: string;
    }>;
    listSkillCapabilityReceipts?: (request?: { limit?: number; packageId?: string; status?: string }) => Promise<{
      kind: 'external-skill-capability-receipt-history.v1';
      limit: number;
      ok: boolean;
      path: string;
      receipts: Array<{
        artifactDigest: string | null;
        decision: string;
        grantedScopes: string[];
        kind: 'external-skill-capability-receipt.v1';
        packageId: string;
        rateLimit: {
          allowed: boolean;
          kind: 'external-skill-capability-rate-limit.v1';
          limit: number;
          packageId: string;
          remaining: number;
          retryAfterMs: number;
          scope: 'storage.read';
          windowMs: number;
        } | null;
        reason: string;
        receiptId: string;
        requestId: string;
        requestedScopes: string[];
        status: string;
        usedScopes: string[];
        writtenAt: string;
      }>;
      retentionLimit: number;
      totalCount: number;
    }>;
    clearSkillCapabilityReceipts?: (request?: { packageId?: string }) => Promise<{
      ok: boolean;
      removedCount: number;
      totalCount: number;
    }>;
    listExternalSkillPackageHealth?: (request?: { packageId?: string }) => Promise<{
      entries: Array<{
        artifactDigest: string;
        backoffUntil: number;
        consecutiveFailures: number;
        lastError: string;
        lastFailureAt: string | null;
        lastSuccessAt: string | null;
        packageId: string;
        quarantinedAt: string | null;
        status: 'backoff' | 'healthy' | 'quarantined';
        totalFailures: number;
      }>;
      kind: 'external-skill-package-health-state.v1';
      ok: boolean;
      path: string;
      totalCount: number;
    }>;
    resetExternalSkillPackageHealth?: (request: { packageId: string }) => Promise<{
      error?: string;
      ok: boolean;
      packageId?: string;
      reset?: boolean;
    }>;
    createExternalSkillReleaseAdmissionReport?: (request?: { packageIds?: string[] }) => Promise<DesktopPetExternalSkillReleaseAdmissionReportLike>;
    exportExternalSkillReleaseAdmissionReport?: (request?: { packageIds?: string[] }) => Promise<DesktopPetExternalSkillJsonExportLike>;
    exportExternalSkillPackageHealthDiagnostics?: (request?: { packageId?: string }) => Promise<DesktopPetExternalSkillJsonExportLike>;
    getExternalSkillMarketplaceProductionReadiness?: () => Promise<DesktopPetExternalSkillMarketplaceProductionReadinessReportLike>;
    exportExternalSkillMarketplaceProductionReadiness?: () => Promise<DesktopPetExternalSkillJsonExportLike>;
    setSkillCapabilityGrant?: (request: { packageId: string; scopes: string[] }) => Promise<{
      error?: string;
      grant?: { artifactDigest: string | null; packageId: string; reviewedAt: string; scopes: string[]; skillId: string };
      ok: boolean;
    }>;
    revokeSkillCapabilityGrant?: (request: { packageId: string }) => Promise<{
      error?: string;
      ok: boolean;
      revoked?: boolean;
    }>;
    decideSkillCapabilityRequest?: (request: { packageId: string; permissionScopes?: string[] }) => Promise<{
      allowedScopes: string[];
      issueCodes: string[];
      packageId: string;
      requestedScopes: string[];
      status: 'allowed' | 'denied';
    }>;
    readSkillCapabilityStorage?: (request: {
      key: string;
      packageId: string;
      permissionScopes?: string[];
      requestId: string;
    }) => Promise<{
      capabilityDecision?: { artifactDigest: string | null; issueCodes: string[]; status: 'allowed' | 'denied' };
      capabilityReceipt?: { kind: 'external-skill-capability-receipt.v1'; status: string; usedScopes: string[] };
      capabilityRateLimit?: {
        allowed: boolean;
        kind: 'external-skill-capability-rate-limit.v1';
        limit: number;
        packageId: string;
        remaining: number;
        retryAfterMs: number;
        scope: 'storage.read';
        windowMs: number;
      };
      capabilityValue?: unknown;
      error?: string;
      status: string;
    }>;
    cancelSkillSandboxSupervisorProbe?: (request: { requestId: string }) => Promise<unknown>;
    stageSkillPackageArtifact?: (request: {
      packageId: string;
      rawPackageJson: string;
      trustedKeyRegistry?: unknown;
    }) => Promise<{
      error?: string;
      ok: boolean;
      package?: { artifactDigest?: string };
      replaced?: boolean;
    }>;
    stageSignedSkillPackageArchive?: (request: {
      archiveBase64: string;
      trustedKeyRegistry?: unknown;
    }) => Promise<{
      archiveDigest?: string;
      error?: string;
      identity?: {
        packageId: string;
        publisherId: string;
        skillId: string;
        version: string;
      };
      migration?: {
        fromVersion: string | null;
        kind: 'install' | 'update';
        toVersion: string;
      };
      ok: boolean;
      packageJson?: string;
      status?: 'installed' | 'updated';
    }>;
    auditSkillPackageArtifacts?: (request: { packages: Array<{ packageId: string; rawPackageJson: string }> }) => Promise<{
      error?: string;
      ok: boolean;
      rows: Array<{ artifactDigest: string | null; expectedDigest: string; packageId: string; status: 'missing' | 'mismatched' | 'quarantined' | 'ready' }>;
    }>;
    quarantineSkillPackageArtifact?: (request: { packageId: string; reason: string }) => Promise<{ error?: string; ok: boolean }>;
    restoreQuarantinedExternalSkillPackage?: (request: {
      packageId: string;
      rawPackageJson: string;
      trustedKeyRegistry: unknown;
    }) => Promise<{
      error?: string;
      ok: boolean;
      receipt?: DesktopPetExternalSkillPackageLifecycleReceiptLike;
    }>;
    uninstallExternalSkillPackage?: (request: { packageId: string }) => Promise<{
      error?: string;
      ok: boolean;
      receipt?: DesktopPetExternalSkillPackageLifecycleReceiptLike;
      retentionCleanup?: DesktopPetExternalSkillPackageUninstallSnapshotCleanupLike;
      snapshot?: { packageId: string; snapshotId: string; uninstalledAt: string };
    }>;
    rollbackExternalSkillPackageUninstall?: (request: { packageId: string; snapshotId: string }) => Promise<{
      error?: string;
      ok: boolean;
      receipt?: DesktopPetExternalSkillPackageLifecycleReceiptLike;
    }>;
    listExternalSkillPackageUninstallSnapshots?: (request?: { packageId?: string }) => Promise<{
      error?: string;
      invalidSnapshotCount: number;
      invalidSnapshotIds: string[];
      ok: boolean;
      policy: { maxAgeDays: number; maxSnapshotsPerPackage: number };
      snapshots: Array<{ packageId: string; snapshotId: string; uninstalledAt: string }>;
      totalCount: number;
    }>;
    cleanupExternalSkillPackageUninstallSnapshots?: (request?: { packageId?: string }) => Promise<DesktopPetExternalSkillPackageUninstallSnapshotCleanupLike>;
    listExternalSkillPackageLifecycleReceipts?: (request?: { packageId?: string }) => Promise<{
      kind: 'external-skill-package-lifecycle-receipts.v1';
      ok: boolean;
      receipts: DesktopPetExternalSkillPackageLifecycleReceiptLike[];
      totalCount: number;
    }>;
    exportExternalSkillPackageLifecycleReceipts?: (request?: { packageId?: string }) => Promise<DesktopPetExternalSkillJsonExportLike>;
    onOpenSettings?: (callback: () => void) => () => void;
    setSettingsOpen?: (isOpen: boolean) => void;
    openSettingsWindow?: () => void;
    closeSettingsWindow?: () => void;
    isSettingsWindowOpen?: () => Promise<boolean>;
    onSettingsWindowState?: (callback: (isOpen: boolean) => void) => () => void;
    openChatWindow?: () => void;
    closeChatWindow?: () => void;
    setAgentDesktopExecutionActive?: (active: boolean) => Promise<{ active: boolean } | void>;
    setCurrentWindowBounds?: (bounds: { x: number; y: number; width: number; height: number }) => void;
    minimizeCurrentWindow?: () => void;
    toggleMaximizeCurrentWindow?: () => Promise<boolean>;
    isCurrentWindowMaximized?: () => Promise<boolean>;
    /** Local Windows OCR; text line boxes are in the image's pixel coordinates. */
    recognizeScreenText?: (request: { imageDataUrl: string }) => Promise<DesktopPetScreenTextRecognitionResultLike>;
    captureRegionText?: (request: DesktopPetScreenRegionTextRequestLike) => Promise<DesktopPetScreenRegionTextResultLike>;
    /** High-resolution still of one capture source, taken in the main process. */
    captureSourceImage?: (request: { height?: number; maxSide?: number; sourceId: string; width?: number }) => Promise<{ height?: number; imageDataUrl?: string; ok: boolean; reason?: string; width?: number }>;
    restoreMaximizedWindowForDrag?: (
      request: DesktopPetWindowDragRestoreRequest,
    ) => Promise<{ x: number; y: number; width: number; height: number } | null>;
    isChatWindowOpen?: () => Promise<boolean>;
    onChatWindowState?: (callback: (isOpen: boolean) => void) => () => void;
    setInteractiveRegions?: (
      regions: DesktopPetInteractiveRegionLike[],
      options?: DesktopPetInteractiveRegionSyncOptionsLike | null,
    ) => void;
    setPetDragNativeShapeActive?: (active: boolean) => void;
    onRefreshNativeInteractiveRegions?: (callback: (payload: unknown) => void) => () => void;
    markMainWindowReadyToShow?: () => void;
    setPointerPassthrough?: (ignore: boolean) => void;
    syncSharedState?: (state: unknown) => void;
    getSharedState?: () => Promise<unknown>;
    onSharedState?: (callback: (state: unknown) => void) => () => void;
    publishRuntimeWorldPresentationIntent?: (intent: unknown) => void;
    onRuntimeWorldPresentationIntent?: (callback: (intent: unknown) => void) => () => void;
    sendSettingsAction?: (action: unknown) => void;
    onSettingsAction?: (callback: (action: unknown) => void) => () => void;
    getDisplayEnvironment?: (options?: DesktopPetDisplayEnvironmentRequestLike) => Promise<DesktopPetDisplayEnvironmentLike>;
    onDisplayEnvironmentChange?: (callback: (environment: DesktopPetDisplayEnvironmentLike | null) => void) => () => void;
    getUnityBridgeStatus?: () => Promise<DesktopPetUnityBridgeStatusLike | null>;
    sendUnityBridgeCommand?: (command?: DesktopPetUnityBridgeCommandLike | null) => Promise<DesktopPetUnityBridgeCommandResultLike>;
    onUnityBridgeStatus?: (callback: (status: DesktopPetUnityBridgeStatusLike | null) => void) => () => void;
    onUnityBridgeEvent?: (callback: (event: DesktopPetUnityBridgeEventLike | null) => void) => () => void;
    listDisplays?: () => Promise<DesktopPetDisplayLike[]>;
    getSystemInfo?: () => Promise<DesktopPetSystemInfoLike | null>;
    listCaptureSources?: (request?: DesktopPetCaptureSourceListRequestLike) => Promise<DesktopPetCaptureSourceLike[]>;
    listDesktopIcons?: (options?: {
      coordinateSpace?: 'dip' | 'native-screen';
      forceRefresh?: boolean;
      includeFileSystemFallback?: boolean;
      includeReadOnlyPositionFallback?: boolean;
    }) => Promise<DesktopPetDesktopIconLike[]>;
    moveDesktopIcon?: (request?: {
      coordinateSpace?: 'dip' | 'native-screen';
      iconId?: string;
      iconName?: string;
      x: number;
      y: number;
    }) => Promise<DesktopPetDesktopIconMoveResultLike>;
    launchLocalApp?: (request?: {
      forceNew?: boolean;
      forceRefresh?: boolean;
      name?: string;
      openMode?: 'new' | 'reuse';
      query?: string;
    }) => Promise<DesktopPetLocalAppLaunchResultLike>;
    getDefaultAppForUri?: (request?: {
      protocol?: string;
      scheme?: string;
      uriScheme?: string;
    }) => Promise<unknown>;
    listRunningApps?: (request?: {
      includeWindows?: boolean;
      query?: string;
    }) => Promise<unknown>;
    observeWindowsAndApps?: (request?: {
      forceRefresh?: boolean;
      includeActiveWindow?: boolean;
      includeDisplays?: boolean;
      includeInstalledApps?: boolean;
      includeRunningApps?: boolean;
      includeTaskbarPinned?: boolean;
      limit?: number;
      query?: string;
    }) => Promise<unknown>;
    inspectWindowUi?: (request?: {
      hwnd?: number;
      limit?: number;
      maxDepth?: number;
      query?: string;
      targetDescription?: string;
      targetText?: string;
    }) => Promise<unknown>;
    invokeWindowUi?: (request?: {
      automationId?: string;
      controlType?: string;
      fallbackX?: number;
      fallbackY?: number;
      hwnd?: number;
      limit?: number;
      maxDepth?: number;
      name?: string;
      query?: string;
      target?: string;
      targetDescription?: string;
      targetText?: string;
      title?: string;
      uiAction?: string;
      value?: string;
      x?: number;
      y?: number;
    }) => Promise<unknown>;
    getActiveWindowInfo?: () => Promise<DesktopPetActiveWindowInfoResultLike>;
    focusWindow?: (request?: {
      name?: string;
      processName?: string;
      query?: string;
      target?: string;
      title?: string;
    }) => Promise<unknown>;
    moveWindowToDisplay?: (request?: {
      display?: string;
      displayId?: string;
      displayTarget?: string;
      fallbackToActiveWindow?: boolean;
      hwnd?: number;
      name?: string;
      pid?: number;
      position?: string;
      preserveSize?: boolean;
      processName?: string;
      query?: string;
      queryCandidates?: string[];
      screen?: string;
      screenTarget?: string;
      target?: string;
      targetDisplay?: string;
      targetDisplayId?: string;
      title?: string;
      windowHandle?: number;
    }) => Promise<unknown>;
    controlWindow?: (request?: {
      coordinateSpace?: 'native-screen' | 'display' | string;
      display?: string;
      displayId?: string;
      displayTarget?: string;
      fallbackToActiveWindow?: boolean;
      height?: number;
      hwnd?: number;
      name?: string;
      pid?: number;
      placement?: string;
      processName?: string;
      query?: string;
      screen?: string;
      screenTarget?: string;
      snap?: string;
      snapPosition?: string;
      state?: string;
      target?: string;
      targetDisplay?: string;
      targetDisplayId?: string;
      title?: string;
      windowHandle?: number;
      windowState?: string;
      width?: number;
      x?: number;
      y?: number;
    }) => Promise<unknown>;
    closeWindow?: (request?: {
      hwnd?: number;
      name?: string;
      pid?: number;
      processName?: string;
      query?: string;
      target?: string;
      title?: string;
      windowHandle?: number;
    }) => Promise<unknown>;
    openResource?: (request?: {
      forceNew?: boolean;
      path?: string;
      query?: string;
      resourceType?: 'auto' | 'url' | 'file' | 'folder' | 'app';
      site?: string;
      target?: string;
      targetUrl?: string;
      url?: string;
      website?: string;
    }) => Promise<unknown>;
    executeDesktopInput?: (request?: {
      action?: string;
      button?: string;
      fromX?: number;
      fromY?: number;
      hotkey?: string;
      keys?: string;
      sequence?: string;
      steps?: number;
      targetX?: number;
      targetY?: number;
      text?: string;
      toX?: number;
      toY?: number;
      value?: string;
      x?: number;
      y?: number;
    }) => Promise<unknown>;
    runControlledCommand?: (request?: {
      command?: string;
      cwd?: string;
      query?: string;
      requestId?: string;
      script?: string;
      shell?: 'powershell' | 'cmd';
      timeoutMs?: number;
    }) => Promise<unknown>;
    cancelControlledCommand?: (request?: {
      requestId?: string;
    }) => Promise<unknown>;
    listMcpTools?: (request?: {
      serverId?: string | null;
    }) => Promise<DesktopPetMcpToolListResultLike>;
    inspectMcpServer?: (request?: {
      serverId?: string | null;
    }) => Promise<DesktopPetMcpServerDiagnosticLike>;
    preflightMcpServerEnvironment?: (request?: {
      server?: {
        args?: string[];
        command?: string;
        cwd?: string;
        env?: Record<string, unknown>;
        id?: string;
      };
    }) => Promise<DesktopPetMcpServerEnvironmentPreflightLike>;
    callMcpTool?: (request?: {
      arguments?: Record<string, unknown>;
      name?: string;
      requestId?: string;
      serverId?: string;
    }) => Promise<DesktopPetMcpToolCallResultLike>;
    cancelMcpToolCall?: (request?: {
      requestId?: string;
    }) => Promise<{
      cancelled: boolean;
      error?: string;
      ok?: boolean;
      requestId?: string;
    }>;
    getMcpSessionStatus?: () => Promise<DesktopPetMcpSessionStatusResultLike>;
    resetMcpSession?: (request?: {
      serverId?: string | null;
    }) => Promise<DesktopPetMcpSessionResetResultLike>;
    listMcpHistory?: (request?: {
      limit?: number;
      serverId?: string | null;
    }) => Promise<DesktopPetMcpHistoryResultLike>;
    clearMcpHistory?: (request?: {
      serverId?: string | null;
    }) => Promise<DesktopPetMcpHistoryMutationResultLike>;
    exportMcpHistory?: (request?: {
      limit?: number;
      serverId?: string | null;
    }) => Promise<DesktopPetMcpHistoryExportResultLike>;
    setMcpHistoryRetention?: (request?: {
      limit?: number;
    }) => Promise<DesktopPetMcpHistoryMutationResultLike>;
    loadMcpConfig?: () => Promise<DesktopPetMcpConfigResultLike>;
    saveMcpConfig?: (request?: {
      rawText?: string;
    }) => Promise<DesktopPetMcpConfigResultLike>;
    getMcpSoakReadiness?: (request?: {
      rawText?: string;
      reportDir?: string;
      rounds?: number;
    }) => Promise<DesktopPetMcpSoakReadinessResultLike>;
    rememberLocalApp?: (request?: {
      alias?: string;
      aliases?: string[];
      appPath?: string;
      name?: string;
      path?: string;
    }) => Promise<DesktopPetLocalAppMemoryResultLike>;
    getPathInfo?: (request?: {
      path?: string;
      query?: string;
      target?: string;
    }) => Promise<DesktopPetPathInfoResultLike>;
    listDirectory?: (request?: {
      folderPath?: string;
      includeHidden?: boolean;
      limit?: number;
      path?: string;
      query?: string;
    }) => Promise<DesktopPetDirectoryListResultLike>;
    searchFiles?: (request?: {
      extension?: string;
      extensions?: string[] | string;
      folderPath?: string;
      includeHidden?: boolean;
      limit?: number;
      maxDepth?: number;
      nameQuery?: string;
      path?: string;
      pattern?: string;
      query?: string;
      rootPath?: string;
    }) => Promise<DesktopPetFileSearchResultLike>;
    readTextFile?: (request?: {
      filePath?: string;
      maxBytes?: number;
      path?: string;
      query?: string;
    }) => Promise<DesktopPetTextFileReadResultLike>;
    readFileDataUrl?: (request?: {
      filePath?: string;
      maxBytes?: number;
      path?: string;
      query?: string;
    }) => Promise<{
      dataUrl?: string;
      error?: string;
      ok: boolean;
      path: string;
      sizeBytes?: number;
    }>;
    stage2DSequence?: (request?: { sequenceName?: string; sourcePaths?: string[] }) => Promise<{
      error?: string;
      folderId?: string;
      frameCount?: number;
      frameUrls?: string[];
      ok: boolean;
    }>;
    choose2DVideoFolder?: () => Promise<{
      cancelled?: boolean;
      error?: string;
      folderPath?: string;
      ok: boolean;
      videoCount?: number;
    }>;
    pick2DVideoFromFolder?: (request?: { folderPath?: string }) => Promise<{
      error?: string;
      ok: boolean;
      videoCount?: number;
      videoUrl?: string;
    }>;
    choose2DVideoLibrary?: () => Promise<DesktopPetVideoLibraryInspection & { cancelled?: boolean }>;
    inspect2DVideoLibrary?: (request?: { rootPath?: string }) => Promise<DesktopPetVideoLibraryInspection>;
    resolve2DVideoLibraryRoot?: (request?: { sourcePath?: string }) => Promise<DesktopPetVideoLibraryInspection>;
    pick2DVideoFromLibrary?: (request?: { folderNames?: string[]; rootPath?: string }) => Promise<{
      error?: string;
      folderName?: string;
      ok: boolean;
      videoUrl?: string;
    }>;
    stage2DVideo?: (request?: { sourcePath?: string; videoName?: string }) => Promise<{
      error?: string;
      ok: boolean;
      converted?: boolean;
      videoUrl?: string;
    }>;
    executeFileManagementAction?: (request?: {
      action?: string;
      desktopPath?: string;
      destination?: string;
      destinationDirectory?: string;
      destinationPath?: string;
      dest?: string;
      dryRun?: boolean;
      fileAction?: string;
      fileName?: string;
      folderName?: string;
      from?: string;
      group?: string;
      groupBy?: 'none' | 'kind' | 'category' | 'extension';
      grouping?: string;
      includeDirectories?: boolean;
      includeHidden?: boolean;
      includeShortcuts?: boolean;
      intendedAction?: string;
      limit?: number;
      mode?: 'execute' | 'preview';
      name?: string;
      newName?: string;
      newPath?: string;
      operation?: string;
      path?: string;
      previewAction?: string;
      query?: string;
      source?: string;
      sourcePath?: string;
      targetAction?: string;
      targetDirectory?: string;
      targetPath?: string;
      to?: string;
    }) => Promise<DesktopPetFileManagementActionResultLike>;
    inspectLocalProject?: (request?: {
      filePath?: string;
      folderPath?: string;
      path?: string;
      projectPath?: string;
      query?: string;
    }) => Promise<DesktopPetLocalProjectInspectionLike>;
    runLocalProjectAction?: (request?: {
      actionIndex?: number;
      command?: string;
      dryRun?: boolean;
      filePath?: string;
      folderPath?: string;
      label?: string;
      path?: string;
      projectPath?: string;
      query?: string;
    }) => Promise<DesktopPetLocalProjectRunResultLike>;
    getCursorScreenPoint?: () => Promise<DesktopPetCursorPointLike | null>;
    listLocalVoiceAssets?: (options?: DesktopPetLocalVoiceAssetListOptionsLike) => Promise<DesktopPetLocalVoiceAssetsLike>;
    getLocalVoiceHealth?: (settings?: unknown) => Promise<DesktopPetLocalVoiceHealthLike>;
    warmupLocalVoice?: (settings?: unknown) => Promise<unknown>;
    installLocalVoiceDependencies?: (settings?: unknown) => Promise<DesktopPetLocalVoiceInstallResultLike>;
    getBrowserTtsHealth?: (settings?: unknown) => Promise<unknown>;
    startBrowserTtsService?: (settings?: unknown) => Promise<unknown>;
    installBrowserTtsDependencies?: (settings?: unknown) => Promise<unknown>;
    listBrowserTtsSpeakers?: (settings?: unknown) => Promise<unknown>;
    getGptSovitsHealth?: (settings?: unknown) => Promise<unknown>;
    startGptSovitsService?: (settings?: unknown) => Promise<unknown>;
    listGptSovitsModels?: () => Promise<unknown>;
    installGptSovitsRuntime?: (settings?: unknown) => Promise<unknown>;
    onGptSovitsInstallProgress?: (callback: (progress: unknown) => void) => () => void;
    pushRuntimeLog?: (scope?: string, message?: string, details?: unknown) => void;
    getRuntimeLogs?: () => Promise<string[]>;
    detectBrowserSearch?: (payload?: unknown) => Promise<unknown>;
    browserSearch?: (payload?: unknown) => Promise<unknown>;
    controlBrowser?: (payload?: unknown) => Promise<unknown>;
    onRuntimeLog?: (callback: (line: string) => void) => () => void;
    onLocalVoiceInstallProgress?: (callback: (progress: DesktopPetLocalVoiceInstallProgressLike | null) => void) => () => void;
    onBrowserTtsInstallProgress?: (callback: (progress: unknown) => void) => () => void;
    synthesizeLocalVoice?: (payload?: unknown) => Promise<DesktopPetLocalVoiceSynthesisResultLike>;
    cancelLocalVoiceSynthesis?: () => Promise<boolean>;
    transcribeLocalVoice?: (payload?: unknown) => Promise<{ text?: string }>;
    pickDesktopCaptureArea?: () => Promise<DesktopPetAreaSelectionLike | null>;
    getAreaPickerContext?: () => Promise<DesktopPetAreaPickerContextLike | null>;
    onAreaPickerContext?: (callback: (context: DesktopPetAreaPickerContextLike | null) => void) => () => void;
    submitAreaPickerSelection?: (selection: DesktopPetAreaSelectionLike | null) => void;
    cancelAreaPickerSelection?: () => void;
    updateActivityRegion?: (config: { displayId?: string; areaScale?: number }) => void;
  };
}
