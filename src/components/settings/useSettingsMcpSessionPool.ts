import { useState } from 'react';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';

export function useSettingsMcpSessionPool() {
  const [sessions, setSessions] = useState<DesktopPetMcpSessionStatusLike[]>([]);

  const refreshSessions = async () => {
    const result = await desktopPetShellRuntime.getMcpSessionStatus();
    setSessions(result.sessions ?? []);
    return result;
  };

  const resetSession = async (serverId?: string) => (
    desktopPetShellRuntime.resetMcpSession({ serverId })
  );

  return {
    refreshSessions,
    resetSession,
    sessions,
    setSessions,
  };
}
