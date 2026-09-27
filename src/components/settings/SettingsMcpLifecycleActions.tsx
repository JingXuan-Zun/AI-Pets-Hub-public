import { Activity, Pencil, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';

interface SettingsMcpLifecycleActionsProps {
  disabled?: boolean;
  serverId: string;
  onEditServer?: (serverId: string) => void;
  onFeedback?: (message: string) => void;
  onRefreshHistory?: () => Promise<void>;
  onRefreshSessions?: () => Promise<void>;
  onRunDiagnostic?: (serverId: string) => Promise<void> | void;
}

type SettingsMcpLifecycleAction = 'diagnostic' | 'reset';

function formatResetFeedback(serverId: string, result: DesktopPetMcpSessionResetResultLike) {
  if (!result.ok) {
    return result.error || `MCP session reset failed: ${serverId}.`;
  }

  const closeKind = result.closeKind ? ` (${result.closeKind})` : '';
  return `MCP session reset: ${serverId}, ${result.closedCount} closed${closeKind}.`;
}

function formatErrorFeedback(action: string, serverId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return `MCP ${action} failed for ${serverId}: ${message}`;
}

export function SettingsMcpLifecycleActions({
  disabled = false,
  onEditServer,
  onFeedback,
  onRefreshHistory,
  onRefreshSessions,
  onRunDiagnostic,
  serverId,
}: SettingsMcpLifecycleActionsProps) {
  const [busyAction, setBusyAction] = useState<SettingsMcpLifecycleAction | null>(null);
  const isBusy = Boolean(busyAction);

  const resetSession = async () => {
    setBusyAction('reset');
    try {
      const result = await desktopPetShellRuntime.resetMcpSession({ serverId });
      onFeedback?.(formatResetFeedback(serverId, result));
      await onRefreshSessions?.();
      await onRefreshHistory?.();
    } catch (error) {
      onFeedback?.(formatErrorFeedback('session reset', serverId, error));
    } finally {
      setBusyAction(null);
    }
  };

  const runDiagnostic = async () => {
    setBusyAction('diagnostic');
    try {
      if (onRunDiagnostic) {
        await onRunDiagnostic(serverId);
      } else {
        const result = await desktopPetShellRuntime.inspectMcpServer({ serverId });
        onFeedback?.(result.ok
          ? `MCP diagnostic passed: ${serverId}, ${result.toolCount ?? 0} tools.`
          : result.error || `MCP diagnostic failed: ${serverId}.`);
      }
      await onRefreshSessions?.();
      await onRefreshHistory?.();
    } catch (error) {
      onFeedback?.(formatErrorFeedback('diagnostic', serverId, error));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      <Button type="button" variant="ghost" size="icon-xs" title={`Reset ${serverId} session`} disabled={disabled || isBusy} onClick={() => void resetSession()}>
        <RotateCcw className="h-3 w-3" />
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" title={`Run ${serverId} diagnostic`} disabled={disabled || isBusy} onClick={() => void runDiagnostic()}>
        <Activity className="h-3 w-3" />
      </Button>
      {onEditServer ? (
        <Button type="button" variant="ghost" size="icon-xs" title={`Edit ${serverId} config`} disabled={disabled || isBusy} onClick={() => onEditServer(serverId)}>
          <Pencil className="h-3 w-3" />
        </Button>
      ) : null}
    </div>
  );
}
