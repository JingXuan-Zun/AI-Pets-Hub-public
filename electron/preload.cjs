const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('desktopPetShell', {
  platform: process.platform,
  packaged: process.env.DESKTOP_PET_LOCAL_TEST === '1' || process.env.NODE_ENV === 'production',
  desktopMode: true,
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file) || '';
    } catch {
      return '';
    }
  },
  loadPersistedConfigSync: () => ipcRenderer.sendSync('desktop-pet:load-persisted-config-sync'),
  savePersistedConfig: (config) => ipcRenderer.invoke('desktop-pet:save-persisted-config', config ?? null),
  probeDeepSeekHarness: (request) => ipcRenderer.invoke('desktop-pet:deepseek-harness-probe', request ?? {}),
  checkDeepSeekHarnessUpdate: (request) => ipcRenderer.invoke('desktop-pet:deepseek-harness-update-check', request ?? {}),
  prepareDeepSeekHarnessProfile: (request) => ipcRenderer.invoke('desktop-pet:deepseek-harness-prepare-profile', request ?? {}),
  validateDeepSeekHarnessSetup: (request) => ipcRenderer.invoke('desktop-pet:deepseek-harness-validate-setup', request ?? {}),
  runDeepSeekHarness: (request) => ipcRenderer.invoke('desktop-pet:deepseek-harness-run', request ?? {}),
  cancelDeepSeekHarness: (request) => ipcRenderer.invoke('desktop-pet:deepseek-harness-cancel', request ?? {}),
  loadPersistedChatHistory: () => ipcRenderer.invoke('desktop-pet:load-persisted-chat-history'),
  savePersistedChatHistory: (messages) => ipcRenderer.invoke('desktop-pet:save-persisted-chat-history', messages ?? []),
  getExpressionLibraryState: (request) => ipcRenderer.invoke('desktop-pet:expression-library-get-state', request ?? {}),
  getExpressionReplyCatalog: () => ipcRenderer.invoke('desktop-pet:expression-reply-catalog-get'),
  chooseExpressionLibraryRoot: (request) => ipcRenderer.invoke('desktop-pet:expression-library-choose-root', request ?? {}),
  selectExpressionLibraryMode: (request) => ipcRenderer.invoke('desktop-pet:expression-library-select-mode', request ?? {}),
  rescanExpressionLibrary: () => ipcRenderer.invoke('desktop-pet:expression-library-rescan'),
  createExpressionCategory: (request) => ipcRenderer.invoke('desktop-pet:expression-library-create-category', request ?? {}),
  updateExpressionCategory: (request) => ipcRenderer.invoke('desktop-pet:expression-library-update-category', request ?? {}),
  deleteExpressionCategory: (request) => ipcRenderer.invoke('desktop-pet:expression-library-delete-category', request ?? {}),
  importExpressionImages: (request) => ipcRenderer.invoke('desktop-pet:expression-library-import-images', request ?? {}),
  importExpressionDroppedImages: (request) => ipcRenderer.invoke('desktop-pet:expression-library-import-dropped-images', request ?? {}),
  importExpressionClassifiedRoot: () => ipcRenderer.invoke('desktop-pet:expression-library-import-classified-root'),
  openExpressionCategoryFolder: (request) => ipcRenderer.invoke('desktop-pet:expression-library-open-category-folder', request ?? {}),
  setExpressionAssetStatus: (request) => ipcRenderer.invoke('desktop-pet:expression-library-set-asset-status', request ?? {}),
  moveExpressionAssets: (request) => ipcRenderer.invoke('desktop-pet:expression-library-move-assets', request ?? {}),
  removeExpressionAssets: (request) => ipcRenderer.invoke('desktop-pet:expression-library-remove-assets', request ?? {}),
  undoExpressionBatch: (request) => ipcRenderer.invoke('desktop-pet:expression-library-undo-batch', request ?? {}),
  getExpressionAssetPreview: (request) => ipcRenderer.invoke('desktop-pet:expression-library-get-preview', request ?? {}),
  getAppRuntimeInfo: () => ipcRenderer.invoke('desktop-pet:get-app-runtime-info'),
  resetUserDataAndRelaunch: () => ipcRenderer.invoke('desktop-pet:reset-user-data-and-relaunch'),
  readNeuralPersonaRecord: (request) => ipcRenderer.invoke(
    'desktop-pet:read-neural-persona-record', request ?? {},
  ),
  compareAndSwapNeuralPersonaRecord: (request) => ipcRenderer.invoke(
    'desktop-pet:compare-and-swap-neural-persona-record', request ?? {},
  ),
  onOpenSettings: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = () => callback();
    ipcRenderer.on('desktop-pet:open-settings', listener);

    return () => {
      ipcRenderer.removeListener('desktop-pet:open-settings', listener);
    };
  },
  setSettingsOpen: (isOpen) => {
    ipcRenderer.send('desktop-pet:set-settings-open', Boolean(isOpen));
  },
  openSettingsWindow: () => {
    ipcRenderer.send('desktop-pet:open-settings-window');
  },
  closeSettingsWindow: () => {
    ipcRenderer.send('desktop-pet:close-settings-window');
  },
  isSettingsWindowOpen: () => ipcRenderer.invoke('desktop-pet:is-settings-window-open'),
  onSettingsWindowState: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (_event, isOpen) => callback(Boolean(isOpen));
    ipcRenderer.on('desktop-pet:settings-window-state', listener);

    return () => {
      ipcRenderer.removeListener('desktop-pet:settings-window-state', listener);
    };
  },
  openChatWindow: () => {
    ipcRenderer.send('desktop-pet:open-chat-window');
  },
  closeChatWindow: () => {
    ipcRenderer.send('desktop-pet:close-chat-window');
  },
  setAgentDesktopExecutionActive: (active) => {
    return ipcRenderer.invoke('desktop-pet:set-agent-desktop-execution-active', Boolean(active));
  },
  setCurrentWindowBounds: (bounds) => {
    ipcRenderer.send('desktop-pet:set-current-window-bounds', bounds ?? null);
  },
  minimizeCurrentWindow: () => {
    ipcRenderer.send('desktop-pet:minimize-current-window');
  },
  isChatWindowOpen: () => ipcRenderer.invoke('desktop-pet:is-chat-window-open'),
  onChatWindowState: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (_event, isOpen) => callback(Boolean(isOpen));
    ipcRenderer.on('desktop-pet:chat-window-state', listener);

    return () => {
      ipcRenderer.removeListener('desktop-pet:chat-window-state', listener);
    };
  },
  setPointerPassthrough: (ignore) => {
    ipcRenderer.send('desktop-pet:set-pointer-passthrough', Boolean(ignore));
  },
  setInteractiveRegions: (regions, options) => {
    ipcRenderer.send(
      'desktop-pet:set-interactive-regions',
      Array.isArray(regions) ? regions : [],
      options && typeof options === 'object' ? options : null,
    );
  },
  setPetDragNativeShapeActive: (active) => {
    ipcRenderer.send('desktop-pet:set-pet-drag-native-shape-active', Boolean(active));
  },
  onRefreshNativeInteractiveRegions: (callback) => {
    const listener = (_event, payload) => callback(payload ?? null);
    ipcRenderer.on('desktop-pet:refresh-native-interactive-regions', listener);
    return () => {
      ipcRenderer.removeListener('desktop-pet:refresh-native-interactive-regions', listener);
    };
  },
  markMainWindowReadyToShow: () => {
    ipcRenderer.send('desktop-pet:mark-main-window-ready-to-show');
  },
  syncSharedState: (state) => {
    ipcRenderer.send('desktop-pet:sync-shared-state', state ?? null);
  },
  getSharedState: () => ipcRenderer.invoke('desktop-pet:get-shared-state'),
  onSharedState: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (_event, state) => callback(state ?? null);
    ipcRenderer.on('desktop-pet:shared-state', listener);

    return () => {
      ipcRenderer.removeListener('desktop-pet:shared-state', listener);
    };
  },
  publishRuntimeWorldPresentationIntent: (intent) => {
    ipcRenderer.send('desktop-pet:publish-runtime-world-presentation-intent', intent ?? null);
  },
  onRuntimeWorldPresentationIntent: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (_event, intent) => callback(intent ?? null);
    ipcRenderer.on('desktop-pet:runtime-world-presentation-intent', listener);

    return () => {
      ipcRenderer.removeListener('desktop-pet:runtime-world-presentation-intent', listener);
    };
  },
  sendSettingsAction: (action) => {
    ipcRenderer.send('desktop-pet:settings-action', action ?? null);
  },
  onSettingsAction: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (_event, action) => callback(action ?? null);
    ipcRenderer.on('desktop-pet:settings-action', listener);

    return () => {
      ipcRenderer.removeListener('desktop-pet:settings-action', listener);
    };
  },
  getDisplayEnvironment: (options) => ipcRenderer.invoke('desktop-pet:get-display-environment', options ?? {}),
  onDisplayEnvironmentChange: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (_event, environment) => callback(environment ?? null);
    ipcRenderer.on('desktop-pet:display-environment-change', listener);

    return () => {
      ipcRenderer.removeListener('desktop-pet:display-environment-change', listener);
    };
  },
  getUnityBridgeStatus: () => ipcRenderer.invoke('desktop-pet:get-unity-bridge-status'),
  sendUnityBridgeCommand: (command) => ipcRenderer.invoke('desktop-pet:send-unity-bridge-command', command ?? null),
  onUnityBridgeStatus: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (_event, status) => callback(status ?? null);
    ipcRenderer.on('desktop-pet:unity-bridge-status', listener);

    return () => {
      ipcRenderer.removeListener('desktop-pet:unity-bridge-status', listener);
    };
  },
  onUnityBridgeEvent: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (_event, payload) => callback(payload ?? null);
    ipcRenderer.on('desktop-pet:unity-bridge-event', listener);

    return () => {
      ipcRenderer.removeListener('desktop-pet:unity-bridge-event', listener);
    };
  },
  listDisplays: () => ipcRenderer.invoke('desktop-pet:list-displays'),
  getSystemInfo: () => ipcRenderer.invoke('desktop-pet:get-system-info'),
  listCaptureSources: (request) => ipcRenderer.invoke('desktop-pet:list-capture-sources', request ?? {}),
  listDesktopIcons: (options) => ipcRenderer.invoke('desktop-pet:list-desktop-icons', options ?? {}),
  moveDesktopIcon: (request) => ipcRenderer.invoke('desktop-pet:move-desktop-icon', request ?? {}),
  launchLocalApp: (request) => ipcRenderer.invoke('desktop-pet:launch-local-app', request ?? {}),
  getDefaultAppForUri: (request) => ipcRenderer.invoke('desktop-pet:get-default-app-for-uri', request ?? {}),
  listRunningApps: (request) => ipcRenderer.invoke('desktop-pet:list-running-apps', request ?? {}),
  observeWindowsAndApps: (request) => ipcRenderer.invoke('desktop-pet:observe-windows-and-apps', request ?? {}),
  inspectWindowUi: (request) => ipcRenderer.invoke('desktop-pet:inspect-window-ui', request ?? {}),
  invokeWindowUi: (request) => ipcRenderer.invoke('desktop-pet:invoke-window-ui', request ?? {}),
  getActiveWindowInfo: () => ipcRenderer.invoke('desktop-pet:get-active-window-info'),
  focusWindow: (request) => ipcRenderer.invoke('desktop-pet:focus-window', request ?? {}),
  moveWindowToDisplay: (request) => ipcRenderer.invoke('desktop-pet:move-window-to-display', request ?? {}),
  controlWindow: (request) => ipcRenderer.invoke('desktop-pet:control-window', request ?? {}),
  closeWindow: (request) => ipcRenderer.invoke('desktop-pet:close-window', request ?? {}),
  openResource: (request) => ipcRenderer.invoke('desktop-pet:open-resource', request ?? {}),
  executeDesktopInput: (request) => ipcRenderer.invoke('desktop-pet:execute-desktop-input', request ?? {}),
  runControlledCommand: (request) => ipcRenderer.invoke('desktop-pet:run-controlled-command', request ?? {}),
  cancelControlledCommand: (request) => ipcRenderer.invoke('desktop-pet:cancel-controlled-command', request ?? {}),
  runSkillSandboxSupervisorProbe: (request) => ipcRenderer.invoke('desktop-pet:run-skill-sandbox-supervisor-probe', request ?? {}),
  runSkillSandboxPackage: (request) => ipcRenderer.invoke('desktop-pet:run-skill-sandbox-package', request ?? {}),
  listSkillCapabilityGrants: () => ipcRenderer.invoke('desktop-pet:list-skill-capability-grants'),
  listSkillCapabilityReceipts: (request) => ipcRenderer.invoke('desktop-pet:list-skill-capability-receipts', request ?? {}),
  clearSkillCapabilityReceipts: (request) => ipcRenderer.invoke('desktop-pet:clear-skill-capability-receipts', request ?? {}),
  listExternalSkillPackageHealth: (request) => ipcRenderer.invoke('desktop-pet:list-external-skill-package-health', request ?? {}),
  resetExternalSkillPackageHealth: (request) => ipcRenderer.invoke('desktop-pet:reset-external-skill-package-health', request ?? {}),
  createExternalSkillReleaseAdmissionReport: (request) => ipcRenderer.invoke('desktop-pet:create-external-skill-release-admission-report', request ?? {}),
  exportExternalSkillReleaseAdmissionReport: (request) => ipcRenderer.invoke('desktop-pet:export-external-skill-release-admission-report', request ?? {}),
  exportExternalSkillPackageHealthDiagnostics: (request) => ipcRenderer.invoke('desktop-pet:export-external-skill-package-health-diagnostics', request ?? {}),
  getExternalSkillMarketplaceProductionReadiness: () => ipcRenderer.invoke('desktop-pet:get-external-skill-marketplace-production-readiness'),
  exportExternalSkillMarketplaceProductionReadiness: () => ipcRenderer.invoke('desktop-pet:export-external-skill-marketplace-production-readiness'),
  setSkillCapabilityGrant: (request) => ipcRenderer.invoke('desktop-pet:set-skill-capability-grant', request ?? {}),
  revokeSkillCapabilityGrant: (request) => ipcRenderer.invoke('desktop-pet:revoke-skill-capability-grant', request ?? {}),
  decideSkillCapabilityRequest: (request) => ipcRenderer.invoke('desktop-pet:decide-skill-capability-request', request ?? {}),
  readSkillCapabilityStorage: (request) => ipcRenderer.invoke('desktop-pet:read-skill-capability-storage', request ?? {}),
  cancelSkillSandboxSupervisorProbe: (request) => ipcRenderer.invoke('desktop-pet:cancel-skill-sandbox-supervisor-probe', request ?? {}),
  stageSkillPackageArtifact: (request) => ipcRenderer.invoke('desktop-pet:stage-skill-package-artifact', request ?? {}),
  stageSignedSkillPackageArchive: (request) => ipcRenderer.invoke('desktop-pet:stage-signed-skill-package-archive', request ?? {}),
  auditSkillPackageArtifacts: (request) => ipcRenderer.invoke('desktop-pet:audit-skill-package-artifacts', request ?? {}),
  quarantineSkillPackageArtifact: (request) => ipcRenderer.invoke('desktop-pet:quarantine-skill-package-artifact', request ?? {}),
  restoreQuarantinedExternalSkillPackage: (request) => ipcRenderer.invoke('desktop-pet:restore-quarantined-external-skill-package', request ?? {}),
  uninstallExternalSkillPackage: (request) => ipcRenderer.invoke('desktop-pet:uninstall-external-skill-package', request ?? {}),
  rollbackExternalSkillPackageUninstall: (request) => ipcRenderer.invoke('desktop-pet:rollback-external-skill-package-uninstall', request ?? {}),
  listExternalSkillPackageUninstallSnapshots: (request) => ipcRenderer.invoke('desktop-pet:list-external-skill-package-uninstall-snapshots', request ?? {}),
  cleanupExternalSkillPackageUninstallSnapshots: (request) => ipcRenderer.invoke('desktop-pet:cleanup-external-skill-package-uninstall-snapshots', request ?? {}),
  listExternalSkillPackageLifecycleReceipts: (request) => ipcRenderer.invoke('desktop-pet:list-external-skill-package-lifecycle-receipts', request ?? {}),
  exportExternalSkillPackageLifecycleReceipts: (request) => ipcRenderer.invoke('desktop-pet:export-external-skill-package-lifecycle-receipts', request ?? {}),
  listMcpTools: (request) => ipcRenderer.invoke('desktop-pet:list-mcp-tools', request ?? {}),
  inspectMcpServer: (request) => ipcRenderer.invoke('desktop-pet:inspect-mcp-server', request ?? {}),
  preflightMcpServerEnvironment: (request) => ipcRenderer.invoke('desktop-pet:preflight-mcp-server-environment', request ?? {}),
  callMcpTool: (request) => ipcRenderer.invoke('desktop-pet:call-mcp-tool', request ?? {}),
  cancelMcpToolCall: (request) => ipcRenderer.invoke('desktop-pet:cancel-mcp-tool-call', request ?? {}),
  getMcpSessionStatus: () => ipcRenderer.invoke('desktop-pet:get-mcp-session-status'),
  resetMcpSession: (request) => ipcRenderer.invoke('desktop-pet:reset-mcp-session', request ?? {}),
  listMcpHistory: (request) => ipcRenderer.invoke('desktop-pet:list-mcp-history', request ?? {}),
  clearMcpHistory: (request) => ipcRenderer.invoke('desktop-pet:clear-mcp-history', request ?? {}),
  exportMcpHistory: (request) => ipcRenderer.invoke('desktop-pet:export-mcp-history', request ?? {}),
  setMcpHistoryRetention: (request) => ipcRenderer.invoke('desktop-pet:set-mcp-history-retention', request ?? {}),
  loadMcpConfig: () => ipcRenderer.invoke('desktop-pet:load-mcp-config'),
  saveMcpConfig: (request) => ipcRenderer.invoke('desktop-pet:save-mcp-config', request ?? {}),
  getMcpSoakReadiness: (request) => ipcRenderer.invoke('desktop-pet:get-mcp-soak-readiness', request ?? {}),
  rememberLocalApp: (request) => ipcRenderer.invoke('desktop-pet:remember-local-app', request ?? {}),
  getPathInfo: (request) => ipcRenderer.invoke('desktop-pet:get-path-info', request ?? {}),
  listDirectory: (request) => ipcRenderer.invoke('desktop-pet:list-directory', request ?? {}),
  searchFiles: (request) => ipcRenderer.invoke('desktop-pet:search-files', request ?? {}),
  readTextFile: (request) => ipcRenderer.invoke('desktop-pet:read-text-file', request ?? {}),
  readFileDataUrl: (request) => ipcRenderer.invoke('desktop-pet:read-file-data-url', request ?? {}),
  stage2DSequence: (request) => ipcRenderer.invoke('desktop-pet:stage-2d-sequence', request ?? {}),
  stage2DVideo: (request) => ipcRenderer.invoke('desktop-pet:stage-2d-video', request ?? {}),
  choose2DVideoFolder: () => ipcRenderer.invoke('desktop-pet:choose-2d-video-folder'),
  pick2DVideoFromFolder: (request) => ipcRenderer.invoke('desktop-pet:pick-2d-video-from-folder', request ?? {}),
  executeFileManagementAction: (request) => ipcRenderer.invoke('desktop-pet:execute-file-management-action', request ?? {}),
  inspectLocalProject: (request) => ipcRenderer.invoke('desktop-pet:inspect-local-project', request ?? {}),
  runLocalProjectAction: (request) => ipcRenderer.invoke('desktop-pet:run-local-project-action', request ?? {}),
  getCursorScreenPoint: () => ipcRenderer.invoke('desktop-pet:get-cursor-screen-point'),
  listLocalVoiceAssets: (options) => ipcRenderer.invoke('desktop-pet:list-local-voice-assets', options ?? {}),
  getLocalVoiceHealth: (settings) => ipcRenderer.invoke('desktop-pet:get-local-voice-health', settings ?? {}),
  warmupLocalVoice: (settings) => ipcRenderer.invoke('desktop-pet:warmup-local-voice', settings ?? {}),
  installLocalVoiceDependencies: (settings) => ipcRenderer.invoke('desktop-pet:install-local-voice-dependencies', settings ?? {}),
  pushRuntimeLog: (scope, message, details) => {
    ipcRenderer.send('desktop-pet:push-runtime-log', scope ?? '运行', message ?? '', details);
  },
  getRuntimeLogs: () => ipcRenderer.invoke('desktop-pet:get-runtime-logs'),
  detectBrowserSearch: (payload) => ipcRenderer.invoke('desktop-pet:detect-browser-search', payload ?? {}),
  browserSearch: (payload) => ipcRenderer.invoke('desktop-pet:browser-search', payload ?? {}),
  controlBrowser: (payload) => ipcRenderer.invoke('desktop-pet:control-browser', payload ?? {}),
  getBrowserTtsHealth: (settings) => ipcRenderer.invoke('desktop-pet:get-browser-tts-health', settings ?? {}),
  startBrowserTtsService: (settings) => ipcRenderer.invoke('desktop-pet:start-browser-tts-service', settings ?? {}),
  installBrowserTtsDependencies: (settings) => ipcRenderer.invoke('desktop-pet:install-browser-tts-dependencies', settings ?? {}),
  listBrowserTtsSpeakers: (settings) => ipcRenderer.invoke('desktop-pet:list-browser-tts-speakers', settings ?? {}),
  onRuntimeLog: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (_event, line) => callback(typeof line === 'string' ? line : '');
    ipcRenderer.on('desktop-pet:runtime-log', listener);

    return () => {
      ipcRenderer.removeListener('desktop-pet:runtime-log', listener);
    };
  },
  onLocalVoiceInstallProgress: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (_event, progress) => callback(progress ?? null);
    ipcRenderer.on('desktop-pet:local-voice-install-progress', listener);

    return () => {
      ipcRenderer.removeListener('desktop-pet:local-voice-install-progress', listener);
    };
  },
  onBrowserTtsInstallProgress: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (_event, progress) => callback(progress ?? null);
    ipcRenderer.on('desktop-pet:browser-tts-install-progress', listener);

    return () => {
      ipcRenderer.removeListener('desktop-pet:browser-tts-install-progress', listener);
    };
  },
  synthesizeLocalVoice: (payload) => ipcRenderer.invoke('desktop-pet:synthesize-local-voice', payload ?? {}),
  cancelLocalVoiceSynthesis: () => ipcRenderer.invoke('desktop-pet:cancel-local-voice-synthesis'),
  transcribeLocalVoice: (payload) => ipcRenderer.invoke('desktop-pet:transcribe-local-voice', payload ?? {}),
  pickDesktopCaptureArea: () => ipcRenderer.invoke('desktop-pet:pick-desktop-capture-area'),
  getAreaPickerContext: () => ipcRenderer.invoke('desktop-pet:get-area-picker-context'),
  onAreaPickerContext: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (_event, context) => callback(context ?? null);
    ipcRenderer.on('desktop-pet:area-picker-context', listener);

    return () => {
      ipcRenderer.removeListener('desktop-pet:area-picker-context', listener);
    };
  },
  submitAreaPickerSelection: (selection) => {
    ipcRenderer.send('desktop-pet:submit-area-picker-selection', selection ?? null);
  },
  cancelAreaPickerSelection: () => {
    ipcRenderer.send('desktop-pet:cancel-area-picker-selection');
  },
  updateActivityRegion: (config) => {
    ipcRenderer.send('desktop-pet:update-activity-region', config ?? {});
  },
});
