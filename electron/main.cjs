const {
  app,
  desktopCapturer,
  dialog,
  ipcMain,
  session,
  screen,
  shell,
} = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { createAppLauncherService } = require('./appLauncherService.cjs');
const { createAppUsageMetricsService } = require('./appUsageMetricsService.cjs');
const { createBrowserTtsService } = require('./browserTtsService.cjs');
const { CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE, createCaptureService } = require('./captureService.cjs');
const { createAreaPickerService } = require('./areaPickerService.cjs');
const { createBrowserSearchService } = require('./browserSearchService.cjs');
const { createControlledCommandService } = require('./controlledCommandService.cjs');
const { createDesktopIconService } = require('./desktopIconService.cjs');
const { createDesktopInputService } = require('./desktopInputService.cjs');
const { createExpressionLibraryService } = require('./expressionLibraryService.cjs');
const { registerExpressionLibraryIpcHandlers } = require('./expressionLibraryIpcHandlers.cjs');
const { createSystemExpressionCatalogService } = require('./systemExpressionCatalog.cjs');
const { createExternalSkillSandboxSupervisorService } = require('./externalSkillSandboxSupervisorService.cjs');
const { createExternalSkillCapabilityGateway } = require('./externalSkillCapabilityGateway.cjs');
const {
  createExternalSkillMarketplacePublisherCatalogDeliveryService,
} = require('./externalSkillMarketplacePublisherCatalogDeliveryService.cjs');
const {
  createExternalSkillMarketplacePublisherCatalogService,
} = require('./externalSkillMarketplacePublisherCatalogService.cjs');
const {
  createExternalSkillMarketplacePublisherIdentityService,
} = require('./externalSkillMarketplacePublisherIdentityService.cjs');
const {
  createExternalSkillMarketplaceProductionReadinessService,
} = require('./externalSkillMarketplaceProductionReadinessService.cjs');
const {
  isExternalSkillMarketplaceProductionProbeEnabled,
  runExternalSkillMarketplaceProductionProbe,
} = require('./externalSkillMarketplaceProductionProbe.cjs');
const {
  applyExternalSkillMarketplaceProductionProbeArgs,
} = require('./externalSkillMarketplaceProductionProbeArgs.cjs');
const {
  resolveExternalSkillMarketplaceProductionConfigPaths,
} = require('./externalSkillMarketplaceProductionConfigPaths.cjs');
const { applyExternalSkillPackagedDiagnosticArgs } = require('./externalSkillPackagedDiagnosticArgs.cjs');
const { createExternalSkillPackageLifecycleService } = require('./externalSkillPackageLifecycleService.cjs');
const {
  createExternalSkillPackageArchiveInstallerService,
} = require('./externalSkillPackageArchiveInstallerService.cjs');
const {
  isExternalSkillPackagedAdmissionProbeEnabled,
  runExternalSkillPackagedAdmissionProbe,
} = require('./externalSkillPackagedAdmissionProbe.cjs');
const { registerDesktopPetIpcHandlers } = require('./ipcHandlers.cjs');
const { createSkillPackageArtifactStore } = require('./skillPackageArtifactStore.cjs');
const { createSkillPackageSignedInstallCoordinator } = require('./skillPackageSignedInstallCoordinator.cjs');
const { createLocalFileSystemService } = require('./localFileSystemService.cjs');
const { createSequenceAssetStore } = require('./sequenceAssetStore.cjs');
const { resolveModelAssetRoot, MODEL_ASSET_DIRECTORY_NAME, LEGACY_MODEL_ASSET_DIRECTORY_NAME } = require('./modelAssetRoot.cjs');
const { createLocalProjectInspectorService } = require('./localProjectInspectorService.cjs');
const { registerLocalModelProtocol } = require('./localModelProtocol.cjs');
const { createLocalVoiceLibrary } = require('./localVoiceLibrary.cjs');
const { createLocalVoiceRuntime } = require('./localVoiceRuntime.cjs');
const { createDeepSeekHarnessRuntimeService } = require('./deepseekHarnessRuntimeService.cjs');
const { createMcpConfigService } = require('./mcpConfigService.cjs');
const { MCP_HISTORY_FILE_NAME, createMcpHistoryService } = require('./mcpHistoryService.cjs');
const { applyMcpPackagedDiagnosticArgs } = require('./mcpPackagedDiagnosticArgs.cjs');
const { writePackagedMcpBootMarker } = require('./mcpPackagedRuntimeDiagnostic.cjs');
const { installPackagedQuitTrace } = require('./packagedQuitTrace.cjs');
const { schedulePackagedSoakAutoQuit } = require('./packagedSoakAutoQuit.cjs');
const {
  isMcpPackagedReadOnlyCallProbeEnabled,
  runMcpPackagedReadOnlyCallProbe,
  scheduleMcpPackagedReadOnlyCallProbe,
} = require('./mcpPackagedReadOnlyCallProbe.cjs');
const { createMcpServerHealthService } = require('./mcpServerHealthService.cjs');
const { createMcpServerDiagnosticsService } = require('./mcpServerDiagnosticsService.cjs');
const { createMcpServerEnvironmentPreflightService } = require('./mcpServerEnvironmentPreflightService.cjs');
const { createMcpSoakReadinessService } = require('./mcpSoakReadinessService.cjs');
const { createMcpStdioClientService } = require('./mcpStdioClientService.cjs');
const { createPersistedConfigStore } = require('./persistedConfigStore.cjs');
const { createPersistedChatHistoryStore } = require('./persistedChatHistoryStore.cjs');
const { createNeuralPersonaFileStore } = require('./neuralPersonaFileStore.cjs');
const {
  applyNeuralPersonaPackagedProbeArgs,
  isNeuralPersonaPackagedProbeEnabled,
  runNeuralPersonaPackagedPersistenceProbe,
} = require('./neuralPersonaPackagedPersistenceProbe.cjs');
const { createRuntimeLogger } = require('./runtimeLogger.cjs');
const { createSystemInfoService } = require('./systemInfoService.cjs');
const { createUnityBridgeService } = require('./unityBridgeService.cjs');
const { createUnityRuntimeProcessService } = require('./unityRuntimeProcessService.cjs');
const { createWindowManager } = require('./windowManager.cjs');

