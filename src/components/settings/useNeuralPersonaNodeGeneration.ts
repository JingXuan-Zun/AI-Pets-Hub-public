import { useEffect, useRef, useState } from 'react';
import {
  requestNeuralPersonaNodeGeneration,
  type NeuralPersonaNodeBatchCommandResult,
  type NeuralPersonaNodeGenerationBatch,
  type NeuralPersonaNodeGenerationCandidate,
  type NeuralPersonaPersistedRecord,
} from '../../character-graph/neural-persona';
import {
  createNeuralPersonaConfiguredNodeGenerationProvider,
  NEURAL_PERSONA_NODE_GENERATION_CONCURRENCY,
  resolveNeuralPersonaNodeGenerationOverallTimeoutMs,
  resolveNeuralPersonaNodeGenerationTimeoutMs,
} from '../../services/neuralPersonaConfiguredNodeGenerationProvider';
import {
  pushFrontendRuntimeError,
  pushFrontendRuntimeLog,
} from '../../frontendRuntimeLogger';
import type { PetConfig, PetPersonality } from '../../types';
import { completeGeneratedNodeRelationshipAnalysis } from '../../services/neuralPersonaGeneratedNodeRelationshipAnalysis';
import {
  buildCurrentPersonalitySource,
  neuralPersonaNodeGenerationMessage,
} from './neuralPersonaNodeGenerationUi';
import {
  addGeneratedNodeCandidate,
  removeGeneratedNodeCandidate,
  removeGeneratedRelationshipCandidate,
  updateGeneratedNodeCandidate,
  updateGeneratedRelationshipCandidate,
} from './neuralPersonaNodeGenerationCandidateActions';
function id(prefix: string) {
  return `${prefix}:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
}
interface GenerationOptions {
  onCommit: (batch: NeuralPersonaNodeGenerationBatch) => Promise<NeuralPersonaNodeBatchCommandResult>;
  personality: PetPersonality;
  record?: NeuralPersonaPersistedRecord;
  roleId: string;
  settings: PetConfig['settings'];
}
type ActiveRequestRef = { current: AbortController | undefined };
function abortActiveRequest(activeRequest: ActiveRequestRef) {
  const controller = activeRequest.current;
  activeRequest.current = undefined;
  controller?.abort();
}
function useGenerationState(roleId: string, dataEgressConsent: boolean) {
  const [batch, setBatch] = useState<NeuralPersonaNodeGenerationBatch>();
  const [busy, setBusy] = useState<'committing' | 'generating' | null>(null);
  const [committed, setCommitted] = useState(false);
  const [message, setMessage] = useState('');
  const [sourceText, setSourceText] = useState('');
  const activeRequest = useRef<AbortController | undefined>(undefined);
  const activeRoleId = useRef(roleId);
  activeRoleId.current = roleId;
  useEffect(() => {
    abortActiveRequest(activeRequest);
    setBatch(undefined); setBusy(null); setCommitted(false);
    setMessage(''); setSourceText('');
  }, [roleId]);
  useEffect(() => {
    if (!dataEgressConsent) {
      abortActiveRequest(activeRequest);
      setBusy(null);
    }
  }, [dataEgressConsent]);
  useEffect(() => () => abortActiveRequest(activeRequest), []);
  return {
    activeRequest, activeRoleId, batch, busy, committed, message, setBatch, setBusy,
    setCommitted, setMessage, setSourceText, sourceText,
  };
}
type GenerationState = ReturnType<typeof useGenerationState>;
function generationSuccessMessage(
  result: Extract<Awaited<ReturnType<typeof requestNeuralPersonaNodeGeneration>>, { status: 'ok' }>,
) {
  if (result.recovery?.mode === 'source-fallback') {
    return `模型返回格式异常，已按完整原文语义块保真拆出 ${result.batch.candidates.length} 个候选节点，请检查后确认。`;
  }
  if (result.recovery?.mode === 'partial') {
    const reasons = result.recovery.rejectionReasons ?? {};
    const timeoutCount = (reasons['persona-node-generation-timeout'] ?? 0)
      + (reasons['persona-node-generation-overall-timeout'] ?? 0);
    const formatCount = reasons['persona-node-generation-json-invalid'] ?? 0;
    const details = [timeoutCount ? `超时 ${timeoutCount} 个` : '',
      formatCount ? `格式异常 ${formatCount} 个` : ''].filter(Boolean).join('，');
    return `已保留 ${result.batch.candidates.length} 个原文语义块；其中 ${result.recovery.rejectedCandidateCount} 个未获得有效模型分类，已使用安全分类${details ? `（${details}）` : ''}，请检查后确认。`;
  }
  return `已完整覆盖并分类 ${result.batch.candidates.length} 个原文语义块，请检查后确认。`;
}
function generationDiagnostics(
  options: GenerationOptions,
  state: GenerationState,
  requestTimeoutMs: number,
  overallTimeoutMs: number,
) {
  return {
    configuredTimeoutMs: options.settings.neuralPersonaProviderTimeoutMs,
    consent: options.settings.neuralPersonaProviderDataEgressConsent,
    provider: options.settings.llmProvider,
    overallTimeoutMs,
    requestTimeoutMs,
    roleId: options.roleId,
    sourceCharacters: state.sourceText.length,
    textCapability: options.settings.customModelCapabilities.text,
  };
}
function applyGenerationResult(
  result: Awaited<ReturnType<typeof requestNeuralPersonaNodeGeneration>>,
  state: GenerationState,
  diagnostics: ReturnType<typeof generationDiagnostics>,
) {
  if (result.status === 'ok') {
    state.setBatch(result.batch);
    state.setMessage(generationSuccessMessage(result));
  } else state.setMessage(neuralPersonaNodeGenerationMessage(result.reason));
  pushFrontendRuntimeLog('神经人格节点生成', `智能解析请求结束：${result.status}`, {
    ...diagnostics,
    candidateCount: result.status === 'ok' ? result.batch.candidates.length : 0,
    reason: result.status === 'ok' ? null : result.reason,
    recoveryMode: result.status === 'ok' ? result.recovery?.mode ?? null : null,
    rejectedCandidateCount: result.status === 'ok'
      ? result.recovery?.rejectedCandidateCount ?? 0 : 0,
    rejectionReasons: result.status === 'ok'
      ? result.recovery?.rejectionReasons ?? null : null,
  });
}
function configuredGenerationProvider(options: GenerationOptions) {
  return createNeuralPersonaConfiguredNodeGenerationProvider({
    dataEgressConsent: options.settings.neuralPersonaProviderDataEgressConsent,
    settings: options.settings,
  });
}
async function runGeneratedRelationshipAnalysis(options: GenerationOptions, state: GenerationState, result: Extract<Awaited<ReturnType<typeof requestNeuralPersonaNodeGeneration>>, { status: 'ok' }>, controller: AbortController) {
  state.setMessage(`已生成 ${result.batch.candidates.length} 个节点候选，正在分析候选节点之间的语义关系……`);
  state.setBatch({
    ...result.batch,
    relationshipAnalysis: {
      candidates: [], providerId: 'relationship-analysis-pending', status: 'pending',
    },
  });
  const completed = await completeGeneratedNodeRelationshipAnalysis({
    batch: result.batch, record: options.record,
    settings: options.settings, signal: controller.signal,
  });
  if (state.activeRequest.current === controller) {
    state.setBatch(completed.batch); state.setMessage(completed.message);
  }
}
function useGenerateAction(options: GenerationOptions, state: GenerationState) {
  const generate = async () => {
    abortActiveRequest(state.activeRequest);
    const controller = new AbortController();
    state.activeRequest.current = controller;
    state.setBusy('generating'); state.setCommitted(false);
    const requestTimeoutMs = resolveNeuralPersonaNodeGenerationTimeoutMs(
      options.settings.neuralPersonaProviderTimeoutMs,
      state.sourceText.length,
    );
    const overallTimeoutMs = resolveNeuralPersonaNodeGenerationOverallTimeoutMs(
      state.sourceText.length,
    );
    state.setMessage(`已收到解析请求，最多 ${NEURAL_PERSONA_NODE_GENERATION_CONCURRENCY} 批并行，总等待上限 ${overallTimeoutMs / 1000} 秒…`);
    const diagnostics = generationDiagnostics(
      options, state, requestTimeoutMs, overallTimeoutMs,
    );
    pushFrontendRuntimeLog('神经人格节点生成', '智能解析请求已开始', diagnostics);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const provider = configuredGenerationProvider(options);
    try {
      const result = await requestNeuralPersonaNodeGeneration({
        provider,
        request: {
          batchId: id('persona-import'), now: Date.now(), requestId: id('generate-nodes'),
          onProgress: ({ completedBatches, totalBatches }) => {
            if (state.activeRequest.current !== controller) return;
            state.setMessage(`正在并行分析：已完成 ${completedBatches}/${totalBatches} 批，总等待上限 ${overallTimeoutMs / 1000} 秒。`);
          },
          personaName: options.personality.name, roleId: options.roleId,
          signal: controller.signal, sourceText: state.sourceText,
        },
      });
      if (state.activeRequest.current !== controller) return;
      applyGenerationResult(result, state, diagnostics);
      if (result.status === 'ok') {
        await runGeneratedRelationshipAnalysis(options, state, result, controller);
      }
    } catch (error) {
      if (state.activeRequest.current !== controller) return;
      state.setMessage('人格解析发生未预期错误，请查看运行日志。');
      pushFrontendRuntimeError('神经人格节点生成', '智能解析请求异常', error, diagnostics);
    } finally {
      if (state.activeRequest.current === controller) {
        state.activeRequest.current = undefined;
        state.setBusy(null);
      }
    }
  };
  return generate;
}
function useCancelAction(options: GenerationOptions, state: GenerationState) {
  return () => {
    if (state.busy !== 'generating' || !state.activeRequest.current) return;
    abortActiveRequest(state.activeRequest);
    state.setBusy(null); state.setMessage('本次解析已取消。');
    pushFrontendRuntimeLog('神经人格节点生成', '用户取消智能解析', {
      provider: options.settings.llmProvider,
      roleId: options.roleId,
      sourceCharacters: state.sourceText.length,
    });
  };
}
function useCandidateActions(state: GenerationState) {
  const updateCandidate = (
    candidateId: string,
    patch: Partial<NeuralPersonaNodeGenerationCandidate>,
  ) => {
    state.setCommitted(false);
    state.setBatch((current) => current
      ? updateGeneratedNodeCandidate(current, candidateId, patch) : current);
  };

  const removeCandidate = (candidateId: string) => {
    state.setCommitted(false);
    state.setBatch((current) => current
      ? removeGeneratedNodeCandidate(current, candidateId) : current);
  };

  const addCandidate = () => {
    state.setCommitted(false);
    state.setBatch((current) => current ? addGeneratedNodeCandidate(current) : current);
  };
  const updateRelationshipCandidate = (candidateId: string, patch: Parameters<
    typeof updateGeneratedRelationshipCandidate
  >[2]) => state.setBatch((current) => current
    ? updateGeneratedRelationshipCandidate(current, candidateId, patch) : current);
  const removeRelationshipCandidate = (candidateId: string) => state.setBatch(
    (current) => current
      ? removeGeneratedRelationshipCandidate(current, candidateId) : current,
  );
  return {
    addCandidate, removeCandidate, removeRelationshipCandidate,
    updateCandidate, updateRelationshipCandidate,
  };
}
function useRetryRelationshipAnalysis(options: GenerationOptions, state: GenerationState) {
  return async () => {
    if (!state.batch || state.busy) return;
    const controller = new AbortController();
    state.activeRequest.current = controller; state.setBusy('generating');
    try {
      const completed = await completeGeneratedNodeRelationshipAnalysis({
        batch: state.batch, record: options.record,
        settings: options.settings, signal: controller.signal,
      });
      if (state.activeRequest.current === controller) {
        state.setBatch(completed.batch); state.setMessage(completed.message);
      }
    } finally {
      if (state.activeRequest.current === controller) {
        state.activeRequest.current = undefined; state.setBusy(null);
      }
    }
  };
}
function useCommitAction(options: GenerationOptions, state: GenerationState) {
  const commit = async () => {
    if (!state.batch) return;
    const committedRoleId = state.batch.roleId;
    state.setBusy('committing'); state.setMessage('');
    const result = await options.onCommit(state.batch);
    if (state.activeRoleId.current !== committedRoleId) return;
    state.setBusy(null);
    if (result.status === 'ok') {
      state.setCommitted(true);
      state.setMessage(`已新增 ${result.receipt.generatedNodeIds.length} 个内容节点和 ${result.receipt.generatedBranchNodeIds.length} 个分支节点，复用 ${result.receipt.reusedNodeIds.length} 个现有节点，并在一次事务中写入 ${result.receipt.generatedEdgeIds.length} 条层级边和 ${result.receipt.generatedSemanticEdgeIds.length} 条语义边。`);
    } else state.setMessage(neuralPersonaNodeGenerationMessage(
      result.status === 'conflict' ? '图谱已被更新，请重新确认。' : result.reason,
    ));
  };
  return commit;
}

export function useNeuralPersonaNodeGeneration(options: GenerationOptions) {
  const state = useGenerationState(
    options.roleId, options.settings.neuralPersonaProviderDataEgressConsent,
  );
  const actions = useCandidateActions(state);
  const generate = useGenerateAction(options, state);
  const cancel = useCancelAction(options, state);
  const commit = useCommitAction(options, state);
  const retryRelationshipAnalysis = useRetryRelationshipAnalysis(options, state);
  const useCurrentPersonality = () => {
    state.setSourceText(buildCurrentPersonalitySource(options.personality));
    state.setBatch(undefined); state.setCommitted(false); state.setMessage('');
  };
  const updateSourceText = (value: string) => {
    state.setSourceText(value); state.setBatch(undefined);
    state.setCommitted(false); state.setMessage('');
  };
  return {
    ...actions, batch: state.batch, busy: state.busy, cancel, commit,
    committed: state.committed, generate, message: state.message,
    retryRelationshipAnalysis,
    sourceText: state.sourceText, updateSourceText, useCurrentPersonality,
  };
}
