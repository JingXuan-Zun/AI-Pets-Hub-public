import { useEffect, useState } from 'react';
import { desktopPetShellRuntime } from './desktopShellRuntime';
import SettingsPanel from './components/SettingsPanel';
import { useDesktopPetShellStore } from './desktopShellStore';

export default function SettingsWindowApp() {
  const shellStore = useDesktopPetShellStore();
  const sharedState = shellStore.sharedState;
  const [isWindowOpen, setIsWindowOpen] = useState(true);
  const [resetToken, setResetToken] = useState(0);

  useEffect(() => {
    let mounted = true;

    desktopPetShellRuntime.isSettingsWindowOpen()
      .then((isOpen) => {
        if (mounted) {
          setIsWindowOpen(Boolean(isOpen));
        }
      })
      .catch(() => {});

    return desktopPetShellRuntime.onSettingsWindowState((isOpen) => {
      setIsWindowOpen(isOpen);
    });
  }, []);

  useEffect(() => {
    if (!isWindowOpen) {
      return;
    }

    setResetToken((currentValue) => currentValue + 1);
  }, [isWindowOpen]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-transparent">
      <SettingsPanel
        isOpen={isWindowOpen}
        resetToken={resetToken}
        standalone
        onClose={() => shellStore.closeSettingsWindow()}
        config={sharedState.config}
        petVisualSize={sharedState.petVisualSize}
        initialSelectedPetSlotId={sharedState.chatState.activePetId}
        onUpdateConfig={shellStore.updateConfig}
        logs={sharedState.logs}
        screenStream={null}
        screenCaptureActive={sharedState.screenCaptureActive}
        screenCaptureOptions={sharedState.screenCaptureOptions}
        onPreviewCaptureOptionsChange={shellStore.previewCaptureOptions}
        onStartScreenCapture={shellStore.startScreenCapture}
        onStopScreenCapture={shellStore.stopScreenCapture}
        onResetFolders={shellStore.resetFolders}
        onSetAction={shellStore.setAction}
      />
    </div>
  );
}
