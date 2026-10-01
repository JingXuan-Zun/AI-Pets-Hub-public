import {
  assertAgentToolOutcomeContract,
  type AgentToolOutcomeContract,
} from './agentToolOutcomeContract.ts';

export type AgentCanonicalEventType =
  | 'task_started'
  | 'approval_requested'
  | 'approval_granted'
  | 'tool_requested'
  | 'tool_resulted'
  | 'evidence_collected'
  | 'verification_completed'
  | 'recovery_started'
  | 'task_completed'
  | 'task_failed'
  | 'task_cancelled'
  | 'checkpoint';

export interface AgentCanonicalEventPayload {
  [key: string]: unknown;
}

export interface AgentCanonicalEvent {
  id: string;
  payload: AgentCanonicalEventPayload;
  revision: number;
  runId: string;
  taskId: string;
  timestamp: number;
  type: AgentCanonicalEventType;
}

export interface AgentCanonicalToolResultPayload extends AgentCanonicalEventPayload {
  outcome: AgentToolOutcomeContract;
  tool: string;
}

export interface AgentCanonicalTaskProjection {
  latestOutcome: AgentToolOutcomeContract | null;
  phase: 'active' | 'approval' | 'recovering' | 'terminal';
  revision: number;
  runId: string | null;
  state: 'active' | 'waiting_approval' | 'succeeded' | 'failed' | 'cancelled';
  taskId: string;
}

export interface AppendAgentCanonicalEventInput {
  payload?: AgentCanonicalEventPayload;
  runId: string;
  taskId: string;
  timestamp?: number;
  type: AgentCanonicalEventType;
}

let journalNonce = 0;

function nextEventId(timestamp: number) {
  journalNonce = (journalNonce + 1) % 1_000_000_000;
  return `event-${timestamp}-${journalNonce || 1}`;
}

function requireId(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function clonePayload(payload: AgentCanonicalEventPayload | undefined) {
  return structuredClone(payload ?? {});
}

export class AgentCanonicalEventJournal {
  private readonly events: AgentCanonicalEvent[] = [];

  private normalizeEvent(input: AppendAgentCanonicalEventInput, revision: number): AgentCanonicalEvent {
    const taskId = requireId(input.taskId, 'taskId');
    const runId = requireId(input.runId, 'runId');
    const timestamp = Number.isFinite(input.timestamp) ? Number(input.timestamp) : Date.now();
    const event: AgentCanonicalEvent = {
      id: nextEventId(timestamp),
      payload: clonePayload(input.payload),
      revision,
      runId,
      taskId,
      timestamp,
      type: input.type,
    };
    if (event.type === 'tool_resulted') {
      const outcome = event.payload.outcome;
      if (!outcome || typeof outcome !== 'object') {
        throw new Error('tool_resulted requires an outcome payload.');
      }
      assertAgentToolOutcomeContract(outcome as AgentToolOutcomeContract);
    }
    return event;
  }

  append(input: AppendAgentCanonicalEventInput): AgentCanonicalEvent {
    const event = this.normalizeEvent(input, this.events.length + 1);
    this.events.push(event);
    return { ...event, payload: clonePayload(event.payload) };
  }

  appendBatch(inputs: AppendAgentCanonicalEventInput[]) {
    const appended = inputs.map((input, index) => (
      this.normalizeEvent(input, this.events.length + index + 1)
    ));
    this.events.push(...appended);
    return appended.map((event) => ({ ...event, payload: clonePayload(event.payload) }));
  }

  snapshot() {
    return this.events.map((event) => ({ ...event, payload: clonePayload(event.payload) }));
  }

  listTaskEvents(taskId: string) {
    const normalizedTaskId = requireId(taskId, 'taskId');
    return this.snapshot().filter((event) => event.taskId === normalizedTaskId);
  }

  projectTask(taskId: string): AgentCanonicalTaskProjection {
    const events = this.listTaskEvents(taskId);
    const latest = events[events.length - 1] ?? null;
    let state: AgentCanonicalTaskProjection['state'] = 'active';
    let phase: AgentCanonicalTaskProjection['phase'] = 'active';
    let latestOutcome: AgentToolOutcomeContract | null = null;
    for (const event of events) {
      if (event.type === 'approval_requested') {
        phase = 'approval';
        state = 'waiting_approval';
      }
      if (event.type === 'approval_granted') {
        phase = 'active';
        state = 'active';
      }
      if (event.type === 'recovery_started') phase = 'recovering';
      if (event.type === 'tool_resulted') latestOutcome = event.payload.outcome as AgentToolOutcomeContract;
      if (event.type === 'task_completed') { state = 'succeeded'; phase = 'terminal'; }
      if (event.type === 'task_failed') { state = 'failed'; phase = 'terminal'; }
      if (event.type === 'task_cancelled') { state = 'cancelled'; phase = 'terminal'; }
    }
    return {
      latestOutcome,
      phase,
      revision: latest?.revision ?? 0,
      runId: latest?.runId ?? null,
      state,
      taskId: requireId(taskId, 'taskId'),
    };
  }
}
