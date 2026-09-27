import { useEffect, useRef, useState } from 'react';
import type {
  NeuralPersonaLearningApplicationResult,
  NeuralPersonaLearningProposalCommandResult,
  NeuralPersonaLearningReversalResult,
  NeuralPersonaPersistedRecord,
} from '../../character-graph/neural-persona';
import { useNeuralPersonaLearningProposalPanelState } from './useNeuralPersonaLearningProposalPanelState';
import { createNeuralPersonaLearningApplicationAction } from './neuralPersonaLearningApplicationAction';
import { NeuralPersonaLearningProposalList } from './NeuralPersonaLearningProposalCard';

type PanelResult = NeuralPersonaLearningProposalCommandResult
  | NeuralPersonaLearningApplicationResult
  | NeuralPersonaLearningReversalResult;

type GraphMutationResult = NeuralPersonaLearningApplicationResult
  | NeuralPersonaLearningReversalResult;

function resultMessage(result: PanelResult) {
  if (result.status === 'ok' || result.status === 'idempotent') {
    if ('graphRecord' in result) {
      if ('reversalCommandId' in result.receipt) {
        return `${result.status === 'ok' ? '学习应用已安全撤销' : '撤销已经完成'}，图谱 revision ${result.graphRecord.revision}`;
      }
      return `${result.status === 'ok' ? '建议已应用' : '应用已经完成'}，图谱 revision ${result.graphRecord.revision}`;
    }
    return `操作完成，建议记录 revision ${result.record.revision}`;
  }
  if (result.status === 'conflict') return `${result.conflictScope} 版本冲突，已刷新建议记录。`;
  const labels: Record<string, string> = {
    'feedback-record-missing': '当前角色还没有反馈账本，请先记录显式反馈。',
    'learning-proposal-events-missing': '所选节点还没有可用于学习的反馈事件。',
    'learning-proposal-signal-insufficient': '反馈净信号不足，暂不生成建议。',
    'learning-application-protected-confirmation-required': '应用受保护节点建议前必须再次确认。',
    'learning-application-source-stale': '图谱或反馈账本已变化，该建议已经过期。',
    'learning-reversal-application-marker-mismatch': '应用标记已被替换，不能自动撤销，请使用图谱恢复。',
    'learning-reversal-application-marker-missing': '应用标记已丢失，不能自动撤销，请使用图谱恢复。',
    'learning-reversal-legacy-marker-unverifiable': '旧版应用标记没有数值快照，禁止自动撤销。',
    'learning-reversal-protected-confirmation-required': '撤销受保护节点的学习应用前必须再次确认。',
    'learning-reversal-values-modified': '学习数值在应用后已被修改，禁止自动减回。',
    'protected-node-confirmation-required': '接受受保护节点建议前必须显式确认。',
  };
  if ('reason' in result) return labels[result.reason] ?? `操作未完成：${result.reason}`;
  return '操作结果无法识别，请刷新后重试。';
}

async function applyAndRefresh(
  action: () => Promise<GraphMutationResult>,
  refreshProposal: () => Promise<unknown>,
  refreshGraph: () => Promise<unknown>,
) {
  const result = await action();
  await Promise.all([refreshProposal(), refreshGraph()]);
  return result;
}

function usePanelOperation(roleId: string) {
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const activeRoleId = useRef(roleId);
  activeRoleId.current = roleId;
  useEffect(() => { setBusyId(''); setMessage(''); }, [roleId]);
  const run = async (id: string, action: () => Promise<PanelResult>) => {
    setBusyId(id);
    try {
      const result = await action();
      if (activeRoleId.current === roleId) setMessage(resultMessage(result));
    } finally {
      if (activeRoleId.current === roleId) setBusyId('');
    }
  };
  return { busyId, message, run };
}

interface NeuralPersonaLearningProposalPanelProps {
  applicationEnabled: boolean;
  enabled: boolean;
  graphRecord: NeuralPersonaPersistedRecord;
  onGraphChanged: () => Promise<unknown>;
  selectedNodeId?: string;
}

export function NeuralPersonaLearningProposalPanel(
  props: NeuralPersonaLearningProposalPanelProps,
) {
  const controller = useNeuralPersonaLearningProposalPanelState(props.enabled, props.graphRecord);
  const application = createNeuralPersonaLearningApplicationAction({
    enabled: props.applicationEnabled, graphRecord: props.graphRecord,
    proposalRecord: controller.state.status === 'ready' ? controller.state.record : undefined,
  });
  const operation = usePanelOperation(props.graphRecord.roleId);
  if (!props.enabled || controller.state.status === 'disabled') return null;
  const node = props.graphRecord.graph.nodes.find((item) => item.nodeId === props.selectedNodeId);
  const blocked = !node || node.status !== 'active'
    || (node.expiresAt !== undefined && node.expiresAt <= Date.now());
  const proposals = controller.state.status === 'ready'
    ? [...controller.state.record.proposals].reverse() : [];
  const reconciliation = new Map(
    application.reconciliation?.findings.map((finding) => [
      finding.proposalId, finding.status,
    ]) ?? [],
  );
  return (
    <section className="space-y-3 rounded-sm border border-border bg-secondary/10 p-4">
      <div><div className="text-xs font-semibold">学习建议审核与应用</div><div className="text-3xs text-muted-foreground">接受只改变审核状态；“应用到图谱”是另一条显式命令，会重新校验图谱、账本、节点和保护确认。</div></div>
      <button type="button" disabled={Boolean(operation.busyId) || blocked || controller.state.status === 'loading' || controller.state.status === 'error'} onClick={() => node && void operation.run('generate', () => controller.generate(node.nodeId))} className="rounded-sm bg-primary px-3 py-1.5 text-2xs text-primary-foreground disabled:opacity-50">为所选节点生成建议</button>
      {controller.state.status === 'loading' ? <div className="text-2xs text-muted-foreground">正在读取学习建议……</div> : null}
      {controller.state.status === 'missing' ? <div className="text-2xs text-muted-foreground">尚无建议记录；打开本面板不会自动创建记录。</div> : null}
      {controller.state.status === 'error' ? <div className="text-2xs text-destructive">建议记录读取失败：{controller.state.message}</div> : null}
      <NeuralPersonaLearningProposalList
        applicationEnabled={props.applicationEnabled}
        busy={Boolean(operation.busyId)}
        proposals={proposals}
        reconciliation={reconciliation}
        onApply={(proposalId, confirmed) => void operation.run(proposalId, () => applyAndRefresh(
          () => application.apply(proposalId, confirmed), controller.refresh,
          props.onGraphChanged,
        ))}
        onReverse={(proposalId, confirmed) => void operation.run(proposalId, () => applyAndRefresh(
          () => application.reverse(proposalId, confirmed), controller.refresh,
          props.onGraphChanged,
        ))}
        onReview={(proposalId, decision, confirmed) => void operation.run(
          proposalId, () => controller.review(proposalId, decision, confirmed),
        )}
      />
      {operation.message ? <div className="text-3xs text-muted-foreground">{operation.message}</div> : null}
    </section>
  );
}
