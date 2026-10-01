const { summarizeRuntimeValue } = require('./runtimeLogger.cjs');
const { registerMcpHistoryIpcHandlers } = require('./mcpHistoryIpcHandlers.cjs');
const { registerModelRequestIpc } = require('./modelRequestIpc.cjs');

const { BrowserWindow, dialog } = require('electron');

const CURRENT_WINDOW_COMPACT_MINIMUM_SIZE_KEY = '__desktopPetCompactMinimumSizeActive';
const currentWindowOriginalMinimumSize = new WeakMap();

function summarizeArgs(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return '';
  }

  return args
    .map((value) => summarizeRuntimeValue(value))
    .join(' | ');
}

function logRuntime(runtimeLogger, scope, message, details) {
  if (!runtimeLogger) {
    return;
  }

  runtimeLogger.log('后端', scope, message, details);
}

function registerLoggedEvent(ipcMain, runtimeLogger, channel, handler, options = {}) {
  const {
    logArgs = true,
    logLifecycle = true,
  } = options;

  ipcMain.on(channel, (event, ...args) => {
    const argSummary = logArgs ? summarizeArgs(args) : '';
    if (logLifecycle) {
      logRuntime(runtimeLogger, 'IPC', `received ${channel}${argSummary ? ` ${argSummary}` : ''}`);
    }

    try {
      handler(event, ...args);
      if (logLifecycle) {
        logRuntime(runtimeLogger, 'IPC', `completed ${channel}`);
      }
    } catch (error) {
      logRuntime(runtimeLogger, 'IPC', `failed ${channel}`, error?.stack || error);
      throw error;
    }
  });
}

function registerLoggedHandle(ipcMain, runtimeLogger, channel, handler, options = {}) {
  const {
    logArgs = true,
    summarizeResult,
  } = options;

  ipcMain.handle(channel, async (event, ...args) => {
    const argSummary = logArgs ? summarizeArgs(args) : '';
    logRuntime(runtimeLogger, 'IPC', `received ${channel}${argSummary ? ` ${argSummary}` : ''}`);

    try {
      const result = await handler(event, ...args);
      const resultSummary = typeof summarizeResult === 'function'
        ? summarizeResult(result)
        : undefined;
      logRuntime(runtimeLogger, 'IPC', `completed ${channel}`, resultSummary);
      return result;
    } catch (error) {
      logRuntime(runtimeLogger, 'IPC', `failed ${channel}`, error?.stack || error);
      throw error;
    }
  });
}

