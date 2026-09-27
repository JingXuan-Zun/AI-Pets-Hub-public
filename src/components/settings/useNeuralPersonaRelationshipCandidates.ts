import { useEffect, useRef, useState } from 'react';
import {
  generateNeuralPersonaRelationshipCandidates,
  type NeuralPersonaPersistedRecord,
  type NeuralPersonaRelationshipBatchCommandResult,
  type NeuralPersonaRelationshipCandidate,
  type NeuralPersonaRelationshipCandidateBatch,
} from '../../character-graph/neural-persona';
import { createNeuralPersonaConfiguredRelationshipCandidateProvider } from '../../services/neuralPersonaConfiguredRelationshipCandidateProvider';
import {
  neuralPersonaRelationshipFailureMessage,
  resolveNeuralPersonaRelationshipTimeoutMs,
} from '../../services/neuralPersonaRelationshipRequestPolicy';
import type { PetConfig } from '../../types';

type CommitAction = (
  batch: NeuralPersonaRelationshipCandidateBatch,
) => Promise<NeuralPersonaRelationshipBatchCommandResult>;
type RelationshipBusy = 'committing' | 'generating' | null;
interface RelationshipOptions {
  onCommit: CommitAction;
  record: NeuralPersonaPersistedRecord;
  settings: PetConfig['settings'];
}

function id(prefix: string) {
  return `${prefix}:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
}

function editableNodeIds(record: NeuralPersonaPersistedRecord) {
  return record.graph.nodes.filter((node) => node.status === 'active' && !node.protected
    && !['persona-anchor', 'cognitive-domain', 'cognitive-topic'].includes(node.type))
    .map((node) => node.nodeId);
}

function userCandidate(record: NeuralPersonaPersistedRecord): NeuralPersonaRelationshipCandidate | null {
  const nodeIds = editableNodeIds(record);
  if (nodeIds.length < 2) return null;
  return {
    candidateId: id('manual-relationship'), confidence: 0.8, enabled: true,
    origin: 'user', reason: '用户手动建立的认知关系', relationType: 'associated-with',
    sourceNodeId: nodeIds[0], targetNodeId: nodeIds[1], weight: 0.7,
  };
}

function resultMessage(result: NeuralPersonaRelationshipBatchCommandResult) {
  if (result.status === 'ok') return `已写入 ${result.receipt.generatedEdgeIds.length} 条认知关系。`;
  if (result.status === 'conflict') return '图谱已发生变化，候选未写入，请重新生成。';
  return `关系写入失败：${result.reason}`;
}

function useRelationshipState(roleId: string) {
  const [batch, setBatch] = useState<NeuralPersonaRelationshipCandidateBatch | null>(null);
  const [busy, setBusy] = useState<RelationshipBusy>(null);
  const [message, setMessage] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const roleRef = useRef(roleId); roleRef.current = roleId;
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    setBatch(null); setMessage(''); abortRef.current?.abort();
  }, [roleId]);
  return { abortRef, batch, busy, message, roleRef, setBatch, setBusy, setMessage };
}

function configuredProvider(options: RelationshipOptions) {
  return createNeuralPersonaConfiguredRelationshipCandidateProvider({
    dataEgressConsent: options.settings.neuralPersonaProviderDataEgressConsent,
    settings: options.settings,
    timeoutMs: resolveNeuralPersonaRelationshipTimeoutMs(
      editableNodeIds(options.record).length,
      options.settings.neuralPersonaProviderTimeoutMs,
    ),
  });
}

function useGenerateAction(
  options: RelationshipOptions,
  state: ReturnType<typeof useRelationshipState>,
) {
  return async () => {
    const roleId = options.record.roleId;
    const abort = new AbortController();
    state.abortRef.current?.abort(); state.abortRef.current = abort;
    state.setBusy('generating'); state.setMessage('正在分析节点之间的认知关系……');
    const result = await generateNeuralPersonaRelationshipCandidates({
      batchId: id('relationship-batch'), edges: options.record.graph.edges,
      graphVersion: options.record.graph.graphVersion, nodes: options.record.graph.nodes,
      now: Date.now(), provider: configuredProvider(options),
      revision: options.record.revision, roleId, signal: abort.signal,
    });
    if (state.roleRef.current !== roleId || abort.signal.aborted) return;
    state.setBusy(null);
    if (result.status === 'ok') {
      state.setBatch(result.batch);
      state.setMessage(`已生成 ${result.batch.candidates.length} 条待审核关系。`);
    } else state.setMessage(`关系分析未完成：${neuralPersonaRelationshipFailureMessage(result.reason)}`);
  };
}

function createManualBatch(
  record: NeuralPersonaPersistedRecord,
  candidate: NeuralPersonaRelationshipCandidate,
): NeuralPersonaRelationshipCandidateBatch {
  return {
    batchId: id('relationship-batch'), candidates: [candidate], generatedAt: Date.now(),
    graphVersion: record.graph.graphVersion, providerId: 'local-user',
    revision: record.revision, roleId: record.roleId,
    version: 'neural-persona-relationship-candidate.v1',
  };
}

function useCandidateActions(
  record: NeuralPersonaPersistedRecord,
  state: ReturnType<typeof useRelationshipState>,
) {
  const update = (candidateId: string, patch: Partial<NeuralPersonaRelationshipCandidate>) => {
    state.setBatch((current) => current ? { ...current, candidates: current.candidates.map(
      (candidate) => candidate.candidateId === candidateId ? { ...candidate, ...patch } : candidate,
    ) } : current);
  };
  const remove = (candidateId: string) => state.setBatch((current) => current ? {
    ...current, candidates: current.candidates.filter((item) => item.candidateId !== candidateId),
  } : current);
  const add = () => {
    const candidate = userCandidate(record);
    if (!candidate) return;
    state.setBatch((current) => current ? {
      ...current, candidates: [...current.candidates, candidate],
    } : createManualBatch(record, candidate));
  };
  return { add, remove, update };
}

function useCommitAction(options: RelationshipOptions, state: ReturnType<typeof useRelationshipState>) {
  return async () => {
    if (!state.batch || state.busy) return;
    state.setBusy('committing');
    const result = await options.onCommit(state.batch);
    state.setBusy(null); state.setMessage(resultMessage(result));
    if (result.status === 'ok') state.setBatch(null);
  };
}

export function useNeuralPersonaRelationshipCandidates(options: RelationshipOptions) {
  const state = useRelationshipState(options.record.roleId);
  const actions = useCandidateActions(options.record, state);
  const generate = useGenerateAction(options, state);
  const commit = useCommitAction(options, state);
  const cancel = () => {
    state.abortRef.current?.abort(); state.setBusy(null); state.setMessage('已取消关系分析。');
  };
  return { ...actions, batch: state.batch, busy: state.busy, cancel, commit,
    generate, message: state.message };
}
