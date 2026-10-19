import { runPlatformCapability } from '../platform-capabilities/platformCapabilityRegistry';
import { type AgentChatCommandResult, type AgentToolCallCommand } from './agentChatCommand';
import { type AgentRuntimeExecutorContext } from './agentRuntimeExecutor';

/** argsJson arrives as a JSON string (tool inputs are scalar); a bad string means no args. */
export function readPlatformCapabilityToolInput(input: Record<string, unknown> | undefined) {
  const raw = input?.argsJson;
  let args: Record<string, unknown> = {};
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
    } catch {
      args = {};
    }
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    args = raw as Record<string, unknown>;
  }
  return { args, capability: typeof input?.capability === 'string' ? input.capability.trim() : '' };
}

export async function executeUsePlatformCapability(
  context: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const { args, capability } = readPlatformCapabilityToolInput(toolCall.input);
  const result = await runPlatformCapability(
    { configRef: context.configRef, onUpdateConfig: context.onUpdateConfig, petId: context.petId },
    { args, capability },
  );
  return {
    ...(result.ok ? {} : { errorText: result.text }),
    observations: [
      `Platform capability: ${result.capabilityId || capability || '(none)'}`,
      `Args: ${JSON.stringify(args)}`,
      `Result: ${result.text}`,
    ],
    ok: result.ok,
    receipt: {
      evidenceLines: [result.text],
      status: result.ok ? 'success' : 'failed',
      summaryLines: ['调用：use_platform_capability', `能力：${result.capabilityId || capability}`],
      title: '执行回执',
      toolName: 'use_platform_capability',
      verification: result.ok ? result.text : null,
    },
    responseText: result.text,
    verification: result.ok ? result.text : undefined,
  };
}
