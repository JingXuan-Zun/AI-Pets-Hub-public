import { type SettingsMcpServerDraft } from './settingsMcpConfigFormUtils';
import { type SettingsMcpServerCheckState } from './settingsMcpHealthSummary';
import { mergeMcpToolsForServer } from './settingsMcpToolListUtils';

export interface SettingsMcpDiagnosticBatchResult {
  checksByServerId: Record<string, SettingsMcpServerCheckState>;
  failedCount: number;
  okCount: number;
  tools: DesktopPetMcpToolLike[];
  totalCount: number;
}

export function createMcpServerCheckStateFromDiagnostic(
  result: DesktopPetMcpServerDiagnosticLike,
  checkedAt = Date.now(),
): SettingsMcpServerCheckState {
  const tools = result.tools ?? [];
  const compatibility = result.compatibility;
  return {
    commandPathExists: result.commandPathExists,
    ...(compatibility ? {
      compatibilityIssueCode: compatibility.issueCode,
      compatibilityNextAction: compatibility.nextAction,
      compatibilityStatus: compatibility.status,
      compatibilitySummary: compatibility.summary,
    } : {}),
    cwdExists: result.cwdExists,
    durationMs: result.durationMs,
    error: result.ok ? null : result.error ?? 'MCP server test failed.',
    lastCheckedAt: checkedAt,
    stderrSnippet: result.stderrSnippet,
    timeoutMs: result.timeoutMs,
    toolCount: tools.length,
  };
}

export function createMcpServerCheckStateFromError(
  error: unknown,
  previous?: SettingsMcpServerCheckState,
  checkedAt = Date.now(),
): SettingsMcpServerCheckState {
  return {
    error: error instanceof Error ? error.message : 'MCP server test failed.',
    lastCheckedAt: checkedAt,
    toolCount: previous?.toolCount ?? 0,
  };
}

export async function runSettingsMcpDiagnosticsBatch(options: {
  currentChecksByServerId?: Record<string, SettingsMcpServerCheckState | undefined>;
  currentTools: DesktopPetMcpToolLike[];
  inspectServer: (serverId: string) => Promise<DesktopPetMcpServerDiagnosticLike>;
  servers: SettingsMcpServerDraft[];
}): Promise<SettingsMcpDiagnosticBatchResult> {
  let tools = options.currentTools;
  const checksByServerId: Record<string, SettingsMcpServerCheckState> = {};
  let okCount = 0;
  let failedCount = 0;

  for (const server of options.servers) {
    const serverId = server.id.trim();
    if (!serverId) {
      continue;
    }

    try {
      const result = await options.inspectServer(serverId);
      tools = mergeMcpToolsForServer(tools, serverId, result.tools ?? []);
      checksByServerId[serverId] = createMcpServerCheckStateFromDiagnostic(result);
      if (result.ok) {
        okCount += 1;
      } else {
        failedCount += 1;
      }
    } catch (error) {
      failedCount += 1;
      checksByServerId[serverId] = createMcpServerCheckStateFromError(
        error,
        options.currentChecksByServerId?.[serverId],
      );
    }
  }

  return {
    checksByServerId,
    failedCount,
    okCount,
    tools,
    totalCount: okCount + failedCount,
  };
}
