import {
  createAgentSkillExecutableHandlerGuardReport,
} from './agentSkillInstalledPackageExecutableHandlerGuard';
import {
  type AgentSkillInstalledPackageHandlerPreviewRegistry,
} from './agentSkillInstalledPackageHandlerPreviewRegistry';
import { type AgentSkillInstalledPackageRegistry } from './agentSkillPackageInstalledRegistry';
import { type AgentSkillInstalledPackageRuntimePolicy } from './agentSkillInstalledPackageRuntimePolicy';
import {
  resolveAgentSkillExecution,
  type AgentSkillExecutionInput,
  type AgentSkillExecutionResult,
} from './agentSkillRegistry';

export const AGENT_SKILL_EXECUTABLE_HANDLER_REGISTRY_KIND = 'agent-skill-executable-handler-registry.v1';
const MAX_AGENT_SKILL_EXECUTABLE_HANDLERS = 24;

export interface AgentSkillExecutableHandlerRecord {
  handlerId: string;
  loaderKind: 'local-skill-resolver';
  packageId: string;
  registeredAt: string;
  skillId: string;
}

export interface AgentSkillExecutableHandlerRegistry {
  handlers: AgentSkillExecutableHandlerRecord[];
  kind: typeof AGENT_SKILL_EXECUTABLE_HANDLER_REGISTRY_KIND;
}

export interface AgentSkillExecutableHandlerRegistrationResult {
  blockedCount: number;
  registeredCount: number;
  registry: AgentSkillExecutableHandlerRegistry;
}

export interface AgentSkillExecutableHandlerRuntimeOptions {
  trustedPackageIds?: readonly string[];
}

export interface AgentSkillExecutableHandlerRunResult {
  error: string | null;
  handler: AgentSkillExecutableHandlerRecord | null;
  result: AgentSkillExecutionResult | null;
}

export interface AgentSkillExecutableHandlerRunInput extends AgentSkillExecutionInput {
  packageId?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function createExecutableHandlerId(skillId: string, packageId: string) {
  return `${skillId}:${packageId}:executable`;
}

function normalizeHandler(value: unknown): AgentSkillExecutableHandlerRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const packageId = getString(value.packageId);
  const skillId = getString(value.skillId);
  if (!packageId || !skillId) {
    return null;
  }
  return {
    handlerId: getString(value.handlerId) || createExecutableHandlerId(skillId, packageId),
    loaderKind: 'local-skill-resolver',
    packageId,
    registeredAt: getString(value.registeredAt) || new Date(0).toISOString(),
    skillId,
  };
}

export function createEmptyAgentSkillExecutableHandlerRegistry(): AgentSkillExecutableHandlerRegistry {
  return {
    handlers: [],
    kind: AGENT_SKILL_EXECUTABLE_HANDLER_REGISTRY_KIND,
  };
}

export function parseAgentSkillExecutableHandlerRegistryJson(
  rawText?: string | null,
): AgentSkillExecutableHandlerRegistry {
  if (!rawText?.trim()) {
    return createEmptyAgentSkillExecutableHandlerRegistry();
  }
  const parsed = JSON.parse(rawText) as unknown;
  const handlers = isRecord(parsed) && Array.isArray(parsed.handlers)
    ? parsed.handlers
      .map(normalizeHandler)
      .filter((handler): handler is AgentSkillExecutableHandlerRecord => Boolean(handler))
    : [];
  return {
    handlers: handlers.slice(0, MAX_AGENT_SKILL_EXECUTABLE_HANDLERS),
    kind: AGENT_SKILL_EXECUTABLE_HANDLER_REGISTRY_KIND,
  };
}

export function serializeAgentSkillExecutableHandlerRegistry(
  registry: AgentSkillExecutableHandlerRegistry,
) {
  return JSON.stringify({
    handlers: registry.handlers.slice(0, MAX_AGENT_SKILL_EXECUTABLE_HANDLERS),
    kind: AGENT_SKILL_EXECUTABLE_HANDLER_REGISTRY_KIND,
  });
}

export function getAgentSkillExecutableHandlerPackageIds(registry: AgentSkillExecutableHandlerRegistry) {
  return registry.handlers.map((handler) => handler.packageId);
}

export function removeAgentSkillExecutableHandler(
  registry: AgentSkillExecutableHandlerRegistry,
  packageId: string,
): AgentSkillExecutableHandlerRegistry {
  return {
    handlers: registry.handlers.filter((handler) => handler.packageId !== packageId),
    kind: AGENT_SKILL_EXECUTABLE_HANDLER_REGISTRY_KIND,
  };
}

export function registerAgentSkillExecutableHandlersFromPreviews(
  registry: AgentSkillExecutableHandlerRegistry,
  installedRegistry: AgentSkillInstalledPackageRegistry,
  policy: AgentSkillInstalledPackageRuntimePolicy,
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry,
  registeredAt = new Date().toISOString(),
  options: AgentSkillExecutableHandlerRuntimeOptions = {},
): AgentSkillExecutableHandlerRegistrationResult {
  const guardReport = createAgentSkillExecutableHandlerGuardReport(installedRegistry, policy, previewRegistry, options);
  const previewsByPackageId = new Map(previewRegistry.previews.map((preview) => [preview.packageId, preview]));
  const registerableRows = guardReport.rows.filter((row) => row.canRegister);
  const newHandlers = registerableRows.map((row): AgentSkillExecutableHandlerRecord => {
    const preview = previewsByPackageId.get(row.packageId);
    return {
      handlerId: createExecutableHandlerId(row.skillId, row.packageId),
      loaderKind: 'local-skill-resolver',
      packageId: row.packageId,
      registeredAt,
      skillId: preview?.skillId ?? row.skillId,
    };
  });

  return {
    blockedCount: guardReport.rows.length - newHandlers.length,
    registeredCount: newHandlers.length,
    registry: {
      handlers: [
        ...newHandlers,
        ...registry.handlers.filter((handler) => !newHandlers.some((item) => item.packageId === handler.packageId)),
      ].slice(0, MAX_AGENT_SKILL_EXECUTABLE_HANDLERS),
      kind: AGENT_SKILL_EXECUTABLE_HANDLER_REGISTRY_KIND,
    },
  };
}

export function runAgentSkillExecutableHandler(
  registry: AgentSkillExecutableHandlerRegistry,
  installedRegistry: AgentSkillInstalledPackageRegistry,
  policy: AgentSkillInstalledPackageRuntimePolicy,
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry,
  input: AgentSkillExecutableHandlerRunInput,
  options: AgentSkillExecutableHandlerRuntimeOptions = {},
): AgentSkillExecutableHandlerRunResult {
  const handler = registry.handlers.find((item) => (
    input.packageId ? item.packageId === input.packageId : item.skillId === input.skillId
  )) ?? null;
  const guardRow = handler
    ? createAgentSkillExecutableHandlerGuardReport(installedRegistry, policy, previewRegistry, options)
      .rows.find((row) => row.packageId === handler.packageId)
    : null;
  if (!handler) {
    return { error: `No executable Skill handler registered for ${input.skillId}.`, handler: null, result: null };
  }
  if (!guardRow?.canRegister) {
    return { error: `Executable Skill handler is blocked: ${guardRow?.guardIssueCodes.join(', ') || 'guard-missing'}.`, handler, result: null };
  }
  return {
    error: null,
    handler,
    result: resolveAgentSkillExecution(input),
  };
}
