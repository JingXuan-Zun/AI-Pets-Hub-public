import { Check, RotateCcw, X } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import type {
  GroupMemoryCandidate,
  GroupMemoryCandidateReviewReceipt,
  GroupMemoryRepositoryData,
} from '../../group-memory';
import {
  CURRENT_GROUP_MEMORY_GROUP_ID,
  evaluateGroupMemoryCandidateEvidence,
  getWritableGroupMemoryGroupOptions,
  type GroupMemoryCandidateScreeningReason,
} from '../../group-memory';
import { Button } from '../../../components/ui/button';

export interface GroupMemoryCandidateActions {
  approve: (candidateId: string, groupId: string) => void;
  feedback: string;
  reject: (candidateId: string) => void;
  rollback: (candidateId: string) => void;
}

const STATUS_LABELS: Record<GroupMemoryCandidate['status'], string> = {
  approved: '已批准',
  pending: '待审核',
  rejected: '已拒绝',
};

const SCREENING_LABELS: Record<GroupMemoryCandidateScreeningReason, string> = {
  'candidate-invalidated': '候选记录已经失效',
  'discussion-requires-review': '普通讨论需要人工判断',
  'empty-evidence': '证据为空',
  'evidence-source-mismatch': '证据来源不一致',
  'evidence-topic-mismatch': '证据 Topic 不一致',
  'question-like': '问题句不应自动记忆',
  'role-perspective-requires-review': '角色观点需要人工判断',
  'speculative-language': '包含推测性表达',
  'transient-language': '包含临时或测试表达',
  'unsupported-verified-fact': '任务证据不足以支持事实',
  'verified-task-result': '实际任务结果符合候选基础条件',
};

function CandidateScreeningSummary({ candidate }: { candidate: GroupMemoryCandidate }) {
  const screening = evaluateGroupMemoryCandidateEvidence(candidate);
  const tone = screening.decision === 'eligible' ? 'text-emerald-700'
    : screening.decision === 'blocked' ? 'text-destructive' : 'text-amber-700';
  return (
    <div className={`text-3xs leading-4 ${tone}`}>
      规则筛选：{screening.reasons.map((reason) => SCREENING_LABELS[reason]).join('；')}
    </div>
  );
}

function CandidateActions({
  actions,
  candidate,
  noDragRegionStyle,
  repository,
}: {
  actions: GroupMemoryCandidateActions;
  candidate: GroupMemoryCandidate;
  noDragRegionStyle?: CSSProperties;
  repository: GroupMemoryRepositoryData;
}) {
  if (candidate.status !== 'pending') {
    return (
      <Button
        type="button" variant="outline" size="sm" style={noDragRegionStyle}
        onClick={() => actions.rollback(candidate.id)}
        className="h-7 rounded-full px-2 text-2xs"
      >
        <RotateCcw className="mr-1 h-3 w-3" />撤销审核
      </Button>
    );
  }
  return <CandidateApprovalControls
    actions={actions} candidate={candidate} noDragRegionStyle={noDragRegionStyle}
    repository={repository}
  />;
}

function CandidateApprovalControls({
  actions, candidate, noDragRegionStyle, repository,
}: {
  actions: GroupMemoryCandidateActions;
  candidate: GroupMemoryCandidate;
  noDragRegionStyle?: CSSProperties;
  repository: GroupMemoryRepositoryData;
}) {
  const [groupId, setGroupId] = useState(CURRENT_GROUP_MEMORY_GROUP_ID);
  const groupOptions = getWritableGroupMemoryGroupOptions(repository);
  const writable = groupOptions.some((group) => group.id === groupId);
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <select aria-label="候选写入目标组" value={groupId}
        onChange={(event) => setGroupId(event.target.value)} style={noDragRegionStyle}
        className="h-7 max-w-32 rounded-full border border-border bg-secondary px-2 text-2xs">
        {groupOptions.map((group) => (
          <option key={group.id} value={group.id}>{group.name}</option>
        ))}
      </select>
      <Button
        type="button" variant="outline" size="sm" style={noDragRegionStyle}
        onClick={() => actions.reject(candidate.id)}
        className="h-7 rounded-full px-2 text-2xs text-destructive"
      >
        <X className="mr-1 h-3 w-3" />拒绝
      </Button>
      <Button
        type="button" size="sm" style={noDragRegionStyle} disabled={!writable}
        onClick={() => actions.approve(candidate.id, groupId)}
        className="h-7 rounded-full px-2 text-2xs"
      >
        <Check className="mr-1 h-3 w-3" />批准写入
      </Button>
    </div>
  );
}

