import type {
  NeuralPersonaReinforcementLedgerRecord,
  NeuralPersonaReinforcementProjection,
} from './neuralPersonaFeedbackTypes';
import { replayNeuralPersonaReinforcementLedger } from './neuralPersonaReinforcementProjection';
import type { NeuralPersonaGraphSnapshot, NeuralPersonaNodeStatus } from './neuralPersonaTypes';

export interface NeuralPersonaFeedbackInspectionNode {
  decayRatePerDay: number;
  influenceSummary?: string;
  nodeId: string;
  nodeStatus: NeuralPersonaNodeStatus | 'missing';
  projection: NeuralPersonaReinforcementProjection;
}

export interface NeuralPersonaFeedbackInspection {
  ledgerRevision: number;
  nodes: NeuralPersonaFeedbackInspectionNode[];
  projectedAt: number;
  roleId: string;
}

function compareText(left: string, right: string) {
  return left === right ? 0 : left < right ? -1 : 1;
}

function inspectNode(
  graph: NeuralPersonaGraphSnapshot,
  ledger: NeuralPersonaReinforcementLedgerRecord,
  nodeId: string,
  projectedAt: number,
): NeuralPersonaFeedbackInspectionNode {
  const node = graph.nodes.find((item) => item.nodeId === nodeId);
  const events = ledger.events.filter((event) => event.nodeId === nodeId);
  const [projection] = replayNeuralPersonaReinforcementLedger(
    { ...ledger, events },
    { decayRatePerDay: node?.decayRate ?? 0, projectedAt },
  );
  return Object.freeze({
    decayRatePerDay: node?.decayRate ?? 0,
    influenceSummary: node?.influenceSummary,
    nodeId,
    nodeStatus: node?.status ?? 'missing',
    projection,
  });
}

export function createNeuralPersonaFeedbackInspection(
  graph: NeuralPersonaGraphSnapshot,
  ledger: NeuralPersonaReinforcementLedgerRecord,
  projectedAt: number,
): NeuralPersonaFeedbackInspection {
  if (graph.roleId !== ledger.roleId) throw new Error('feedback-inspection-role-mismatch');
  const nodeIds = [...new Set(ledger.events.map((event) => event.nodeId))].sort(compareText);
  return Object.freeze({
    ledgerRevision: ledger.revision,
    nodes: Object.freeze(nodeIds.map((nodeId) => (
      inspectNode(graph, ledger, nodeId, projectedAt)
    ))) as NeuralPersonaFeedbackInspectionNode[],
    projectedAt,
    roleId: graph.roleId,
  });
}
