import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { desktopPetShellRuntime } from '../desktopShellRuntime';

interface UseDesktopShellWindowStateResult {
  isChatWindowOpen: boolean;
  isSettingsOpen: boolean;
  setIsSettingsOpen: Dispatch<SetStateAction<boolean>>;
}

export function useDesktopShellWindowState(isDesktopShell: boolean): UseDesktopShellWindowStateResult {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatWindowOpen, setIsChatWindowOpen] = useState(false);

  useEffect(() => {
    if (!isDesktopShell) {
      return undefined;
    }

    desktopPetShellRuntime.isSettingsWindowOpen()
      .then((isOpen) => setIsSettingsOpen(Boolean(isOpen)))
      .catch(() => {});

    return desktopPetShellRuntime.onSettingsWindowState((isOpen) => {
      setIsSettingsOpen(isOpen);
    });
  }, [isDesktopShell]);

  useEffect(() => {
    if (!isDesktopShell) {
      return undefined;
    }

    desktopPetShellRuntime.isChatWindowOpen()
      .then((isOpen) => setIsChatWindowOpen(Boolean(isOpen)))
      .catch(() => {});

    return desktopPetShellRuntime.onChatWindowState((isOpen) => {
      setIsChatWindowOpen(Boolean(isOpen));
    });
  }, [isDesktopShell]);

  return {
    isChatWindowOpen,
    isSettingsOpen,
    setIsSettingsOpen,
  };
}