function registerDesktopPetIpcHandlers({
  app,
  appUsageMetricsService,
  buildInfo,
  appLauncherService,
  areaPickerService,
  browserSearchService,
  browserTtsService,
  clearDesktopPetUserDataAndRelaunch,
  captureService,
  controlledCommandService,
  desktopIconService,
  desktopInputService,
  externalSkillCapabilityGateway,
  externalSkillMarketplaceProductionReadinessService,
  externalSkillPackageArchiveInstallerService,
  externalSkillPackageLifecycleService,
  externalSkillSandboxSupervisorService,
  ipcMain,
  localFileSystemService,
  localProjectInspectorService,
  localVoiceLibrary,
  localVoiceRuntime,
  deepseekHarnessRuntimeService,
  mcpConfigService,
  mcpHistoryService,
  mcpServerDiagnosticsService,
  mcpServerEnvironmentPreflightService,
  mcpSoakReadinessService,
  mcpStdioClientService,
  neuralPersonaFileStore,
  persistedConfigStore,
  persistedChatHistoryStore,
  runtimeLogger,
  screen,
  sequenceAssetStore,
  shell,
  skillPackageArtifactStore,
  skillPackageSignedInstallCoordinator,
  systemInfoService,
  unityBridgeService,
  unityRuntimeProcessService,
  windowManager,
}) {
  void app;
  registerModelRequestIpc({ ipcMain, persistedConfigStore, app });
  let persistedConfigSaveQueue = Promise.resolve();
  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:deepseek-harness-probe', (_event, request) => (
    deepseekHarnessRuntimeService?.probe(request ?? {}) ?? { available: false, error: 'service-unavailable', pythonVersion: null, sdkVersion: null }
  ), { logArgs: false });
  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:deepseek-harness-update-check', (_event, request) => (
    deepseekHarnessRuntimeService?.checkUpdate(request ?? {}) ?? { checked: false, error: 'service-unavailable', latestVersion: null }
  ), { logArgs: false });
  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:deepseek-harness-prepare-profile', (_event, request) => (
    deepseekHarnessRuntimeService?.prepareCapabilityProfile(request ?? {}) ?? { error: 'service-unavailable', ok: false }
  ), { logArgs: false, summarizeResult: (result) => ({ ok: Boolean(result?.ok), profilePath: result?.profilePath ? 'configured' : '' }) });
  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:deepseek-harness-validate-setup', (_event, request) => (
    deepseekHarnessRuntimeService?.validateSetup(request ?? {}) ?? { error: 'service-unavailable', ok: false }
  ), { logArgs: false, summarizeResult: (result) => ({ ok: Boolean(result?.ok), checks: result?.checks ?? {} }) });
  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:deepseek-harness-run', (_event, request) => (
    deepseekHarnessRuntimeService?.run(request ?? {}) ?? Promise.resolve({ error: 'service-unavailable', ok: false })
  ), { logArgs: false, summarizeResult: (result) => ({ ok: Boolean(result?.ok), hasResponse: Boolean(result?.finalResponse) }) });
  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:deepseek-harness-cancel', (_event, request) => (
    deepseekHarnessRuntimeService?.cancel(request ?? {}) ?? { cancelled: false, ok: false, error: 'service-unavailable' }
  ), { logArgs: false, summarizeResult: (result) => ({ cancelled: Boolean(result?.cancelled), ok: Boolean(result?.ok) }) });
  let persistedChatHistorySaveQueue = Promise.resolve();
  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:load-persisted-chat-history', () => {
    return persistedChatHistoryStore?.load?.() ?? {
      error: 'persisted chat history store unavailable', messages: [], ok: false,
    };
  }, { logArgs: false, summarizeResult: (result) => ({ ok: Boolean(result?.ok), messageCount: result?.messages?.length ?? 0 }) });
  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:save-persisted-chat-history', async (_event, messages) => {
    const saveTask = persistedChatHistorySaveQueue.then(() => new Promise((resolve, reject) => {
      try {
        resolve(persistedChatHistoryStore?.save?.(messages) ?? {
          error: 'persisted chat history store unavailable', ok: false,
        });
      } catch (error) {
        reject(error);
      }
    }));
    persistedChatHistorySaveQueue = saveTask.then(() => undefined, () => undefined);
    return saveTask;
  }, { logArgs: false, summarizeResult: (result) => ({ ok: Boolean(result?.ok), messageCount: result?.messageCount ?? 0 }) });
  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:read-neural-persona-record', async (_event, request) => {
    return neuralPersonaFileStore?.read?.(request?.roleId) ?? {
      error: 'neural-persona-file-store-unavailable',
      ok: false,
    };
  }, { logArgs: false });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:compare-and-swap-neural-persona-record', async (_event, request) => {
    return neuralPersonaFileStore?.compareAndSwap?.(
      request?.roleId,
      request?.expectedValue ?? null,
      request?.nextValue,
    ) ?? { error: 'neural-persona-file-store-unavailable', ok: false };
  }, { logArgs: false });
  registerLoggedEvent(ipcMain, runtimeLogger, 'desktop-pet:set-settings-open', (_event, isOpen) => {
    windowManager.setSettingsOpen(Boolean(isOpen));
  }, { logArgs: false });

  registerLoggedEvent(ipcMain, runtimeLogger, 'desktop-pet:set-pointer-passthrough', (_event, ignore) => {
    windowManager.setPointerPassthrough(ignore);
  }, { logArgs: false });

  registerLoggedEvent(ipcMain, runtimeLogger, 'desktop-pet:set-interactive-regions', (_event, regions, options) => {
    windowManager.setInteractiveRegions(regions, options);
  }, { logArgs: false });

  registerLoggedEvent(ipcMain, runtimeLogger, 'desktop-pet:set-pet-drag-native-shape-active', (_event, active) => {
    windowManager.setPetDragNativeShapeActive(Boolean(active));
  }, { logArgs: false });

  registerLoggedEvent(ipcMain, runtimeLogger, 'desktop-pet:post-drag-input-proxy-event', (event, inputEvent) => {
    windowManager.forwardPostDragInputProxyEvent(event.sender, inputEvent);
  }, { logArgs: false, logLifecycle: false });

  registerLoggedEvent(ipcMain, runtimeLogger, 'desktop-pet:mark-main-window-ready-to-show', () => {
    windowManager.markMainWindowReadyToShow('renderer');
  }, { logArgs: false });

  registerLoggedEvent(ipcMain, runtimeLogger, 'desktop-pet:open-settings-window', () => {
    windowManager.openSettingsWindow();
  }, { logArgs: false });

  registerLoggedEvent(ipcMain, runtimeLogger, 'desktop-pet:close-settings-window', () => {
    windowManager.closeSettingsWindow();
  }, { logArgs: false });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:is-settings-window-open', () => {
    return windowManager.getIsSettingsWindowOpen();
  }, {
    logArgs: false,
    summarizeResult: (result) => ({ isOpen: Boolean(result) }),
  });

  registerLoggedEvent(ipcMain, runtimeLogger, 'desktop-pet:open-chat-window', () => {
    windowManager.openChatWindow();
  }, { logArgs: false });

  registerLoggedEvent(ipcMain, runtimeLogger, 'desktop-pet:close-chat-window', () => {
    windowManager.closeChatWindow();
  }, { logArgs: false });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:set-agent-desktop-execution-active', (_event, active) => {
    windowManager.setAgentDesktopExecutionActive(Boolean(active));
    return { active: Boolean(active) };
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:run-skill-sandbox-supervisor-probe', async (_event, request) => {
    return externalSkillSandboxSupervisorService.runBootstrapProbe(request ?? {});
  }, {
    summarizeResult: (result) => ({
      packageCodeLoaded: Boolean(result?.packageCodeLoaded),
      permissionRequests: result?.permissionRequests ?? 0,
      status: result?.status ?? 'unknown',
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:run-skill-sandbox-package', async (_event, request) => {
    return externalSkillCapabilityGateway.runPackageExecution(request ?? {});
  }, {
    summarizeResult: (result) => ({
      capabilityCalls: result?.capabilityFlow?.calls ?? 0,
      capabilityFlowStatus: result?.capabilityFlow?.status ?? null,
      executionKind: result?.executionKind ?? null,
      packageHealthStatus: result?.packageHealth?.status ?? null,
      packageQuarantined: Boolean(result?.packageHealth?.quarantineApplied),
      packageCodeLoaded: Boolean(result?.packageCodeLoaded),
      permissionRequests: result?.permissionRequests ?? 0,
      status: result?.status ?? 'unknown',
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:list-skill-capability-grants', () => {
    return externalSkillCapabilityGateway.listGrants();
  }, { logArgs: false });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:list-skill-capability-receipts', (_event, request) => {
    return externalSkillCapabilityGateway.listReceiptHistory(request ?? {});
  }, { logArgs: false });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:clear-skill-capability-receipts', (_event, request) => {
    return externalSkillCapabilityGateway.clearReceiptHistory(request ?? {});
  }, {
    summarizeResult: (result) => ({ ok: Boolean(result?.ok), removedCount: result?.removedCount ?? 0 }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:list-external-skill-package-health', (_event, request) => {
    return externalSkillCapabilityGateway.listPackageHealth(request ?? {});
  }, { logArgs: false });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:reset-external-skill-package-health', (_event, request) => {
    return externalSkillCapabilityGateway.resetPackageHealth(request ?? {});
  }, {
    summarizeResult: (result) => ({ ok: Boolean(result?.ok), reset: Boolean(result?.reset), error: result?.error ?? null }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:create-external-skill-release-admission-report', (_event, request) => {
    return externalSkillCapabilityGateway.createReleaseAdmissionReport(request ?? {});
  }, {
    logArgs: false,
    summarizeResult: (result) => ({
      blocked: result?.summary?.blocked ?? 0,
      eligible: result?.summary?.eligible ?? 0,
      ok: Boolean(result?.ok),
      reviewRequired: result?.summary?.['review-required'] ?? 0,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:export-external-skill-release-admission-report', (_event, request) => {
    return externalSkillCapabilityGateway.exportReleaseAdmissionReport(request ?? {});
  }, { logArgs: false });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:export-external-skill-package-health-diagnostics', (_event, request) => {
    return externalSkillCapabilityGateway.exportPackageHealthDiagnostics(request ?? {});
  }, { logArgs: false });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:get-external-skill-marketplace-production-readiness', () => {
    return externalSkillMarketplaceProductionReadinessService.createReport();
  }, {
    logArgs: false,
    summarizeResult: (result) => ({
      operationalConfigurationReady: Boolean(result?.operationalConfigurationReady),
      status: result?.status ?? 'unknown',
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:export-external-skill-marketplace-production-readiness', () => {
    return externalSkillMarketplaceProductionReadinessService.exportReport();
  }, { logArgs: false });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:set-skill-capability-grant', (_event, request) => {
    return externalSkillCapabilityGateway.setGrant(request ?? {});
  }, {
    summarizeResult: (result) => ({ ok: Boolean(result?.ok), error: result?.error ?? null }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:revoke-skill-capability-grant', (_event, request) => {
    return externalSkillCapabilityGateway.revokeGrant(request ?? {});
  }, {
    summarizeResult: (result) => ({ ok: Boolean(result?.ok), revoked: Boolean(result?.revoked) }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:decide-skill-capability-request', (_event, request) => {
    return externalSkillCapabilityGateway.decide(request ?? {});
  }, { logArgs: false });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:read-skill-capability-storage', (_event, request) => {
    return externalSkillCapabilityGateway.readStorageValue(request ?? {});
  }, { logArgs: false });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:cancel-skill-sandbox-supervisor-probe', (_event, request) => {
    return externalSkillCapabilityGateway.cancelExecution(request?.requestId);
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:stage-skill-package-artifact', (_event, request) => {
    return skillPackageSignedInstallCoordinator.stageSignedPackage(request ?? {});
  }, {
    logArgs: false,
    summarizeResult: (result) => ({
      artifactDigest: result?.package?.artifactDigest ?? null,
      ok: Boolean(result?.ok),
      replaced: Boolean(result?.replaced),
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:stage-signed-skill-package-archive', (_event, request) => {
    return externalSkillPackageArchiveInstallerService.stageSignedArchiveBase64(request ?? {});
  }, {
    logArgs: false,
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      packageId: result?.identity?.packageId ?? null,
      status: result?.status ?? 'rejected',
      version: result?.identity?.version ?? null,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:audit-skill-package-artifacts', (_event, request) => {
    return skillPackageArtifactStore.auditPackages(request ?? {});
  }, {
    logArgs: false,
    summarizeResult: (result) => ({ ok: Boolean(result?.ok), rows: result?.rows?.length ?? 0 }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:quarantine-skill-package-artifact', (_event, request) => {
    return skillPackageArtifactStore.quarantinePackage(request?.packageId, request?.reason);
  }, {
    logArgs: false,
    summarizeResult: (result) => ({ ok: Boolean(result?.ok), status: result?.package?.status ?? 'unknown' }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:restore-quarantined-external-skill-package', (_event, request) => {
    return externalSkillPackageLifecycleService.restoreQuarantinedPackage(request ?? {});
  }, {
    logArgs: false,
    summarizeResult: (result) => ({ ok: Boolean(result?.ok), error: result?.error ?? null }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:uninstall-external-skill-package', (_event, request) => {
    return externalSkillPackageLifecycleService.uninstallPackage(request ?? {});
  }, {
    logArgs: false,
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      snapshotId: result?.snapshot?.snapshotId ?? null,
      error: result?.error ?? null,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:rollback-external-skill-package-uninstall', (_event, request) => {
    return externalSkillPackageLifecycleService.rollbackUninstall(request ?? {});
  }, {
    logArgs: false,
    summarizeResult: (result) => ({ ok: Boolean(result?.ok), error: result?.error ?? null }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:list-external-skill-package-uninstall-snapshots', (_event, request) => {
    return externalSkillPackageLifecycleService.listUninstallSnapshots(request ?? {});
  }, {
    logArgs: false,
    summarizeResult: (result) => ({
      invalidSnapshotCount: result?.invalidSnapshotCount ?? 0,
      ok: Boolean(result?.ok),
      totalCount: result?.totalCount ?? 0,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:cleanup-external-skill-package-uninstall-snapshots', (_event, request) => {
    return externalSkillPackageLifecycleService.cleanupUninstallSnapshots(request ?? {});
  }, {
    logArgs: false,
    summarizeResult: (result) => ({
      deletedArtifactCount: result?.deletedArtifactCount ?? 0,
      ok: Boolean(result?.ok),
      removedSnapshotCount: result?.removedSnapshotCount ?? 0,
      status: result?.status ?? 'unknown',
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:list-external-skill-package-lifecycle-receipts', (_event, request) => {
    return externalSkillPackageLifecycleService.listReceipts(request ?? {});
  }, { logArgs: false });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:export-external-skill-package-lifecycle-receipts', (_event, request) => {
    return externalSkillPackageLifecycleService.exportReceipts(request ?? {});
  }, { logArgs: false });

  ipcMain.on('desktop-pet:set-current-window-bounds', (event, bounds) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    if (!targetWindow || targetWindow.isDestroyed() || !bounds || typeof bounds !== 'object') {
      return;
    }

    const nextX = Number(bounds.x);
    const nextY = Number(bounds.y);
    const nextWidth = Number(bounds.width);
    const nextHeight = Number(bounds.height);
    if (
      !Number.isFinite(nextX)
      || !Number.isFinite(nextY)
      || !Number.isFinite(nextWidth)
      || !Number.isFinite(nextHeight)
    ) {
      return;
    }

    const roundedWidth = Math.max(1, Math.round(nextWidth));
    const roundedHeight = Math.max(1, Math.round(nextHeight));
    const originalMinimumSize = currentWindowOriginalMinimumSize.get(targetWindow)
      ?? targetWindow.getMinimumSize();
    const needsCompactMinimumSize = (
      roundedWidth < originalMinimumSize[0]
      || roundedHeight < originalMinimumSize[1]
    );

    if (needsCompactMinimumSize) {
      if (!currentWindowOriginalMinimumSize.has(targetWindow)) {
        currentWindowOriginalMinimumSize.set(targetWindow, originalMinimumSize);
      }

      targetWindow[CURRENT_WINDOW_COMPACT_MINIMUM_SIZE_KEY] = true;
      targetWindow.setMinimumSize(
        Math.max(1, Math.min(roundedWidth, originalMinimumSize[0])),
        Math.max(1, Math.min(roundedHeight, originalMinimumSize[1])),
      );
    } else if (currentWindowOriginalMinimumSize.has(targetWindow)) {
      targetWindow.setMinimumSize(originalMinimumSize[0], originalMinimumSize[1]);
      currentWindowOriginalMinimumSize.delete(targetWindow);
      delete targetWindow[CURRENT_WINDOW_COMPACT_MINIMUM_SIZE_KEY];
    }

    targetWindow.setBounds({
      x: Math.round(nextX),
      y: Math.round(nextY),
      width: roundedWidth,
      height: roundedHeight,
    }, false);
  });

  ipcMain.on('desktop-pet:minimize-current-window', (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    if (!targetWindow || targetWindow.isDestroyed() || !targetWindow.isMinimizable()) {
      return;
    }

    targetWindow.minimize();
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:is-chat-window-open', () => {
    return windowManager.getIsChatWindowOpen();
  }, {
    logArgs: false,
    summarizeResult: (result) => ({ isOpen: Boolean(result) }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:pick-desktop-capture-area', async () => {
    return areaPickerService.openNativeAreaPickerWindow();
  }, {
    logArgs: false,
    summarizeResult: (result) => result ? 'picked' : 'cancelled',
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:get-area-picker-context', () => {
    return areaPickerService.getAreaPickerContext();
  }, {
    summarizeResult: (result) => result ? 'context-ready' : 'context-empty',
  });

  registerLoggedEvent(ipcMain, runtimeLogger, 'desktop-pet:submit-area-picker-selection', (_event, selection) => {
    areaPickerService.submitAreaPickerSelection(selection ?? null);
  });

  registerLoggedEvent(ipcMain, runtimeLogger, 'desktop-pet:cancel-area-picker-selection', () => {
    areaPickerService.cancelAreaPickerSelection();
  }, { logArgs: false });

  ipcMain.on('desktop-pet:sync-shared-state', (_event, nextState) => {
    const normalizedState = nextState ?? null;
    windowManager.setSharedState(normalizedState);
    // Keep the durable copy in the main process as well. This covers the
    // short window in which a renderer is closed before its async save runs.
    if (Array.isArray(normalizedState?.chatState?.messages)
      && normalizedState.chatState.messages.length > 0) {
      persistedChatHistoryStore?.save?.(normalizedState.chatState.messages);
    }
  });

  registerLoggedEvent(ipcMain, runtimeLogger, 'desktop-pet:publish-runtime-world-presentation-intent', (event, intent) => {
    windowManager.broadcastRuntimeWorldPresentationIntent(intent, event.sender.id);
  }, { logArgs: false });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:get-shared-state', () => {
    return windowManager.getSharedState();
  }, {
    logArgs: false,
    summarizeResult: () => 'shared-state',
  });

  ipcMain.on('desktop-pet:settings-action', (_event, action) => {
    if (action?.type !== 'set-chat-input') {
      logRuntime(runtimeLogger, 'IPC', `received desktop-pet:settings-action ${summarizeArgs([action])}`);
    }

    try {
      areaPickerService.syncPersistentAreaBorderFromSettingsAction(action);

      const mainWindow = windowManager.getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed()) {
        return;
      }

      mainWindow.webContents.send('desktop-pet:settings-action', action ?? null);

      if (action?.type !== 'set-chat-input') {
        logRuntime(runtimeLogger, 'IPC', 'forwarded desktop-pet:settings-action');
      }
    } catch (error) {
      logRuntime(runtimeLogger, 'IPC', 'failed desktop-pet:settings-action', error?.stack || error);
      throw error;
    }
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:list-displays', async () => {
    return captureService.getDisplayListWithNativeBounds();
  }, {
    logArgs: false,
    summarizeResult: (result) => ({ count: Array.isArray(result) ? result.length : 0 }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:get-system-info', async () => {
    return systemInfoService.getSystemInfo();
  }, {
    logArgs: false,
    summarizeResult: (result) => ({
      arch: result?.arch ?? '',
      cpu: result?.cpu?.model ?? '',
      memoryBytes: result?.memory?.totalBytes ?? 0,
      platform: result?.platform ?? '',
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:list-capture-sources', async (_event, request) => {
    return captureService.getCaptureSourceListWithOptions(request ?? {});
  }, {
    summarizeResult: (result) => ({ count: Array.isArray(result) ? result.length : 0 }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:list-desktop-icons', async (_event, options) => {
    return desktopIconService.listDesktopIcons(options ?? {});
  }, {
    summarizeResult: (result) => ({ count: Array.isArray(result) ? result.length : 0 }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:move-desktop-icon', async (_event, request) => {
    return desktopIconService.moveDesktopIcon(request ?? {});
  }, {
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      verified: Boolean(result?.verified),
      iconName: result?.icon?.name ?? null,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:launch-local-app', async (_event, request) => {
    return appLauncherService.launchLocalApp(request ?? {});
  }, {
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      appName: result?.app?.name ?? null,
      matchCount: Array.isArray(result?.matches) ? result.matches.length : 0,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:get-default-app-for-uri', async (_event, request) => {
    return appLauncherService.getDefaultAppForUri(request ?? {});
  }, {
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      appName: result?.appName ?? null,
      uriScheme: result?.uriScheme ?? null,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:list-running-apps', async (_event, request) => {
    return appLauncherService.listRunningApps(request ?? {});
  }, {
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      count: result?.count ?? 0,
      query: result?.query ?? '',
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:observe-windows-and-apps', async (_event, request) => {
    return appLauncherService.observeWindowsAndApps(request ?? {});
  }, {
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      installedCount: result?.installedCount ?? 0,
      pinnedCount: result?.taskbarPinnedCount ?? 0,
      runningCount: result?.runningCount ?? 0,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:inspect-window-ui', async (_event, request) => {
    return appLauncherService.inspectWindowUi(request ?? {});
  }, {
    summarizeResult: (result) => ({
      controlCount: Array.isArray(result?.controls) ? result.controls.length : 0,
      matchedCount: Array.isArray(result?.matchedControls) ? result.matchedControls.length : 0,
      ok: Boolean(result?.ok),
      processName: result?.window?.processName ?? null,
      query: result?.query ?? '',
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:invoke-window-ui', async (_event, request) => {
    return appLauncherService.invokeWindowUi(request ?? {});
  }, {
    summarizeResult: (result) => ({
      controlName: result?.control?.name ?? null,
      invoked: Boolean(result?.invoked),
      ok: Boolean(result?.ok),
      processName: result?.window?.processName ?? null,
      query: result?.query ?? '',
      uiAction: result?.resolvedAction ?? result?.uiAction ?? null,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:get-active-window-info', async () => {
    return appLauncherService.getActiveWindowInfo();
  }, {
    logArgs: false,
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      processName: result?.processName ?? null,
      title: result?.title ?? null,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:focus-window', async (_event, request) => {
    return appLauncherService.focusWindow(request ?? {});
  }, {
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      processName: result?.processName ?? null,
      query: result?.query ?? '',
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:move-window-to-display', async (_event, request) => {
    return appLauncherService.moveWindowToDisplay(request ?? {});
  }, {
    summarizeResult: (result) => ({
      moved: Boolean(result?.moved),
      ok: Boolean(result?.ok),
      processName: result?.processName ?? null,
      query: result?.query ?? '',
      targetDisplayId: result?.targetDisplayId ?? null,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:control-window', async (_event, request) => {
    return appLauncherService.controlWindow(request ?? {});
  }, {
    summarizeResult: (result) => ({
      controlled: Boolean(result?.controlled),
      ok: Boolean(result?.ok),
      processName: result?.processName ?? null,
      query: result?.query ?? '',
      requestedSnap: result?.requestedSnap ?? null,
      requestedState: result?.requestedState ?? null,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:close-window', async (_event, request) => {
    return appLauncherService.closeWindow(request ?? {});
  }, {
    summarizeResult: (result) => ({
      closed: Boolean(result?.closed),
      ok: Boolean(result?.ok),
      processName: result?.processName ?? null,
      query: result?.query ?? '',
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:open-resource', async (_event, request) => {
    return appLauncherService.openResource(request ?? {});
  }, {
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      resourceType: result?.resourceType ?? null,
      target: result?.target ? 'configured' : '',
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:execute-desktop-input', async (_event, request) => {
    return desktopInputService.executeDesktopInput(request ?? {});
  }, {
    summarizeResult: (result) => ({
      action: result?.action ?? null,
      ok: Boolean(result?.ok),
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:run-controlled-command', async (_event, request) => {
    return controlledCommandService.runControlledCommand(request ?? {});
  }, {
    summarizeResult: (result) => ({
      blocked: Boolean(result?.blocked),
      exitCode: result?.exitCode ?? null,
      ok: Boolean(result?.ok),
      shell: result?.shell ?? null,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:cancel-controlled-command', async (_event, request) => {
    return controlledCommandService.cancelControlledCommand(request ?? {});
  }, {
    summarizeResult: (result) => ({
      cancelled: Boolean(result?.cancelled),
      ok: Boolean(result?.ok),
      requestId: result?.requestId ? 'configured' : '',
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:list-mcp-tools', async (_event, request) => {
    return mcpStdioClientService.listTools(request ?? {});
  }, {
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      serverCount: Array.isArray(result?.servers) ? result.servers.length : 0,
      toolCount: Array.isArray(result?.tools) ? result.tools.length : 0,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:inspect-mcp-server', async (_event, request) => {
    return mcpServerDiagnosticsService.inspect(request ?? {});
  }, {
    summarizeResult: (result) => ({
      durationMs: result?.durationMs ?? 0,
      ok: Boolean(result?.ok),
      serverId: result?.serverId ?? '',
      stderr: Boolean(result?.stderrSnippet),
      toolCount: result?.toolCount ?? 0,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:preflight-mcp-server-environment', (_event, request) => {
    return mcpServerEnvironmentPreflightService.inspect(request ?? {});
  }, {
    logArgs: false,
    summarizeResult: (result) => ({
      checkCount: Array.isArray(result?.checks) ? result.checks.length : 0,
      ok: Boolean(result?.ok),
      status: result?.status ?? 'blocked',
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:call-mcp-tool', async (_event, request) => {
    return mcpStdioClientService.callTool(request ?? {});
  }, {
    summarizeResult: (result) => ({
      contentCount: Array.isArray(result?.content) ? result.content.length : 0,
      isError: Boolean(result?.isError),
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:cancel-mcp-tool-call', async (_event, request) => {
    return mcpStdioClientService.cancelToolCall(request ?? {});
  }, {
    summarizeResult: (result) => ({
      cancelled: Boolean(result?.cancelled),
      ok: Boolean(result?.ok),
      requestId: result?.requestId ? 'configured' : '',
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:get-mcp-session-status', async () => {
    return {
      ok: true,
      sessions: mcpStdioClientService.getSessionStatus(),
    };
  }, {
    logArgs: false,
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      sessionCount: Array.isArray(result?.sessions) ? result.sessions.length : 0,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:reset-mcp-session', async (_event, request) => {
    return mcpStdioClientService.resetSession(request ?? {});
  }, {
    summarizeResult: (result) => ({
      closedCount: result?.closedCount ?? 0,
      ok: Boolean(result?.ok),
      serverId: result?.serverId ?? '',
    }),
  });

  registerMcpHistoryIpcHandlers({
    ipcMain,
    mcpHistoryService,
    registerLoggedHandle,
    runtimeLogger,
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:load-mcp-config', async () => {
    return mcpConfigService.loadConfig();
  }, {
    logArgs: false,
    summarizeResult: (result) => ({
      exists: Boolean(result?.exists),
      ok: Boolean(result?.ok),
      path: result?.path ? 'configured' : '',
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:save-mcp-config', async (_event, request) => {
    return mcpConfigService.saveConfig(request ?? {});
  }, {
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      path: result?.path ? 'configured' : '',
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:get-mcp-soak-readiness', async (_event, request) => {
    return mcpSoakReadinessService.createReadinessReport(request ?? {});
  }, {
    summarizeResult: (result) => ({
      readyServers: result?.totals?.readyServers ?? 0,
      serverCount: result?.totals?.servers ?? 0,
      status: result?.status ?? '',
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:remember-local-app', async (_event, request) => {
    return appLauncherService.rememberLocalApp(request ?? {});
  }, {
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      appName: result?.app?.name ?? null,
      aliasCount: Array.isArray(result?.app?.aliases) ? result.app.aliases.length : 0,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:get-path-info', async (_event, request) => {
    return localFileSystemService.getPathInfo(request ?? {});
  }, {
    summarizeResult: (result) => ({
      exists: Boolean(result?.exists),
      kind: result?.kind ?? null,
      ok: Boolean(result?.ok),
      path: result?.path ? 'configured' : '',
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:list-directory', async (_event, request) => {
    return localFileSystemService.listDirectory(request ?? {});
  }, {
    summarizeResult: (result) => ({
      count: Array.isArray(result?.entries) ? result.entries.length : 0,
      ok: Boolean(result?.ok),
      path: result?.path ? 'configured' : '',
      truncated: Boolean(result?.truncated),
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:search-files', async (_event, request) => {
    return localFileSystemService.searchFiles(request ?? {});
  }, {
    summarizeResult: (result) => ({
      count: Array.isArray(result?.matches) ? result.matches.length : 0,
      ok: Boolean(result?.ok),
      path: result?.path ? 'configured' : '',
      query: result?.query ?? '',
      truncated: Boolean(result?.truncated),
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:read-text-file', async (_event, request) => {
    return localFileSystemService.readTextFile(request ?? {});
  }, {
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      path: result?.path ? 'configured' : '',
      textLength: typeof result?.text === 'string' ? result.text.length : 0,
      truncated: Boolean(result?.truncated),
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:read-file-data-url', async (_event, request) => {
    return localFileSystemService.readFileDataUrl(request ?? {});
  }, {
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      path: result?.path ? 'configured' : '',
      sizeBytes: result?.sizeBytes ?? 0,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:stage-2d-sequence', async (_event, request) => (
    sequenceAssetStore?.stage2DSequence?.(request ?? {})
      ?? { error: 'sequence-asset-store-unavailable', ok: false }
  ), {
    summarizeResult: (result) => ({ frameCount: result?.frameCount ?? 0, ok: Boolean(result?.ok) }),
  });
  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:choose-2d-video-folder', async () => {
    const selection = await dialog.showOpenDialog({ properties: ['openDirectory'], title: '选择道具交互视频文件夹' });
    if (selection.canceled || !selection.filePaths[0]) return { cancelled: true, ok: false };
    const inspected = sequenceAssetStore?.inspect2DVideoFolder?.({ folderPath: selection.filePaths[0] });
    if (!inspected) return { error: 'sequence-asset-store-unavailable', ok: false };
    const { videoPaths, ...result } = inspected;
    return result;
  }, {
    logArgs: false,
    summarizeResult: (result) => ({ ok: Boolean(result?.ok), videoCount: result?.videoCount ?? 0 }),
  });
  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:pick-2d-video-from-folder', async (_event, request) => (
    sequenceAssetStore?.pick2DVideoFromFolder?.(request ?? {})
      ?? { error: 'sequence-asset-store-unavailable', ok: false }
  ), {
    logArgs: false,
    summarizeResult: (result) => ({ ok: Boolean(result?.ok), videoCount: result?.videoCount ?? 0 }),
  });
  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:stage-2d-video', async (_event, request) => (
    sequenceAssetStore?.stage2DVideo?.(request ?? {})
      ?? { error: 'sequence-asset-store-unavailable', ok: false }
  ), {
    summarizeResult: (result) => ({ ok: Boolean(result?.ok), videoUrl: result?.videoUrl ? 'configured' : '' }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:execute-file-management-action', async (_event, request) => {
    return localFileSystemService.executeFileManagementAction(request ?? {}, { shell });
  }, {
    summarizeResult: (result) => ({
      action: result?.action ?? null,
      destinationPath: result?.destinationPath ? 'configured' : '',
      dryRun: Boolean(result?.dryRun),
      ok: Boolean(result?.ok),
      sourcePath: result?.sourcePath ? 'configured' : '',
      verified: Boolean(result?.verified),
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:inspect-local-project', async (_event, request) => {
    return localProjectInspectorService.inspectLocalProject(request ?? {});
  }, {
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      primaryType: result?.primaryType?.id ?? null,
      readFileCount: Array.isArray(result?.readFiles) ? result.readFiles.length : 0,
      suggestedActionCount: Array.isArray(result?.suggestedActions) ? result.suggestedActions.length : 0,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:run-local-project-action', async (_event, request) => {
    return localProjectInspectorService.runLocalProjectAction({
      ...(request ?? {}),
      shell,
    });
  }, {
    summarizeResult: (result) => ({
      actionKind: result?.action?.kind ?? null,
      command: result?.action?.command ?? null,
      ok: Boolean(result?.ok),
      pid: result?.pid ?? null,
    }),
  });

  ipcMain.handle('desktop-pet:get-cursor-screen-point', () => {
    if (!screen || typeof screen.getCursorScreenPoint !== 'function') {
      return null;
    }

    const point = screen.getCursorScreenPoint();
    return {
      coordinateSpace: 'dip',
      x: Math.round(Number(point?.x ?? 0)),
      y: Math.round(Number(point?.y ?? 0)),
      updatedAt: Date.now(),
    };
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:list-local-voice-assets', (_event, options) => {
    return localVoiceLibrary.getCatalog(options ?? {});
  }, {
    summarizeResult: (result) => ({
      tts: Array.isArray(result?.ttsModels) ? result.ttsModels.length : 0,
      stt: Array.isArray(result?.sttModels) ? result.sttModels.length : 0,
      refs: Array.isArray(result?.references) ? result.references.length : 0,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:get-local-voice-health', async (_event, settings) => {
    return localVoiceRuntime.getHealth(settings ?? {});
  }, {
    summarizeResult: (result) => ({
      status: result?.status ?? 'unknown',
      executable: result?.executable ?? null,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:warmup-local-voice', async (_event, settings) => {
    return localVoiceRuntime.warmup(settings ?? {});
  }, {
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      warmedModes: Array.isArray(result?.warmedModes) ? result.warmedModes.join(',') : '',
      referenceTextReady: Boolean(result?.referenceTextReady),
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:install-local-voice-dependencies', async (event, settings) => {
    return localVoiceRuntime.installDependencies(settings ?? {}, {
      onProgress: (progress) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('desktop-pet:local-voice-install-progress', progress ?? null);
        }
      },
    });
  }, {
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      executable: result?.executable ?? null,
      missingPackages: Array.isArray(result?.missingPackages) ? result.missingPackages.length : 0,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:synthesize-local-voice', async (_event, payload) => {
    return localVoiceRuntime.synthesize(payload ?? {});
  }, {
    summarizeResult: () => 'audio-ready',
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:cancel-local-voice-synthesis', async () => {
    return localVoiceRuntime.cancelSynthesis('renderer_request');
  }, {
    logArgs: false,
    summarizeResult: (result) => ({ canceled: Boolean(result) }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:transcribe-local-voice', async (_event, payload) => {
    return localVoiceRuntime.transcribe(payload ?? {});
  }, {
    summarizeResult: (result) => ({
      textLength: typeof result?.text === 'string' ? result.text.length : 0,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:get-display-environment', async (_event, options) => {
    return captureService.getDisplayEnvironment(options ?? {});
  }, {
    summarizeResult: () => 'display-environment',
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:get-unity-bridge-status', async () => {
    const bridgeStatus = unityBridgeService?.getStatus?.() ?? null;
    if (!bridgeStatus) {
      return null;
    }

    return {
      ...bridgeStatus,
      runtimeProcess: unityRuntimeProcessService?.getStatus?.() ?? null,
    };
  }, {
    logArgs: false,
    summarizeResult: (result) => ({
      connected: Boolean(result?.connected),
      listening: Boolean(result?.listening),
      port: result?.port ?? null,
      runtimeRunning: Boolean(result?.runtimeProcess?.running),
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:send-unity-bridge-command', async (_event, command) => {
    const normalizedCommand = command ?? null;
    const runtimeStartResult = normalizedCommand
      ? unityRuntimeProcessService?.ensureStarted?.(`command:${normalizedCommand.type ?? 'unknown'}`) ?? null
      : null;
    const bridgeResult = unityBridgeService?.sendCommand?.(normalizedCommand) ?? {
      connected: false,
      ok: false,
      queued: false,
    };

    return {
      ...bridgeResult,
      runtimeProcess: runtimeStartResult,
    };
  }, {
    summarizeResult: (result) => ({
      connected: Boolean(result?.connected),
      ok: Boolean(result?.ok),
      queued: Boolean(result?.queued),
      runtimeRunning: Boolean(result?.runtimeProcess?.running),
    }),
  });

  registerLoggedEvent(ipcMain, runtimeLogger, 'desktop-pet:update-activity-region', (_event, config) => {
    const { didDisplayChange } = captureService.updateActivityRegion(config);
    if (didDisplayChange) {
      windowManager.resizeWindowForSettings(windowManager.getShellSettingsOpen());
    }
  });

  ipcMain.on('desktop-pet:push-runtime-log', (_event, scope, message, details) => {
    if (typeof message !== 'string' || !message.trim()) {
      return;
    }

    runtimeLogger?.log('frontend', typeof scope === 'string' && scope.trim() ? scope : 'runtime', message.trim(), details);
  });

  ipcMain.handle('desktop-pet:get-runtime-logs', () => {
    return runtimeLogger?.getEntries?.() ?? [];
  });

  ipcMain.handle('desktop-pet:get-app-runtime-info', () => {
    return {
      ...(appUsageMetricsService?.getSnapshot?.() ?? {}),
      appVersion: app.getVersion(),
      buildId: buildInfo?.buildId ?? 'unidentified',
      builtAt: buildInfo?.builtAt ?? null,
    };
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:reset-user-data-and-relaunch', () => (
    clearDesktopPetUserDataAndRelaunch?.()
      ?? { error: 'reset-user-data-unavailable', ok: false }
  ), {
    logArgs: false,
    summarizeResult: (result) => ({ ok: Boolean(result?.ok) }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:detect-browser-search', async (_event, payload) => {
    const settings = payload?.settings && typeof payload.settings === 'object' ? payload.settings : {};
    return browserSearchService.detect(settings);
  }, {
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      browserLabel: result?.browserLabel ?? null,
      resolvedPath: result?.resolvedPath ? 'configured' : '',
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:browser-search', async (_event, payload) => {
    const query = typeof payload?.query === 'string' ? payload.query : '';
    const settings = payload?.settings && typeof payload.settings === 'object' ? payload.settings : {};
    return browserSearchService.search(query, settings);
  }, {
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      browserLabel: result?.browserLabel ?? null,
      textLength: typeof result?.text === 'string' ? result.text.length : 0,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:control-browser', async (_event, payload) => {
    const settings = payload?.settings && typeof payload.settings === 'object' ? payload.settings : {};
    return browserSearchService.control(payload ?? {}, settings);
  }, {
    summarizeResult: (result) => ({
      action: result?.action ?? null,
      browserLabel: result?.browserLabel ?? null,
      ok: Boolean(result?.ok),
      pageCount: result?.pageCount ?? null,
      textLength: typeof result?.text === 'string' ? result.text.length : 0,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:get-browser-tts-health', async (_event, settings) => {
    return browserTtsService.getHealth(settings ?? {});
  }, {
    summarizeResult: (result) => ({
      status: result?.status ?? 'unknown',
      running: Boolean(result?.running),
      url: result?.url ?? null,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:start-browser-tts-service', async (_event, settings) => {
    return browserTtsService.ensureStarted(settings ?? {});
  }, {
    summarizeResult: (result) => ({
      status: result?.status ?? 'unknown',
      running: Boolean(result?.running),
      started: Boolean(result?.started),
      url: result?.url ?? null,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:install-browser-tts-dependencies', async (event, settings) => {
    return browserTtsService.installDependencies(settings ?? {}, {
      onProgress: (progress) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('desktop-pet:browser-tts-install-progress', progress ?? null);
        }
      },
    });
  }, {
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      executable: result?.executable ?? null,
      missingPackages: Array.isArray(result?.missingPackages) ? result.missingPackages.length : 0,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:list-browser-tts-speakers', async (_event, settings) => {
    return browserTtsService.getSpeakers(settings ?? {});
  }, {
    summarizeResult: (result) => ({
      count: Array.isArray(result?.speakers) ? result.speakers.length : 0,
      engine: result?.engine ?? null,
    }),
  });

  ipcMain.on('desktop-pet:load-persisted-config-sync', (event) => {
    logRuntime(runtimeLogger, 'IPC', 'received desktop-pet:load-persisted-config-sync');

    try {
      const result = persistedConfigStore?.load?.() ?? {
        ok: false,
        source: 'unavailable',
        error: 'persisted config store unavailable',
      };
      event.returnValue = result;
      logRuntime(runtimeLogger, 'IPC', 'completed desktop-pet:load-persisted-config-sync', {
        ok: Boolean(result?.ok),
        source: result?.source ?? 'unknown',
      });
    } catch (error) {
      const message = error?.stack || error;
      event.returnValue = {
        ok: false,
        source: 'error',
        error: String(error instanceof Error ? error.message : error),
      };
      logRuntime(runtimeLogger, 'IPC', 'failed desktop-pet:load-persisted-config-sync', message);
    }
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:save-persisted-config', async (_event, config) => {
    const saveTask = persistedConfigSaveQueue.then(() => new Promise((resolve, reject) => {
      setImmediate(() => {
        try {
          resolve(persistedConfigStore?.save?.(config ?? null) ?? {
            ok: false,
            source: 'unavailable',
            error: 'persisted config store unavailable',
          });
        } catch (error) {
          reject(error);
        }
      });
    }));

    persistedConfigSaveQueue = saveTask.then(
      () => undefined,
      () => undefined,
    );
    return saveTask;
  }, {
    logArgs: false,
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      backupMode: result?.backupMode ?? 'unknown',
      bytes: result?.bytes ?? 0,
    }),
  });
}

module.exports = {
  registerDesktopPetIpcHandlers,
};
