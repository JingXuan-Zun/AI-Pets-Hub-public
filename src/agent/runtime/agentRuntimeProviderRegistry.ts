import type { AgentRuntimeAdapter, AgentRuntimeRunResult } from './agentRuntimeContract';
import type { AgentRuntimeProviderId } from '../../types';

/**
 * Runtime providers are execution backends, not capability plugins. The
 * native provider remains the default; external providers are optional
 * adapters and must not replace the platform's Character/Memory layer.
 */
export type { AgentRuntimeProviderId } from '../../types';

export interface AgentRuntimeProviderDescriptor {
  description: string;
  id: AgentRuntimeProviderId;
  label: string;
  status: 'active' | 'not-configured';
}

export const AGENT_RUNTIME_PROVIDER_CATALOG: readonly AgentRuntimeProviderDescriptor[] = [
  {
    description: 'AI-Pets-Hub 原生 Agent Runtime，负责桌宠角色、工具、权限与任务循环。',
    id: 'native',
    label: 'Native Runtime',
    status: 'active',
  },
  {
    description: '可选的 DeepSeek Harness 外部运行时适配器；接入协议尚未配置时不参与任务执行。',
    id: 'deepseek-harness',
    label: 'DeepSeek Harness',
    status: 'not-configured',
  },
];

export function getAgentRuntimeProviderDescriptor(id: AgentRuntimeProviderId) {
  return AGENT_RUNTIME_PROVIDER_CATALOG.find((provider) => provider.id === id)
    ?? AGENT_RUNTIME_PROVIDER_CATALOG[0];
}

export function createUnavailableAgentRuntimeAdapter<Result>(
  providerId: Exclude<AgentRuntimeProviderId, 'native'>,
): AgentRuntimeAdapter<Result> {
  const provider = getAgentRuntimeProviderDescriptor(providerId);
  return {
    id: `${provider.id}-adapter`,
    async run(): Promise<AgentRuntimeRunResult<Result>> {
      return {
        implementation: 'unavailable',
        reason: `${provider.label} adapter is not configured.`,
        result: null,
      };
    },
  };
}

/** The native adapter is wired by agentProductionSession.ts. */
export function isAgentRuntimeProviderConfigured(id: AgentRuntimeProviderId) {
  return getAgentRuntimeProviderDescriptor(id).status === 'active';
}

export function resolveDefaultAgentRuntimeProvider(): AgentRuntimeProviderId {
  return 'native';
}
