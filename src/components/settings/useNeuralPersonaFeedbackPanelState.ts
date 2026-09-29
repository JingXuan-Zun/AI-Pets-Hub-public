import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  createNeuralPersonaDesktopStorage,
  createNeuralPersonaFeedbackCommandService,
  createNeuralPersonaGraphRepository,
  createNeuralPersonaReinforcementLedgerRepository,
  type NeuralPersonaFeedbackCommandResult,
  type NeuralPersonaFeedbackKind,
  type NeuralPersonaPersistedRecord,
  type NeuralPersonaReinforcementLedgerRecord,
} from '../../character-graph/neural-persona';

export type NeuralPersonaFeedbackPanelState =
  | { status: 'disabled' | 'loading' | 'missing' }
  | { message: string; status: 'error' }
  | { record: NeuralPersonaReinforcementLedgerRecord; status: 'ready' };

export interface NeuralPersonaFeedbackPanelDraft {
  kind: NeuralPersonaFeedbackKind;
  magnitude: number;
  nodeId: string;
  summary: string;
}

function repositories() {
  const storage = createNeuralPersonaDesktopStorage();
  return {
    graphRepository: createNeuralPersonaGraphRepository({
      config: DEFAULT_NEURAL_PERSONA_CONFIG, storage,
    }),
    ledgerRepository: createNeuralPersonaReinforcementLedgerRepository({ storage }),
  };
}

async function loadState(roleId: string): Promise<NeuralPersonaFeedbackPanelState> {
  try {
    const loaded = await repositories().ledgerRepository.load(roleId);
    if (loaded.status === 'missing') return { status: 'missing' };
    if (loaded.status === 'corrupt') return { message: loaded.reason, status: 'error' };
    return { record: loaded.record, status: 'ready' };
  } catch (error) {
    return { message: error instanceof Error ? error.message : String(error), status: 'error' };
  }
}

function commandId() {
  return `record-feedback:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
}

export function useNeuralPersonaFeedbackPanelState(
  enabled: boolean,
  graphRecord: NeuralPersonaPersistedRecord,
) {
  const [state, setState] = useState<NeuralPersonaFeedbackPanelState>(enabled
    ? { status: 'loading' } : { status: 'disabled' });
  const activeRoleId = useRef(graphRecord.roleId);
  activeRoleId.current = graphRecord.roleId;
  const refresh = useCallback(async () => {
    const roleId = graphRecord.roleId;
    const next = await loadState(roleId);
    if (activeRoleId.current === roleId) setState(next);
    return next;
  }, [graphRecord.roleId]);
  useEffect(() => {
    if (!enabled) { setState({ status: 'disabled' }); return undefined; }
    let active = true;
    setState({ status: 'loading' });
    void loadState(graphRecord.roleId).then((next) => active && setState(next));
    return () => { active = false; };
  }, [enabled, graphRecord.roleId]);
  const recordFeedback = async (
    draft: NeuralPersonaFeedbackPanelDraft,
  ): Promise<NeuralPersonaFeedbackCommandResult> => {
    if (!enabled || state.status === 'disabled' || state.status === 'loading') {
      return { reason: 'feedback-panel-not-ready', status: 'missing' };
    }
    const id = commandId();
    const roleId = graphRecord.roleId;
    const service = createNeuralPersonaFeedbackCommandService(repositories());
    const result = await service.recordFeedback({
      commandId: id,
      evidence: { sourceId: `local-ui:${id}`, sourceType: 'user-explicit',
        summary: draft.summary },
      expectedGraphRevision: graphRecord.revision,
      expectedLedgerRevision: state.status === 'ready' ? state.record.revision : null,
      kind: draft.kind,
      magnitude: draft.magnitude,
      nodeId: draft.nodeId,
      occurredAt: Date.now(),
      roleId,
    });
    if (activeRoleId.current !== roleId) return result;
    if (result.status === 'ok' || result.status === 'idempotent') {
      setState({ record: result.record, status: 'ready' });
    } else if (result.status === 'conflict') await refresh();
    return result;
  };
  return { recordFeedback, refresh, state };
}
