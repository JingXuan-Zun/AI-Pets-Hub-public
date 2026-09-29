import {
  createRuntimeWorldController,
  type RuntimeWorldController,
  type RuntimeWorldEventInput,
} from './runtimeWorldController';
import { publishRuntimeWorldPresentationIntent } from './runtimeWorldPresentationTransport';

type AgentRuntimeTaskStateLike = {
  phase?: string | null;
  taskId?: string | null;
};

export type AgentRuntimeWorldProgressInput = {
  continuation: { taskState?: AgentRuntimeTaskStateLike | null };
  stepIndex: number;
  taskPhase?: string | null;
  taskTransition?: { kind: string } | null;
  type: 'model-thinking' | 'model-decision' | 'tools-running' | 'tool-result';
};

export type AgentRuntimeWorldResultInput = {
  status: 'budget-exceeded' | 'cancelled' | 'completed' | 'failed' | 'max-steps' | 'needs-approval' | 'needs-user';
  taskState?: AgentRuntimeTaskStateLike | null;
};

const agentRuntimeWorldController = createRuntimeWorldController();

function dispatchAgentRuntimeWorldEvent(event: RuntimeWorldEventInput) {
  const result = agentRuntimeWorldController.dispatch(event);
  if (result.presentationIntent) {
    publishRuntimeWorldPresentationIntent(result.presentationIntent);
  }

  return result;
}

function resolveTaskId(taskState?: AgentRuntimeTaskStateLike | null) {
  return taskState?.taskId ?? null;
}

export function createAgentRuntimeWorldTaskStartedEvent(): RuntimeWorldEventInput {
  return {
    kind: 'agent.task-started',
    priority: 6,
    source: 'agent',
  };
}

export function createAgentRuntimeWorldProgressEvent(
  event: AgentRuntimeWorldProgressInput,
): RuntimeWorldEventInput {
  const taskId = resolveTaskId(event.continuation.taskState);
  const approvalRequired = event.taskPhase === 'approval'
    || event.taskTransition?.kind === 'approval-required';

  return {
    kind: approvalRequired ? 'agent.approval-required' : 'agent.task-progressed',
    payload: {
      progressType: event.type,
      stepIndex: event.stepIndex,
      taskId,
      taskPhase: event.taskPhase ?? event.continuation.taskState?.phase ?? null,
      taskTransition: event.taskTransition?.kind ?? null,
    },
    priority: approvalRequired ? 8 : 5,
    source: 'agent',
  };
}

export function createAgentRuntimeWorldResultEvent(
  result: AgentRuntimeWorldResultInput,
): RuntimeWorldEventInput {
  const kind = result.status === 'completed'
    ? 'agent.task-succeeded'
    : result.status === 'needs-approval'
      ? 'agent.approval-required'
      : result.status === 'needs-user'
        ? 'agent.task-blocked'
        : result.status === 'cancelled'
          ? 'agent.task-cancelled'
          : 'agent.task-failed';

  return {
    kind,
    payload: {
      status: result.status,
      taskId: resolveTaskId(result.taskState),
      taskPhase: result.taskState?.phase ?? null,
    },
    priority: kind === 'agent.approval-required' ? 8 : 7,
    source: 'agent',
  };
}

export function getAgentRuntimeWorldController(): RuntimeWorldController {
  return agentRuntimeWorldController;
}

export function publishAgentRuntimeWorldTaskStarted() {
  return dispatchAgentRuntimeWorldEvent(createAgentRuntimeWorldTaskStartedEvent());
}

export function publishAgentRuntimeWorldProgress(event: AgentRuntimeWorldProgressInput) {
  return dispatchAgentRuntimeWorldEvent(createAgentRuntimeWorldProgressEvent(event));
}

export function publishAgentRuntimeWorldResult(result: AgentRuntimeWorldResultInput) {
  return dispatchAgentRuntimeWorldEvent(createAgentRuntimeWorldResultEvent(result));
}
