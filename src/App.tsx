/* @license SPDX-License-Identifier: Apache-2.0 */

import { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { type DesktopPetChatController } from './chatState';
import { desktopPetShellRuntime } from './desktopShellRuntime';
import { pushFrontendRuntimeLog } from './frontendRuntimeLogger';
import { useDesktopShellBridge } from './hooks/useDesktopShellBridge';
import { usePetRuntimeState } from './hooks/usePetRuntimeState';
import { normalizePetConfig } from './petConfigNormalization';
import { usePetContentManifest } from './pet-runtime/content/usePetContentManifest';
import PetContainer from './components/PetContainer';
import { resolvePetModel3DStandaloneSurface } from './components/pet/petModel3DStandaloneSurface';
import { useDesktopCapture } from './hooks/useDesktopCapture';
import { type PetVisualSize } from './types';

const PetModel3D = lazy(() => import('./components/PetModel3D'));

const CAPTURE_UNSUPPORTED_MESSAGE = '\u5f53\u524d\u73af\u5883\u4e0d\u652f\u6301\u684c\u9762\u6355\u83b7\u3002';
const CAPTURE_FAILED_MESSAGE = '\u65e0\u6cd5\u83b7\u53d6\u684c\u9762\u8fde\u63a5\uff0c\u8bf7\u786e\u8ba4\u5df2\u6388\u4e88\u6743\u9650\u5e76\u9009\u62e9\u6709\u6548\u6e90\u3002';
const CAPTURE_ENDED_MESSAGE = '\u684c\u9762\u8fde\u63a5\u5df2\u65ad\u5f00';
const CAPTURE_STOPPED_MESSAGE = '\u684c\u9762\u8fde\u63a5\u5df2\u4e3b\u52a8\u65ad\u5f00';

function formatCaptureConnectedMessage(options: DesktopPetCaptureOptionsLike) {
  const captureLabel = options.mode === 'area'
    && Array.isArray(options.areaSources)
    && options.areaSources.length > 1
    ? `\u8de8\u5c4f\u533a\u57df: ${options.areaSources.length} \u4e2a\u663e\u793a\u5668`
    : options.sourceName
      ? `${options.sourceType === 'window' ? '\u7a97\u53e3' : '\u5c4f\u5e55'}: ${options.sourceName}`
      : '\u771f\u5b9e\u684c\u9762';
  const cropLabel = options.mode === 'area' && options.cropRect
    ? ` \u533a\u57df ${Math.round(options.cropRect.width)}x${Math.round(options.cropRect.height)}`
    : '';

  return `\u89c6\u89c9\u7cfb\u7edf\u5df2\u8fde\u63a5 ${captureLabel}${cropLabel}`;
}

function decodeQueryPath(searchParams: URLSearchParams, base64Key: string, plainKey: string) {
  const base64Path = searchParams.get(base64Key);
  if (base64Path) {
    try {
      const decoded = window.atob(base64Path);
      const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch {
      // Fall through to the plain query string value.
    }
  }

  return searchParams.get(plainKey);
}

export default function App() {
  const chatControllerRef = useRef<DesktopPetChatController | null>(null);
  const [interactiveDialogueActive, setInteractiveDialogueActive] = useState(false);
  const [petVisualSize, setPetVisualSize] = useState<PetVisualSize | null>(null);
  const debugModelPath = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const searchParams = new URLSearchParams(window.location.search);
    return decodeQueryPath(searchParams, 'debugModelPathBase64', 'debugModelPath');
  }, []);
  const desktopDebugModelPath = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const searchParams = new URLSearchParams(window.location.search);
    return decodeQueryPath(searchParams, 'desktopDebugModelPathBase64', 'desktopDebugModelPath');
  }, []);
  const debugModelScale = useMemo(() => {
    if (typeof window === 'undefined') {
      return 1;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const parsedScale = Number(searchParams.get('debugModelScale') ?? '1');
    return Number.isFinite(parsedScale) && parsedScale > 0 ? parsedScale : 1;
  }, []);
  const desktopDebugModelScale = useMemo(() => {
    if (typeof window === 'undefined') {
      return 1;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const parsedScale = Number(searchParams.get('desktopDebugModelScale') ?? '1');
    return Number.isFinite(parsedScale) && parsedScale > 0 ? parsedScale : 1;
  }, []);
  const debugFocusTarget = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const x = Number(searchParams.get('debugFocusX') ?? '0');
    const y = Number(searchParams.get('debugFocusY') ?? '0');
    if (!Number.isFinite(x) || !Number.isFinite(y) || (Math.abs(x) < 0.01 && Math.abs(y) < 0.01)) {
      return null;
    }

    return { x, y };
  }, []);
  const {
    isResolved: debugModelManifestResolved,
    manifest: debugModelManifest,
    sourceUrl: debugModelManifestSourceUrl,
  } = usePetContentManifest(debugModelPath ?? '');
  const debugModelSurface = useMemo(() => (
    !debugModelPath
      ? null
      : resolvePetModel3DStandaloneSurface({
        action: debugFocusTarget ? 'WALKING' : 'IDLE',
        contentManifest: debugModelManifest,
        contentManifestResolved: debugModelManifestResolved,
        contentManifestSourceUrl: debugModelManifestSourceUrl,
        focusTarget: debugFocusTarget,
        isMoving: Boolean(debugFocusTarget),
        scale: debugModelScale,
        url: debugModelPath,
      })
  ), [
    debugFocusTarget,
    debugModelManifest,
    debugModelManifestResolved,
    debugModelManifestSourceUrl,
    debugModelPath,
    debugModelScale,
  ]);
  const {
    addLog,
    config,
    handleUpdateConfig,
    isFatigueSleeping,
    logs,
    resetFolders,
    setAction,
    statReactionAction,
  } = usePetRuntimeState();

  const {
    activeScreenCaptureOptions,
    handlePreviewCaptureOptionsChange,
    handleStartScreenCapture,
    handleStopScreenCapture,
    screenStream,
  } = useDesktopCapture({
    addLog,
    unsupportedMessage: CAPTURE_UNSUPPORTED_MESSAGE,
    failedMessage: CAPTURE_FAILED_MESSAGE,
    endedMessage: CAPTURE_ENDED_MESSAGE,
    stoppedMessage: CAPTURE_STOPPED_MESSAGE,
    formatConnectedMessage: formatCaptureConnectedMessage,
  });

  useEffect(() => {
    const isDesktopShell = desktopPetShellRuntime.isDesktopMode();
    const searchParams = new URLSearchParams(window.location.search);
    const panel = searchParams.get('panel') ?? '';
    const explicitDomDebugSetting = searchParams.get('domDebug');
    const shouldShowDomDebug = isDesktopShell
      && panel === ''
      && explicitDomDebugSetting === '1';
    document.body.classList.toggle('desktop-shell', isDesktopShell);
    document.body.classList.toggle('desktop-dom-debug', isDesktopShell && shouldShowDomDebug);

    return () => {
      document.body.classList.remove('desktop-dom-debug');
      if (!isDesktopShell) {
        document.body.classList.remove('desktop-shell');
      }
    };
  }, []);

  useEffect(() => {
    if (!debugModelPath) {
      return;
    }

    pushFrontendRuntimeLog('model', `pmx debug view active path=${debugModelPath}`);
  }, [debugModelPath]);

  useEffect(() => {
    if (!desktopDebugModelPath || !desktopPetShellRuntime.isDesktopMode()) {
      return;
    }

    if (
      config.modelType === '3d'
      && config.modelUrl === desktopDebugModelPath
      && Math.abs(config.scale - desktopDebugModelScale) < 0.001
    ) {
      return;
    }

    pushFrontendRuntimeLog('model', `desktop local-test model override path=${desktopDebugModelPath}`, {
      modelPath: desktopDebugModelPath,
      scale: desktopDebugModelScale,
    });
    handleUpdateConfig(normalizePetConfig({
      ...config,
      modelType: '3d',
      modelUrl: desktopDebugModelPath,
      scale: desktopDebugModelScale,
    }), { normalize: false });
  }, [config, desktopDebugModelPath, desktopDebugModelScale, handleUpdateConfig]);

  const {
    isChatWindowOpen,
    isDesktopShell,
    isSettingsOpen,
    scheduleSharedStateSync,
    setIsSettingsOpen,
  } = useDesktopShellBridge({
    chatControllerRef,
    config,
    interactiveDialogueActive,
    logs,
    screenCaptureOptions: activeScreenCaptureOptions,
    petVisualSize,
    onPreviewCaptureOptionsChange: handlePreviewCaptureOptionsChange,
    onResetFolders: resetFolders,
    onSetAction: setAction,
    onStartScreenCapture: handleStartScreenCapture,
    onStopScreenCapture: handleStopScreenCapture,
    onUpdateConfig: handleUpdateConfig,
    screenStream,
  });

  if (debugModelPath) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 overflow-hidden bg-background text-foreground">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary/90">
          PMX Debug View
        </div>
        <div className="rounded border border-border bg-card/70 px-4 py-2 text-center text-[11px] text-muted-foreground">
          {debugModelPath}
        </div>
        <div className="h-[640px] w-[640px] rounded border border-primary/20 bg-[radial-gradient(circle_at_top,rgba(0,209,255,0.16),transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.36))] p-4">
          <Suspense fallback={<div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">Loading PMX...</div>}>
            {debugModelSurface ? <PetModel3D {...debugModelSurface} /> : null}
          </Suspense>
        </div>
      </div>
    );
  }

  if (isDesktopShell) {
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-transparent">
        <PetContainer
          config={config}
          isSettingsOpen={isSettingsOpen}
          isExternalChatOpen={isChatWindowOpen}
          settingsResetToken={0}
          useExternalSettingsWindow
          useExternalChatWindow
          onRequestSettingsWindow={() => desktopPetShellRuntime.openSettingsWindow()}
          onRequestSharedStateSync={scheduleSharedStateSync}
          onRequestChatWindow={() => desktopPetShellRuntime.openChatWindow()}
          onRequestCloseChatWindow={() => desktopPetShellRuntime.closeChatWindow()}
          onSetSettingsOpen={setIsSettingsOpen}
          onUpdateConfig={handleUpdateConfig}
          addLog={addLog}
          screenStream={screenStream}
          screenCaptureOptions={activeScreenCaptureOptions}
          onPreviewCaptureOptionsChange={handlePreviewCaptureOptionsChange}
          logs={logs}
          onStartScreenCapture={handleStartScreenCapture}
          onStopScreenCapture={handleStopScreenCapture}
          onResetFolders={resetFolders}
          onSetAction={setAction}
          actionOverride={isFatigueSleeping ? 'SLEEPING' : statReactionAction}
          pauseAutoMovement={isFatigueSleeping}
          onChatControllerReady={(controller) => {
            chatControllerRef.current = controller;
          }}
          onInteractiveDialogueActiveChange={setInteractiveDialogueActive}
          onPetVisualSizeChange={setPetVisualSize}
        />
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent">
      <PetContainer
        config={config}
        isSettingsOpen={isSettingsOpen}
        settingsResetToken={0}
        onSetSettingsOpen={setIsSettingsOpen}
        onUpdateConfig={handleUpdateConfig}
        addLog={addLog}
        screenStream={screenStream}
        screenCaptureOptions={activeScreenCaptureOptions}
        onPreviewCaptureOptionsChange={handlePreviewCaptureOptionsChange}
        logs={logs}
        onStartScreenCapture={handleStartScreenCapture}
        onStopScreenCapture={handleStopScreenCapture}
        onResetFolders={resetFolders}
        onSetAction={setAction}
        onChatControllerReady={(controller) => {
          chatControllerRef.current = controller;
        }}
        onInteractiveDialogueActiveChange={setInteractiveDialogueActive}
        onPetVisualSizeChange={setPetVisualSize}
      />
    </div>
  );
}