applyMcpPackagedDiagnosticArgs(process.env, process.argv);
applyExternalSkillPackagedDiagnosticArgs(process.env, process.argv);
applyNeuralPersonaPackagedProbeArgs(process.env, process.argv);
applyExternalSkillMarketplaceProductionProbeArgs(process.env, process.argv);

const appProcessStartedAt = Date.now();

const shouldUseWindowsTransparentOverlayCompatibility = process.platform === 'win32'
  && process.env.DESKTOP_PET_ENABLE_TRANSPARENT_OVERLAY_COMPAT === '1'
  && process.env.DESKTOP_PET_DISABLE_TRANSPARENT_OVERLAY_COMPAT !== '1';
if (
  process.platform === 'win32'
  && (
    shouldUseWindowsTransparentOverlayCompatibility
    || process.env.DESKTOP_PET_FORCE_DISABLE_GPU_COMPOSITING === '1'
  )
) {
  // Explicit fallback for Windows layered transparent overlays over browser video.
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('disable-direct-composition');
}

const isLocalTest = process.env.DESKTOP_PET_LOCAL_TEST === '1';
const shouldClearRendererStartupCodeCache = process.env.DESKTOP_PET_CLEAR_RENDERER_CODE_CACHE === '1';
const shouldAutoOpenSettingsInLocalTest = isLocalTest && process.env.DESKTOP_PET_LOCAL_TEST_OPEN_SETTINGS === '1';
// Drag tracing is opt-in because its synchronous runtime log is too expensive
// for a high-frequency pointer stream.
const dragDiagnosticsEnabled = process.env.DESKTOP_PET_DRAG_DIAGNOSTICS === '1'
  || process.argv.includes('--drag-diagnostics');
const runtimeLogDirOverride = (process.env.DESKTOP_PET_RUNTIME_LOG_DIR || '').trim();
const live2DDragProbeEnabled = process.env.DESKTOP_PET_LIVE2D_DRAG_PROBE === '1'
  || process.argv.includes('--live2d-drag-probe');
const localTestConfigPath = isLocalTest
  ? (process.env.DESKTOP_PET_LOCAL_TEST_CONFIG_PATH || '').trim()
  : '';
const localTestDebugModelPath = isLocalTest
  ? (process.env.DESKTOP_PET_LOCAL_TEST_DEBUG_MODEL_PATH || '').trim()
  : '';
const captureMainWindowPathOverride = (process.env.DESKTOP_PET_CAPTURE_MAIN_WINDOW_PATH || '').trim();
const captureMainWindowPath = isLocalTest
  ? ((process.env.DESKTOP_PET_LOCAL_TEST_CAPTURE_MAIN_WINDOW_PATH || '').trim() || captureMainWindowPathOverride)
  : captureMainWindowPathOverride;
const packagedProfileRoot = !isLocalTest && app.isPackaged
  ? (
    process.env.DESKTOP_PET_SKILL_PACKAGED_ADMISSION_USER_DATA_DIR
    || process.env.DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_USER_DATA_DIR
    || process.env.DESKTOP_PET_NEURAL_PERSONA_PROBE_USER_DATA_DIR
    || process.env.DESKTOP_PET_PACKAGED_USER_DATA_DIR
    || ''
  ).trim()
  : '';
const runtimeLogRoot = isLocalTest
  ? (runtimeLogDirOverride || process.env.DESKTOP_PET_LOCAL_TEST_LOG_DIR || path.join(__dirname, '..', '.desktop-test-runtime'))
  : (
    runtimeLogDirOverride
    || (packagedProfileRoot
      ? path.join(path.resolve(packagedProfileRoot), 'runtime-logs')
      : (dragDiagnosticsEnabled || live2DDragProbeEnabled
        ? path.join(
          app.getPath('userData'),
          live2DDragProbeEnabled ? 'live2d-drag-probe' : 'drag-diagnostics-v2',
        )
        : null))
  );
const localTestProfileRoot = isLocalTest
  ? (process.env.DESKTOP_PET_LOCAL_TEST_PROFILE_DIR || path.join(__dirname, '..', '.desktop-test-profile'))
  : null;
if (runtimeLogRoot) {
  app.commandLine.appendSwitch('enable-logging');
  app.commandLine.appendSwitch(
    'log-file',
    path.join(runtimeLogRoot, isLocalTest ? 'electron-local-test.log' : 'electron-main.log'),
  );
}
if (isLocalTest) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-http-cache');
  app.commandLine.appendSwitch('disk-cache-size', '1');
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,NetworkServiceSandbox');
  app.commandLine.appendSwitch('enable-features', 'NetworkServiceInProcess');
  app.setPath('userData', localTestProfileRoot);
  app.setPath('crashDumps', path.join(localTestProfileRoot, 'crashDumps'));
}
if (packagedProfileRoot) {
  app.setPath('userData', path.resolve(packagedProfileRoot));
  app.setPath('crashDumps', path.join(path.resolve(packagedProfileRoot), 'crashDumps'));
}

const isDev = !app.isPackaged && !isLocalTest;
const shouldRunPackagedReadOnlyHeadlessProbe = !isDev
  && !isLocalTest
  && isMcpPackagedReadOnlyCallProbeEnabled(process.env)
  && process.env.DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_HEADLESS === '1';
const shouldRunPackagedExternalSkillAdmissionProbe = !isDev
  && !isLocalTest
  && isExternalSkillPackagedAdmissionProbeEnabled(process.env)
  && process.env.DESKTOP_PET_SKILL_PACKAGED_ADMISSION_HEADLESS === '1';
const shouldRunPackagedMarketplaceProductionProbe = !isDev
  && !isLocalTest
  && isExternalSkillMarketplaceProductionProbeEnabled(process.env)
  && process.env.DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_HEADLESS === '1';
