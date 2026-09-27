import { useEffect, useState } from 'react';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';

export type SettingsAgentSkillMcpConfigStatus = 'error' | 'loading' | 'ready';

export interface SettingsAgentSkillMcpConfigSnapshot {
  config?: Record<string, unknown>;
  detail: string;
  status: SettingsAgentSkillMcpConfigStatus;
}

function createSnapshotFromResult(result: DesktopPetMcpConfigResultLike): SettingsAgentSkillMcpConfigSnapshot {
  if (!result.ok) {
    return {
      detail: result.error || 'MCP config could not be loaded.',
      status: 'error',
    };
  }

  return {
    config: result.config,
    detail: result.exists ? `Loaded saved MCP config from ${result.path}.` : 'No saved MCP config file yet.',
    status: 'ready',
  };
}

export function useSettingsAgentSkillMcpConfigSnapshot(): SettingsAgentSkillMcpConfigSnapshot {
  const [snapshot, setSnapshot] = useState<SettingsAgentSkillMcpConfigSnapshot>({
    detail: 'Loading saved MCP config.',
    status: 'loading',
  });

  useEffect(() => {
    let disposed = false;
    desktopPetShellRuntime.loadMcpConfig()
      .then((result) => {
        if (!disposed) {
          setSnapshot(createSnapshotFromResult(result));
        }
      })
      .catch((error) => {
        if (!disposed) {
          setSnapshot({
            detail: error instanceof Error ? error.message : 'MCP config could not be loaded.',
            status: 'error',
          });
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  return snapshot;
}
