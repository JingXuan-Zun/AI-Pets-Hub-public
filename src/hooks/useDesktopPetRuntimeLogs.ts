import { useEffect, useRef } from 'react';
import { desktopPetShellRuntime } from '../desktopShellRuntime';

interface UseDesktopPetRuntimeLogsOptions {
  appendLogLine: (line: string) => void;
}

export function useDesktopPetRuntimeLogs({ appendLogLine }: UseDesktopPetRuntimeLogsOptions) {
  const knownRuntimeLogsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!desktopPetShellRuntime.isDesktopMode()) {
      return undefined;
    }

    let mounted = true;
    const pushRuntimeLog = (line: string) => {
      if (!line.trim() || knownRuntimeLogsRef.current.has(line)) {
        return;
      }

      knownRuntimeLogsRef.current.add(line);
      appendLogLine(line);
    };

    desktopPetShellRuntime.getRuntimeLogs()
      .then((entries) => {
        if (!mounted || !Array.isArray(entries)) {
          return;
        }

        entries
          .slice()
          .reverse()
          .forEach((entry) => {
            if (typeof entry === 'string') {
              pushRuntimeLog(entry);
            }
          });
      })
      .catch(() => {});

    const unsubscribe = desktopPetShellRuntime.onRuntimeLog((line: string) => {
      pushRuntimeLog(line);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [appendLogLine]);
}
