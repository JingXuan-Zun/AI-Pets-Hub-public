import { type AgentRuntimePendingApproval, type AgentTaskRuntimeStateRecord } from './agentRuntimeContract';

export type AgentRuntimeTaskTransactionPhase =
  | 'idle'
  | 'running'
  | 'waiting_approval'
  | 'resuming'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface AgentRuntimeTaskTransactionState {
  approval: AgentRuntimePendingApproval | null;
  lastError: string | null;
  phase: AgentRuntimeTaskTransactionPhase;
  taskState: AgentTaskRuntimeStateRecord | null;
}
