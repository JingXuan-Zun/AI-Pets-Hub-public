import { type PetConfig } from '../types';
import { type AgentChatCommand } from './agentChatCommand';
import { type AgentExternalSkillDefinition } from './agentExternalSkillLibrary';
import { type AgentWorkingMemorySnapshot } from './agentChatContext';
import {
  type AgentRuntimeContinuation,
  type AgentRuntimeProgressHandler,
  type AgentRuntimeResult,
  type AgentRuntimeToolExecutor,
  type AgentRuntimeToolResultEntry,
  type AgentTaskRuntimeModelIterationAuthorizer,
  type AgentTaskRuntimeRecoveryAuthorizer,
} from './runtime/agentRuntimeContract';

export interface AgentProductionSessionModelRequest {
  settings: PetConfig['settings'];
  signal?: AbortSignal | null;
  systemInstruction: string;
  userInput: string;
}

export type AgentProductionSessionModelCaller = (
  request: AgentProductionSessionModelRequest,
) => Promise<string>;

export interface AgentProductionSessionResult extends AgentRuntimeResult {}

export interface RunAgentProductionSessionOptions {
  approvedToolResult?: AgentRuntimeToolResultEntry | null;
  initialCommand?: AgentChatCommand | null;
  authorizeModelIteration?: AgentTaskRuntimeModelIterationAuthorizer | null;
  authorizeRecovery?: AgentTaskRuntimeRecoveryAuthorizer | null;
  cancellationSignal?: AbortSignal | null;
  continuation?: AgentRuntimeContinuation | null;
  maxDurationMs?: number;
  maxModelCalls?: number;
  maxSteps?: number;
  importedSkills?: readonly AgentExternalSkillDefinition[];
  maxToolCalls?: number;
  modelCaller?: AgentProductionSessionModelCaller;
  onProgress?: AgentRuntimeProgressHandler;
  personaBehaviorContract?: string;
  settings: PetConfig['settings'];
  sourceText: string;
  toolExecutor?: AgentRuntimeToolExecutor;
  userGoal: string;
  workingMemory?: AgentWorkingMemorySnapshot | null;
  workingMemoryText?: string | null;
}