const shouldRunNeuralPersonaPackagedProbe = !isDev
  && !isLocalTest
  && isNeuralPersonaPackagedProbeEnabled(process.env);
writePackagedMcpBootMarker({
  appIsPackaged: app.isPackaged,
  env: process.env,
  headlessProbeRequested: shouldRunPackagedReadOnlyHeadlessProbe,
  isDev,
  isLocalTest,
});
let appIsQuitting = false;
const runtimeLogPath = runtimeLogRoot
  ? path.join(runtimeLogRoot, isLocalTest ? 'local-test-main.log' : 'desktop-pet-main.log')
  : null;
const localTestSessionPartition = isLocalTest ? 'desktop-pet-local-test' : null;
const BUILD_INFO_FILE_PATH = path.join(__dirname, '..', 'build-info.json');

function loadBuildInfo() {
  try {
    const parsed = JSON.parse(fs.readFileSync(BUILD_INFO_FILE_PATH, 'utf8'));
    return {
      buildId: typeof parsed?.buildId === 'string' && parsed.buildId.trim()
        ? parsed.buildId.trim()
        : 'unidentified',
      builtAt: typeof parsed?.builtAt === 'string' && parsed.builtAt.trim()
        ? parsed.builtAt.trim()
        : null,
    };
  } catch {
    return { buildId: isDev ? 'development' : 'unidentified', builtAt: null };
  }
}

const buildInfo = loadBuildInfo();
const importedModelAssetRoot = resolveModelAssetRoot({
  isPackaged: app.isPackaged,
  execPath: process.execPath,
  projectRoot: path.join(__dirname, '..'),
});

function cleanupPriorResetDirectories() {
  const userDataPath = path.resolve(app.getPath('userData'));
  const parentPath = path.dirname(userDataPath);
  const sequenceAssetPath = path.join(
    importedModelAssetRoot,
    MODEL_ASSET_DIRECTORY_NAME,
  );
  const resetPrefixesByParentPath = new Map([
    [parentPath, [`${path.basename(userDataPath)}.reset-`]],
    [path.dirname(sequenceAssetPath), [`${path.basename(sequenceAssetPath)}.reset-`, `${LEGACY_MODEL_ASSET_DIRECTORY_NAME}.reset-`]],
  ]);
  try {
    resetPrefixesByParentPath.forEach((prefixes, directoryPath) => {
      fs.readdirSync(directoryPath, { withFileTypes: true })
        .filter((entry) => prefixes.some((prefix) => entry.name.startsWith(prefix)))
        .forEach((entry) => fs.rmSync(path.join(directoryPath, entry.name), { force: true, recursive: true }));
    });
  } catch {
    // A stale reset directory is harmless; retry next time the app starts.
  }
}

cleanupPriorResetDirectories();

function clearDesktopPetUserDataAndRelaunch() {
  const userDataPath = path.resolve(app.getPath('userData'));
  const parentPath = path.dirname(userDataPath);
  const directoryName = path.basename(userDataPath);
  if (!directoryName || userDataPath === parentPath) {
    throw new Error('Refused to clear an invalid application data directory.');
  }

  const resetToken = Date.now();
  const sequenceAssetPath = path.join(
    importedModelAssetRoot,
    MODEL_ASSET_DIRECTORY_NAME,
  );
  const moveToResetPath = (sourcePath) => {
    if (!fs.existsSync(sourcePath)) return;
    fs.renameSync(sourcePath, path.join(path.dirname(sourcePath), `${path.basename(sourcePath)}.reset-${resetToken}`));
  };

  moveToResetPath(userDataPath);
  moveToResetPath(sequenceAssetPath);
  moveToResetPath(path.join(importedModelAssetRoot, LEGACY_MODEL_ASSET_DIRECTORY_NAME));

  app.relaunch({ args: process.argv.slice(1) });
  app.exit(0);
  return { ok: true };
}

function extractLocalTestConfigPayload(rawConfigText) {
  const parsedValue = JSON.parse(rawConfigText);
  if (
    parsedValue
    && typeof parsedValue === 'object'
    && !Array.isArray(parsedValue)
    && parsedValue.config
    && typeof parsedValue.config === 'object'
    && !Array.isArray(parsedValue.config)
  ) {
    return parsedValue.config;
  }

  return parsedValue;
}

