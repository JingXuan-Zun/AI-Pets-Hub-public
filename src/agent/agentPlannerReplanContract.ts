import { type AgentPermissionRoute } from './agentPermissionRouter';
import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentPlannerCommandStep,
  type AgentToolStateSummary,
} from './agentChatCommand';
import {
  type AgentExecutionPlan,
  type AgentExecutionPlanStep,
} from './agentOrchestrator';

export type AgentCorePhase =
  | 'understand-goal'
  | 'observe-context'
  | 'plan-tools'
  | 'route-permission'
  | 'execute-tools'
  | 'verify-result'
  | 'recover-or-finish';

export type AgentCorePlanStatus =
  | 'no-plan'
  | 'ready'
  | 'needs-approval'
  | 'blocked';

export interface AgentCorePlan {
  blockedStep: AgentExecutionPlanStep | null;
  command: AgentChatCommand;
  executionPlan: AgentExecutionPlan | null;
  goal: string | null;
  observationSteps: AgentExecutionPlanStep[];
  permissionRoute: AgentPermissionRoute;
  phaseIds: AgentCorePhase[];
  plannerSteps: AgentPlannerCommandStep[];
  requiresApproval: boolean;
  selectedToolName: string | null;
  status: AgentCorePlanStatus;
  taskSteps: AgentCoreTaskStep[];
  taskSummary: string;
}

export interface AgentCoreTaskStep {
  args: Record<string, unknown>;
  index: number;
  phase: AgentPlannerCommandStep['phase'];
  permissionStatus: AgentPermissionRoute['status'];
  reason?: string | null;
  requiresApproval: boolean;
  risk: AgentPermissionRoute['maxRisk'];
  selected: boolean;
  tool: AgentPlannerCommandStep['tool'];
}

export interface AgentCoreReplanRequest {
  corePlan: AgentCorePlan;
  currentCommand: AgentChatCommand;
  currentResult: AgentChatCommandResult;
  observationSummary: string;
  originalCommand: AgentChatCommand;
  remainingPlannerSteps: AgentPlannerCommandStep[];
  roundIndex: number;
  stateSummary: AgentToolStateSummary | null;
}

export interface AgentCoreRecoveryRequest {
  corePlan: AgentCorePlan;
  currentCommand: AgentChatCommand;
  currentResult: AgentChatCommandResult;
  originalCommand: AgentChatCommand;
  resultSummary: string;
  roundIndex: number;
  stateSummary: AgentToolStateSummary | null;
}

export interface AgentCoreReplanDecision {
  command: AgentChatCommand;
  reason?: string | null;
}