function CandidateCard({
  actions,
  candidate,
  noDragRegionStyle,
  repository,
  reviewReceipt,
}: {
  actions: GroupMemoryCandidateActions;
  candidate: GroupMemoryCandidate;
  noDragRegionStyle?: CSSProperties;
  repository: GroupMemoryRepositoryData;
  reviewReceipt?: GroupMemoryCandidateReviewReceipt;
}) {
  return (
    <article className="space-y-2 rounded-sm border border-border bg-background/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="text-2xs font-medium text-foreground">
            {STATUS_LABELS[candidate.status]} · {candidate.proposedRecord.kind}
          </span>
          <div className="mt-1 break-all font-mono text-3xs text-muted-foreground">
            {candidate.id}
          </div>
        </div>
        <CandidateActions
          actions={actions} candidate={candidate} noDragRegionStyle={noDragRegionStyle}
          repository={repository}
        />
      </div>
      <p className="text-xs leading-5 text-foreground">{candidate.proposedRecord.summary}</p>
      <CandidateScreeningSummary candidate={candidate} />
      <div className="rounded-sm border border-dashed border-border px-2 py-2 text-3xs leading-4 text-muted-foreground">
        证据：{candidate.evidence.kind} · 消息 {candidate.evidence.sourceMessageId} ·{' '}
        来源 {candidate.evidence.sourceRoleId}<br />
        {candidate.evidence.excerpt}
      </div>
      {reviewReceipt ? (
        <div className="break-all font-mono text-3xs text-primary">
          审核回执：{reviewReceipt.id}
        </div>
      ) : null}
    </article>
  );
}

function getCandidateStats(repository: GroupMemoryRepositoryData) {
  return {
    archivedCount: repository.candidateArchives.reduce(
      (total, archive) => total + archive.candidateCount, 0,
    ),
    pendingCount: repository.candidates.filter((candidate) => candidate.status === 'pending').length,
  };
}

export function SettingsGroupMemoryCandidateInbox({
  actions,
  noDragRegionStyle,
  repository,
}: {
  actions: GroupMemoryCandidateActions;
  noDragRegionStyle?: CSSProperties;
  repository: GroupMemoryRepositoryData;
}) {
  const candidates = [...repository.candidates].sort((left, right) => (
    Number(left.status !== 'pending') - Number(right.status !== 'pending')
      || right.createdAt - left.createdAt
  ));
  const { archivedCount, pendingCount } = getCandidateStats(repository);
  const latestReceiptByCandidate = new Map<string, GroupMemoryCandidateReviewReceipt>();
  repository.candidateReviewReceipts.forEach((receipt) => {
    latestReceiptByCandidate.set(receipt.candidateId, receipt);
  });
  return (
    <details className="rounded-sm border border-amber-500/30 bg-amber-500/5 px-3 py-2">
      <summary className="cursor-pointer text-2xs text-amber-700">
        长期记忆候选箱（待审核 {pendingCount}，共 {candidates.length}）
      </summary>
      <p className="mt-2 text-3xs leading-4 text-muted-foreground">
        候选不会进入角色上下文；只有用户点击“批准写入”后才成为正式群体记忆。
      </p>
      <p className="mt-1 text-3xs leading-4 text-muted-foreground">
        活动候选 {candidates.length} 条；已压缩归档 {archivedCount} 条。归档仅供审计，不可回滚。
      </p>
      {actions.feedback ? (
        <p className="mt-2 rounded-sm border border-border bg-background/50 px-2 py-1 text-3xs text-foreground">
          {actions.feedback}
        </p>
      ) : null}
      <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
        {candidates.length ? candidates.map((candidate) => (
          <CandidateCard
            actions={actions} candidate={candidate} key={candidate.id}
            noDragRegionStyle={noDragRegionStyle}
            repository={repository}
            reviewReceipt={latestReceiptByCandidate.get(candidate.id)}
          />
        )) : (
          <div className="py-4 text-center text-2xs text-muted-foreground">暂无候选。</div>
        )}
      </div>
    </details>
  );
}