function appendRuntimeLog(message) {
  if (!runtimeLogPath) {
    return;
  }

  try {
    fs.mkdirSync(path.dirname(runtimeLogPath), { recursive: true });
    fs.appendFileSync(runtimeLogPath, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // Ignore runtime logging errors.
  }
}

const runtimeLogger = createRuntimeLogger({
  persist: appendRuntimeLog,
});
installPackagedQuitTrace({
  app,
  isDev,
  isLocalTest,
  log: (message, details) => runtimeLogger.log('backend', 'main-process', message, details),
});
const persistedConfigStore = createPersistedConfigStore({
  assetRootPath: importedModelAssetRoot,
  userDataPath: app.getPath('userData'),
  log: (message, details) => runtimeLogger.log('backend', 'config', message, details),
});
const persistedChatHistoryStore = createPersistedChatHistoryStore({
  userDataPath: app.getPath('userData'),
  log: (message, details) => runtimeLogger.log('backend', 'chat-history', message, details),
});
const neuralPersonaFileStore = createNeuralPersonaFileStore({
  userDataPath: app.getPath('userData'),
  log: (message, details) => runtimeLogger.log('backend', 'neural-persona', message, details),
});

async function clearRendererStartupCodeCaches(activeSession) {
  if (!shouldClearRendererStartupCodeCache) {
    runtimeLogger.log('backend', 'cache', 'renderer code cache retained for startup');
    return;
  }

  if (!activeSession || typeof activeSession.clearCodeCaches !== 'function') {
    runtimeLogger.log('backend', 'cache', 'renderer code cache clear skipped: unavailable');
    return;
  }

  try {
    await activeSession.clearCodeCaches({ urls: [] });
    runtimeLogger.log('backend', 'cache', 'renderer code cache cleared before window load');
  } catch (error) {
    runtimeLogger.log('backend', 'cache', 'renderer code cache clear failed', error?.stack || error);
  }
}

process.on('uncaughtException', (error) => {
  runtimeLogger.log('backend', 'error', 'uncaughtException', error?.stack || error);
});

process.on('unhandledRejection', (reason) => {
  runtimeLogger.log('backend', 'error', 'unhandledRejection', reason?.stack || reason);
});

runtimeLogger.log(
  'backend',
  'main-process',
  'bootstrap',
  {
    isLocalTest,
    isDev,
    cwd: process.cwd(),
    runtimeLogPath,
    userData: isLocalTest || packagedProfileRoot ? app.getPath('userData') : 'default',
    live2DDragProbeEnabled,
    live2DDragProbeEnv: process.env.DESKTOP_PET_LIVE2D_DRAG_PROBE || '',
    live2DDragProbeArg: process.argv.includes('--live2d-drag-probe'),
    localTestDebugModelPath,
    localTestConfigPath,
    captureMainWindowPath,
    mcpPackagedProductionRunId: process.env.DESKTOP_PET_MCP_PACKAGED_PRODUCTION_RUN_ID || '',
  },
);
runtimeLogger.log('backend', 'config', 'persisted config store ready', persistedConfigStore.getPaths());
runtimeLogger.log('backend', 'chat-history', 'persisted chat history store ready', persistedChatHistoryStore.getPaths());
runtimeLogger.log('backend', 'neural-persona', 'file store ready', neuralPersonaFileStore.getPaths());
if (isLocalTest) {
  runtimeLogger.log(
    'backend',
    'main-process',
    `local-test debug-model-path=${localTestDebugModelPath || '<empty>'} config-path=${localTestConfigPath || '<empty>'} capture-path=${captureMainWindowPath || '<empty>'}`,
  );
}

function loadRenderer(win, query = { desktop: '1' }) {
  const encodedDebugModelPath = localTestDebugModelPath
    ? Buffer.from(localTestDebugModelPath, 'utf8').toString('base64')
    : '';
  const nextQuery = {
    ...query,
    ...(encodedDebugModelPath ? { debugModelPathBase64: encodedDebugModelPath } : {}),
    ...(live2DDragProbeEnabled ? { live2dDragProbe: '1' } : {}),
  };

  if (isDev) {
    const searchParams = new URLSearchParams(nextQuery);
    win.loadURL(`http://127.0.0.1:3000/?${searchParams.toString()}`);
    return;
  }

  const fileUrl = pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html'));
  fileUrl.search = new URLSearchParams(nextQuery).toString();
  win.loadURL(fileUrl.toString());
}

const captureService = createCaptureService();
const browserSearchService = createBrowserSearchService({
  app,
  log: (message, details) => runtimeLogger.log('backend', 'browser-search', message, details),
});
const browserTtsService = createBrowserTtsService({
  app,
  log: (message, details) => runtimeLogger.log('backend', 'browser-tts', message, details),
  projectRoot: path.join(__dirname, '..'),
});
const appLauncherService = createAppLauncherService({
  app,
  log: (message, details) => runtimeLogger.log('backend', 'app-launcher', message, details),
  screen,
});
const controlledCommandService = createControlledCommandService({
  app,
  log: (message, details) => runtimeLogger.log('backend', 'controlled-command', message, details),
});
const desktopInputService = createDesktopInputService({
  log: (message, details) => runtimeLogger.log('backend', 'desktop-input', message, details),
  screen,
});
const skillPackageArtifactStore = createSkillPackageArtifactStore({
  log: (message, details) => runtimeLogger.log('backend', 'skill-package-artifacts', message, details),
  userDataPath: app.getPath('userData'),
});
const externalSkillMarketplaceProductionConfig =
  resolveExternalSkillMarketplaceProductionConfigPaths({ resourcesPath: process.resourcesPath });
const externalSkillSandboxSupervisorService = createExternalSkillSandboxSupervisorService({
  artifactStore: skillPackageArtifactStore,
  log: (message, details) => runtimeLogger.log('backend', 'skill-sandbox', message, details),
});
const externalSkillMarketplacePublisherCatalogService =
  createExternalSkillMarketplacePublisherCatalogService({
    log: (message, details) => runtimeLogger.log('backend', 'skill-marketplace-catalog', message, details),
    rootKeyRegistryPath: externalSkillMarketplaceProductionConfig.rootKeyRegistryPath,
    userDataPath: app.getPath('userData'),
  });
const externalSkillMarketplacePublisherIdentityService =
  createExternalSkillMarketplacePublisherIdentityService({
    catalogService: externalSkillMarketplacePublisherCatalogService,
    log: (message, details) => runtimeLogger.log('backend', 'skill-marketplace-identity', message, details),
    userDataPath: app.getPath('userData'),
  });
const externalSkillCapabilityGateway = createExternalSkillCapabilityGateway({
  artifactStore: skillPackageArtifactStore,
  hostContext: {
    arch: process.arch,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    packaged: app.isPackaged,
    platform: process.platform,
  },
  log: (message, details) => runtimeLogger.log('backend', 'skill-capability', message, details),
  marketplacePublisherIdentityService: externalSkillMarketplacePublisherIdentityService,
  supervisor: externalSkillSandboxSupervisorService,
  userDataPath: app.getPath('userData'),
});
const externalSkillMarketplacePublisherCatalogDeliveryService =
  createExternalSkillMarketplacePublisherCatalogDeliveryService({
    catalogService: externalSkillMarketplacePublisherCatalogService,
    configPath: externalSkillMarketplaceProductionConfig.deliveryConfigPath,
    log: (message, details) => runtimeLogger.log('backend', 'skill-marketplace-catalog', message, details),
    userDataPath: app.getPath('userData'),
  });
const externalSkillMarketplaceProductionReadinessService =
  createExternalSkillMarketplaceProductionReadinessService({
    catalogService: externalSkillMarketplacePublisherCatalogService,
    configSource: externalSkillMarketplaceProductionConfig.configSource,
    deliveryService: externalSkillMarketplacePublisherCatalogDeliveryService,
  });
const skillPackageSignedInstallCoordinator = createSkillPackageSignedInstallCoordinator({
  artifactStore: skillPackageArtifactStore,
  log: (message, details) => runtimeLogger.log('backend', 'skill-package-security', message, details),
  userDataPath: app.getPath('userData'),
});
const externalSkillPackageArchiveInstallerService = createExternalSkillPackageArchiveInstallerService({
  artifactStore: skillPackageArtifactStore,
  log: (message, details) => runtimeLogger.log('backend', 'skill-package-archive', message, details),
  signedInstallCoordinator: skillPackageSignedInstallCoordinator,
});
const externalSkillPackageLifecycleService = createExternalSkillPackageLifecycleService({
  artifactStore: skillPackageArtifactStore,
  capabilityGateway: externalSkillCapabilityGateway,
  log: (message, details) => runtimeLogger.log('backend', 'skill-package-lifecycle', message, details),
  signedInstallCoordinator: skillPackageSignedInstallCoordinator,
  userDataPath: app.getPath('userData'),
});
const desktopIconService = createDesktopIconService({
  app,
  log: (message, details) => runtimeLogger.log('backend', 'desktop-icons', message, details),
  screen,
});
const systemInfoService = createSystemInfoService({
  app,
});
const localProjectInspectorService = createLocalProjectInspectorService({
  log: (message, details) => runtimeLogger.log('backend', 'local-project', message, details),
});
const appUsageMetricsService = createAppUsageMetricsService({
  startedAt: appProcessStartedAt,
  storageDirectory: app.getPath('userData'),
});
const localFileSystemService = createLocalFileSystemService({
  log: (message, details) => runtimeLogger.log('backend', 'local-files', message, details),
});
const sequenceAssetStore = createSequenceAssetStore({
  assetRootPath: importedModelAssetRoot,
  log: (message, details) => runtimeLogger.log('backend', 'sequence-assets', message, details),
});
const expressionLibraryApplicationDirectory = process.env.PORTABLE_EXECUTABLE_DIR
  ? path.resolve(process.env.PORTABLE_EXECUTABLE_DIR)
  : process.env.PORTABLE_EXECUTABLE_FILE
    ? path.dirname(path.resolve(process.env.PORTABLE_EXECUTABLE_FILE))
    : app.isPackaged && process.execPath
      ? path.dirname(process.execPath)
      : path.join(__dirname, '..');
const expressionLibraryService = createExpressionLibraryService({
  managedRootPath: path.join(expressionLibraryApplicationDirectory, '表情包'),
  userDataPath: app.getPath('userData'),
});
const systemExpressionCatalogService = createSystemExpressionCatalogService({ appPath: app.getAppPath() });
const localVoiceLibrary = createLocalVoiceLibrary({
  app,
  projectRoot: path.join(__dirname, '..'),
});
const localVoiceRuntime = createLocalVoiceRuntime({
  app,
  log: (message) => runtimeLogger.log('backend', 'voice', message),
  localVoiceLibrary,
  projectRoot: path.join(__dirname, '..'),
});
const deepseekHarnessRuntimeService = createDeepSeekHarnessRuntimeService({
  localFileSystemService,
  log: (message, details) => runtimeLogger.log('backend', 'deepseek-harness', message, details),
  runnerRoot: path.join(app.getPath('userData'), 'deepseek-harness-runtime'),
});
const mcpHistoryService = createMcpHistoryService({
  log: (message, details) => runtimeLogger.log('backend', 'mcp-history', message, details),
  storagePath: path.join(app.getPath('userData'), MCP_HISTORY_FILE_NAME),
});
const mcpServerHealthService = createMcpServerHealthService();
const mcpStdioClientService = createMcpStdioClientService({
  health: mcpServerHealthService,
  history: mcpHistoryService,
  idleSessionTimeoutMs: 300_000,
  log: (message, details) => runtimeLogger.log('backend', 'mcp', message, details),
  projectRoot: path.join(__dirname, '..'),
  reuseSessions: true,
});
const mcpConfigService = createMcpConfigService({
  log: (message, details) => runtimeLogger.log('backend', 'mcp-config', message, details),
  onSaved: () => {
    const resetCount = mcpServerHealthService.resetAll();
    const disposedSessions = mcpStdioClientService.dispose('config-save');
    runtimeLogger.log('backend', 'mcp', 'reset MCP state after config save', {
      disposedSessions,
      resetCount,
    });
  },
  projectRoot: path.join(__dirname, '..'),
});
const mcpServerDiagnosticsService = createMcpServerDiagnosticsService({
  health: mcpServerHealthService,
  history: mcpHistoryService,
  log: (message, details) => runtimeLogger.log('backend', 'mcp-diagnostics', message, details),
  projectRoot: path.join(__dirname, '..'),
});
const mcpServerEnvironmentPreflightService = createMcpServerEnvironmentPreflightService({
  projectRoot: path.join(__dirname, '..'),
});
const mcpSoakReadinessService = createMcpSoakReadinessService({
  projectRoot: path.join(__dirname, '..'),
});
const unityRuntimeProcessService = createUnityRuntimeProcessService({
  app,
  log: (message, details) => runtimeLogger.log('backend', 'unity-runtime', message, details),
  projectRoot: path.join(__dirname, '..'),
});
let areaPickerServiceInstance = null;
const areaPickerServiceRef = {
  getAreaPickerWindow: () => areaPickerServiceInstance?.getAreaPickerWindow?.() ?? null,
  getPersistentAreaBorderWindow: () => areaPickerServiceInstance?.getPersistentAreaBorderWindow?.() ?? null,
  refreshPersistentAreaBorder: () => {
    areaPickerServiceInstance?.refreshPersistentAreaBorder?.();
  },
};

const windowManager = createWindowManager({
  areaPickerService: areaPickerServiceRef,
  captureService,
  isDev,
  log: (message) => runtimeLogger.log('backend', 'window', message),
  sessionPartition: localTestSessionPartition,
});
runtimeLogger.setWindowsProvider(() => windowManager.getShellRendererWindows());
const unityBridgeService = createUnityBridgeService({
  log: (message, details) => runtimeLogger.log('backend', 'unity', message, details),
  rendererWindowsProvider: () => windowManager.getShellRendererWindows(),
});
unityBridgeService.start();

areaPickerServiceInstance = createAreaPickerService({
  captureService,
  isQuitting: () => appIsQuitting,
  loadRenderer,
  windowManager,
});

captureService.setShellRendererWindowsProvider(windowManager.getShellRendererWindows);
captureService.setSettingsWindowProvider(windowManager.getSettingsWindow);

registerDesktopPetIpcHandlers({
  app,
  appUsageMetricsService,
  buildInfo,
  appLauncherService,
  areaPickerService: areaPickerServiceInstance,
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
  shell,
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
  skillPackageArtifactStore,
  skillPackageSignedInstallCoordinator,
  systemInfoService,
  unityBridgeService,
  unityRuntimeProcessService,
  windowManager,
});
registerExpressionLibraryIpcHandlers({
  dialog,
  expressionLibraryService,
  ipcMain,
  shell,
  systemExpressionCatalogService,
});

app.on('before-quit', () => {
  appUsageMetricsService.persist();
  const sharedState = windowManager.getSharedState();
  if (Array.isArray(sharedState?.chatState?.messages)) {
    persistedChatHistoryStore.save(sharedState.chatState.messages);
  }
});

const gotSingleInstanceLock = isLocalTest
  || shouldRunPackagedReadOnlyHeadlessProbe
  || shouldRunPackagedExternalSkillAdmissionProbe
  || shouldRunPackagedMarketplaceProductionProbe
  || shouldRunNeuralPersonaPackagedProbe
  ? true
  : app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    runtimeLogger.log('backend', 'main-process', 'second-instance');
    void windowManager.showOrRecoverMainWindow('second-instance');
  });

  app.whenReady().then(async () => {
    runtimeLogger.log('backend', 'main-process', 'whenReady: begin');
    try {
      if (shouldRunNeuralPersonaPackagedProbe) {
        const report = runNeuralPersonaPackagedPersistenceProbe({
          app,
          env: process.env,
          fileStore: neuralPersonaFileStore,
        });
        runtimeLogger.log('backend', 'neural-persona', 'packaged persistence probe complete', report);
        app.exit(report.ok ? 0 : 1);
        return;
      }

      if (shouldRunPackagedReadOnlyHeadlessProbe) {
        runtimeLogger.log('backend', 'mcp', 'packaged read-only MCP headless probe begin');
        const report = await runMcpPackagedReadOnlyCallProbe({
          app,
          env: process.env,
          mcpHistoryService,
          mcpStdioClientService,
        });
        runtimeLogger.log('backend', 'mcp', 'packaged read-only MCP headless probe complete', report.totals);
        app.quit();
        return;
      }

      if (shouldRunPackagedExternalSkillAdmissionProbe) {
        runtimeLogger.log('backend', 'skill-capability', 'packaged External Skill admission probe begin');
        const report = await runExternalSkillPackagedAdmissionProbe({
          app,
          capabilityGateway: externalSkillCapabilityGateway,
          env: process.env,
          signedInstallCoordinator: skillPackageSignedInstallCoordinator,
        });
        runtimeLogger.log('backend', 'skill-capability', 'packaged External Skill admission probe complete', report.summary);
        app.exit(report.ok ? 0 : 1);
        return;
      }

      if (shouldRunPackagedMarketplaceProductionProbe) {
        runtimeLogger.log('backend', 'skill-marketplace-catalog', 'packaged marketplace production probe begin');
        try {
          const report = await runExternalSkillMarketplaceProductionProbe({
            app,
            appAsarPath: path.join(process.resourcesPath, 'app.asar'),
            deliveryService: externalSkillMarketplacePublisherCatalogDeliveryService,
            env: process.env,
            productionConfigPaths: externalSkillMarketplaceProductionConfig,
            readinessService: externalSkillMarketplaceProductionReadinessService,
          });
          runtimeLogger.log(
            'backend',
            'skill-marketplace-catalog',
            'packaged marketplace production probe complete',
            report.summary,
          );
          app.exit(report.ok ? 0 : 1);
        } catch (error) {
          runtimeLogger.log(
            'backend',
            'skill-marketplace-catalog',
            'packaged marketplace production probe failed',
            error?.stack || error,
          );
          app.exit(1);
        }
        return;
      }

      const marketplaceCatalogDelivery =
        await externalSkillMarketplacePublisherCatalogDeliveryService.refreshCatalog();
      runtimeLogger.log(
        'backend',
        'skill-marketplace-catalog',
        'Marketplace publisher catalog delivery startup check',
        marketplaceCatalogDelivery,
      );

      const activeSession = isLocalTest
        ? session.fromPartition(localTestSessionPartition)
        : session.defaultSession;

      registerLocalModelProtocol({
        session: activeSession,
        log: (message, details) => {
          runtimeLogger.log('backend', 'model', message, details);
        },
      });

      activeSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        if (permission === 'media' || permission === 'display-capture') {
          callback(true);
          return;
        }

        callback(false);
      });

      activeSession.setDisplayMediaRequestHandler((_request, callback) => {
        desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE,
          fetchWindowIcons: false,
        })
          .then((sources) => {
            if (!sources.length) {
              callback({});
              return;
            }

            callback({
              video: sources[0],
            });
          })
          .catch(() => {
            callback({});
          });
      });

      await clearRendererStartupCodeCaches(activeSession);

      runtimeLogger.log('backend', 'main-process', 'whenReady: creating main window');
      windowManager.createMainWindow();
      if (isLocalTest) {
        if (localTestConfigPath) {
          const injectLocalTestConfigTimer = setTimeout(async () => {
            try {
              const activeMainWindow = windowManager.getMainWindow();
              if (!activeMainWindow || activeMainWindow.isDestroyed()) {
                runtimeLogger.log('backend', 'config', 'local-test config inject skipped: window missing');
                return;
              }

              const rawConfig = fs.readFileSync(localTestConfigPath, 'utf8').trim();
              if (!rawConfig) {
                runtimeLogger.log('backend', 'config', 'local-test config inject skipped: config empty');
                return;
              }

              const configPayload = extractLocalTestConfigPayload(rawConfig);
              let filePersistResult = null;
              try {
                filePersistResult = persistedConfigStore.save(configPayload);
              } catch (error) {
                filePersistResult = {
                  ok: false,
                  error: error?.stack || String(error),
                };
              }

              const normalizedRawConfig = JSON.stringify(configPayload);
              const injectResult = await activeMainWindow.webContents.executeJavaScript(`
                (() => {
                  try {
                    const key = 'desktop-pet:persisted-config:v1';
                    const next = ${JSON.stringify(normalizedRawConfig)};
                    const current = window.localStorage.getItem(key) || '';
                    if (current === next) {
                      return 'unchanged';
                    }

                    window.localStorage.setItem(key, next);
                    return 'updated';
                  } catch (error) {
                    return String(error);
                  }
                })();
              `, true);

              runtimeLogger.log('backend', 'config', 'local-test config inject result', {
                configPath: localTestConfigPath,
                filePersistResult,
                result: injectResult,
              });

              if (injectResult === 'updated' && !activeMainWindow.isDestroyed()) {
                activeMainWindow.reload();
              }
            } catch (error) {
              runtimeLogger.log('backend', 'config', 'local-test config inject failed', error?.stack || error);
            }
          }, 450);
          if (typeof injectLocalTestConfigTimer.unref === 'function') {
            injectLocalTestConfigTimer.unref();
          }
        }

        const inspectPersistedConfigTimer = setTimeout(async () => {
          try {
            const activeMainWindow = windowManager.getMainWindow();
            if (!activeMainWindow || activeMainWindow.isDestroyed()) {
              runtimeLogger.log('backend', 'config', 'local-test persisted-config inspect skipped: window missing');
              return;
            }

            const persistedConfigRaw = await activeMainWindow.webContents.executeJavaScript(`
              (() => {
                try {
                  return window.localStorage.getItem('desktop-pet:persisted-config:v1') || '';
                } catch (error) {
                  return String(error);
                }
              })();
            `, true);
            const persistedConfigPreview = typeof persistedConfigRaw === 'string'
              ? persistedConfigRaw.slice(0, 1200)
              : String(persistedConfigRaw);

            runtimeLogger.log('backend', 'config', 'local-test persisted-config snapshot', {
              preview: persistedConfigPreview,
              rawLength: typeof persistedConfigRaw === 'string' ? persistedConfigRaw.length : 0,
            });
          } catch (error) {
            runtimeLogger.log('backend', 'config', 'local-test persisted-config inspect failed', error?.stack || error);
          }
        }, 2200);
        if (typeof inspectPersistedConfigTimer.unref === 'function') {
          inspectPersistedConfigTimer.unref();
        }
      }
      if (captureMainWindowPath) {
        if (isLocalTest) {
          const runCanvasProbe = async (label) => {
            try {
              const activeMainWindow = windowManager.getMainWindow();
              if (!activeMainWindow || activeMainWindow.isDestroyed()) {
                runtimeLogger.log('backend', 'model', `${label} canvas probe skipped: window missing`);
                return;
              }

              const probeResult = await activeMainWindow.webContents.executeJavaScript(`
                (() => {
                  try {
                    const canvases = Array.from(document.querySelectorAll('canvas'))
                      .filter((canvas) => canvas instanceof HTMLCanvasElement);
                    if (canvases.length === 0) {
                      return { ok: false, reason: 'no-canvas' };
                    }
                    return {
                      ok: true,
                      canvasCount: canvases.length,
                      canvases: canvases.map((canvas, canvasIndex) => {
                        const rect = canvas.getBoundingClientRect();
                        const probeCanvas = document.createElement('canvas');
                        probeCanvas.width = Math.max(1, Math.min(256, canvas.width || Math.round(rect.width) || 1));
                        probeCanvas.height = Math.max(1, Math.min(256, canvas.height || Math.round(rect.height) || 1));
                        const context = probeCanvas.getContext('2d');
                        if (!context) {
                          return {
                            index: canvasIndex,
                            ok: false,
                            reason: 'no-2d-context',
                          };
                        }

                        context.clearRect(0, 0, probeCanvas.width, probeCanvas.height);
                        context.drawImage(canvas, 0, 0, probeCanvas.width, probeCanvas.height);
                        const { data } = context.getImageData(0, 0, probeCanvas.width, probeCanvas.height);

                        let visiblePixelCount = 0;
                        let nonBlackPixelCount = 0;
                        for (let index = 0; index < data.length; index += 4) {
                          const r = data[index] ?? 0;
                          const g = data[index + 1] ?? 0;
                          const b = data[index + 2] ?? 0;
                          const a = data[index + 3] ?? 0;
                          if (a > 12) {
                            visiblePixelCount += 1;
                          }
                          if ((r + g + b) > 18 && a > 12) {
                            nonBlackPixelCount += 1;
                          }
                        }

                        return {
                          index: canvasIndex,
                          ok: true,
                          canvasHeight: canvas.height,
                          canvasWidth: canvas.width,
                          clientHeight: Math.round(rect.height),
                          clientWidth: Math.round(rect.width),
                          nonBlackPixelCount,
                          probeHeight: probeCanvas.height,
                          probeWidth: probeCanvas.width,
                          visiblePixelCount,
                        };
                      }),
                    };
                  } catch (error) {
                    return {
                      ok: false,
                      reason: error instanceof Error ? error.message : String(error),
                    };
                  }
                })();
              `, true);

              runtimeLogger.log('backend', 'model', `${label} canvas probe`, probeResult);
            } catch (error) {
              runtimeLogger.log('backend', 'model', `${label} canvas probe failed`, error?.stack || error);
            }
          };

          const earlyProbeCanvasTimer = setTimeout(() => {
            void runCanvasProbe('local-test early');
          }, 9000);
          if (typeof earlyProbeCanvasTimer.unref === 'function') {
            earlyProbeCanvasTimer.unref();
          }

          const lateProbeCanvasTimer = setTimeout(() => {
            void runCanvasProbe('local-test late');
          }, 24000);
          if (typeof lateProbeCanvasTimer.unref === 'function') {
            lateProbeCanvasTimer.unref();
          }
        }

        const captureDelayMs = isLocalTest ? 28000 : 9000;
        const captureTimer = setTimeout(async () => {
          try {
            const activeMainWindow = windowManager.getMainWindow();
            if (!activeMainWindow || activeMainWindow.isDestroyed()) {
              runtimeLogger.log('backend', 'model', 'main-window capture skipped: window missing');
              return;
            }

            const image = await activeMainWindow.capturePage();
            fs.mkdirSync(path.dirname(captureMainWindowPath), { recursive: true });
            fs.writeFileSync(captureMainWindowPath, image.toPNG());
            runtimeLogger.log('backend', 'model', 'main-window captured', {
              outputPath: captureMainWindowPath,
            });
          } catch (error) {
            runtimeLogger.log('backend', 'model', 'main-window capture failed', error?.stack || error);
          }
        }, captureDelayMs);
        if (typeof captureTimer.unref === 'function') {
          captureTimer.unref();
        }
      }
      runtimeLogger.log('backend', 'main-process', 'whenReady: creating tray');
      windowManager.createTray();
      if (shouldAutoOpenSettingsInLocalTest) {
        setTimeout(() => {
          void windowManager.openSettingsWindow();
        }, 600);
      }
      if (!isLocalTest && process.env.DESKTOP_PET_PRELOAD_SETTINGS_WINDOW === '1') {
        const preloadSettingsTimer = setTimeout(() => {
          windowManager.preloadSettingsWindow();
        }, 1800);
        if (typeof preloadSettingsTimer.unref === 'function') {
          preloadSettingsTimer.unref();
        }
      }

      const handleDisplayEnvironmentChange = () => {
        captureService.invalidateCaptureSourceCache();
        desktopIconService.invalidate();
        windowManager.resizeWindowForSettings(windowManager.getShellSettingsOpen());
        windowManager.scheduleWindowStackOnTop();
        areaPickerServiceInstance.refreshPersistentAreaBorder();
        captureService.scheduleDisplayEnvironmentBroadcast({
          includeCaptureSources: false,
          windows: windowManager.getShellRendererWindows(),
        });
        windowManager.scheduleSettingsWindowContentRefresh({ forceCaptureSourceRefresh: true });
      };

      screen.on('display-added', handleDisplayEnvironmentChange);
      screen.on('display-removed', handleDisplayEnvironmentChange);
      screen.on('display-metrics-changed', handleDisplayEnvironmentChange);

      app.on('activate', () => {
        runtimeLogger.log('backend', 'main-process', 'activate');
        void windowManager.showOrRecoverMainWindow('activate');
      });
      runtimeLogger.log('backend', 'main-process', 'whenReady: complete');
      schedulePackagedSoakAutoQuit({
        app,
        isDev,
        isLocalTest,
        log: (message, details) => runtimeLogger.log('backend', 'main-process', message, details),
      });
      scheduleMcpPackagedReadOnlyCallProbe({
        app,
        isDev,
        isLocalTest,
        log: (message, details) => runtimeLogger.log('backend', 'mcp', message, details),
        mcpHistoryService,
        mcpStdioClientService,
      });
    } catch (error) {
      runtimeLogger.log('backend', 'main-process', 'whenReady: failed', error?.stack || error);
      throw error;
    }
  });
}

app.on('before-quit', () => {
  runtimeLogger.log('backend', 'main-process', 'before-quit');
  appIsQuitting = true;
  windowManager.setQuitting(true);
  if (typeof localVoiceRuntime.dispose === 'function') {
    localVoiceRuntime.dispose();
  }
  browserTtsService.dispose();
  externalSkillSandboxSupervisorService.dispose();
  mcpStdioClientService.dispose('app-quit');
  browserSearchService.dispose();
  areaPickerServiceInstance.dispose();
  unityRuntimeProcessService.dispose();
  unityBridgeService.stop();
  windowManager.dispose();
  captureService.dispose();
  // A hidden auxiliary window or a third-party child process can keep the
  // Electron message loop alive after explicit tray exit. Give normal close
  // handlers a short grace period, then terminate the main process cleanly.
  setTimeout(() => {
    if (!app.isReady()) return;
    try { app.exit(0); } catch {}
  }, 3000).unref?.();
});

app.on('will-quit', () => {
  runtimeLogger.log('backend', 'main-process', 'will-quit');
});

app.on('quit', (_event, exitCode) => {
  runtimeLogger.log('backend', 'main-process', 'quit', { exitCode });
});

app.on('render-process-gone', (_event, webContents, details) => {
  const recoveryStarted = windowManager.recoverMainWindowRenderer(webContents, details);
  runtimeLogger.log('backend', 'error', 'render-process-gone', {
    id: webContents.id,
    reason: details.reason,
    exitCode: details.exitCode,
    recoveryStarted,
  });
});

app.on('child-process-gone', (_event, details) => {
  runtimeLogger.log('backend', 'error', 'child-process-gone', details);
});

app.on('window-all-closed', (event) => {
  runtimeLogger.log('backend', 'main-process', 'window-all-closed');
  // Closing a window normally keeps the desktop pet resident, but an explicit
  // tray "Exit" must be allowed to finish the Electron quit lifecycle.
  if (!appIsQuitting) {
    event.preventDefault();
  }
});
