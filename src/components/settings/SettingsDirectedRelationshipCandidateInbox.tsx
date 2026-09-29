import type { CSSProperties } from 'react';
import {
  buildDirectedRelationshipCandidateGroups,
  type DirectedRelationshipCandidate,
  type DirectedRelationshipRecord,
} from '../../character-relationship';
import {
  SettingsDirectedRelationshipBatchActions,
  SettingsDirectedRelationshipCandidateActions,
} from './SettingsDirectedRelationshipCandidateActions';
import { SettingsDirectedRelationshipCandidateGroups } from './SettingsDirectedRelationshipCandidateGroups';

const REASON_LABELS: Record<string, string> = {
  'empty-evidence': '缺少证据',
  'no-dimension-change': '没有数值变化',
  'question-like': '证据是提问',
  'self-relationship': '不能建立自身关系',
  'target-not-active': '目标不在当前群聊',
  'transient-language': '临时、玩笑或测试表达',
  'valid-change-requires-review': '有效候选，等待人工审核',
};

function DeltaText({ candidate }: { candidate: DirectedRelationshipCandidate }) {
  const signed = (value: number) => value > 0 ? `+${value}` : `${value}`;
  return (
    <div className="font-mono text-2xs text-foreground">
      信任 {signed(candidate.deltas.trust)} · 亲密 {signed(candidate.deltas.intimacy)} · 警惕 {signed(candidate.deltas.vigilance)}
    </div>
  );
}

function CandidateCard(props: {
  candidate: DirectedRelationshipCandidate;
  noDragRegionStyle?: CSSProperties;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRollback: (id: string) => void;
  oppositeCandidate: boolean;
  reverseRecord?: DirectedRelationshipRecord;
}) {
  const { candidate } = props;
  const blocked = candidate.screeningDecision === 'blocked';
  return (
    <article className="space-y-2 rounded-sm border border-border bg-background/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">
          {candidate.sourceRoleName} → {candidate.targetRoleName}
        </span>
        <span className="text-2xs text-muted-foreground">
          {candidate.status === 'pending' ? (blocked ? '已阻断' : '待审核') : candidate.status === 'approved' ? '已批准' : '已拒绝'}
        </span>
      </div>
      <DeltaText candidate={candidate} />
      <p className="text-2xs leading-4 text-muted-foreground">依据：{candidate.reason || '未提供'}</p>
      <p className="rounded-sm bg-secondary/40 px-2 py-1 text-2xs leading-4 text-muted-foreground">
        证据：{candidate.evidenceExcerpt || '无'}
      </p>
      <p className="text-2xs text-muted-foreground">
        筛选：{candidate.screeningReasons.map((reason) => REASON_LABELS[reason] ?? reason).join('、')}
      </p>
      {props.reverseRecord && <p className="text-2xs text-primary/70">
        反向正式关系：信任 {props.reverseRecord.dimensions.trust} · 亲密 {props.reverseRecord.dimensions.intimacy} · 警惕 {props.reverseRecord.dimensions.vigilance}
      </p>}
      {props.oppositeCandidate && <p className="text-2xs text-amber-500">同时存在反方向待审核候选；两条关系彼此独立，请分别判断。</p>}
      <SettingsDirectedRelationshipCandidateActions {...props} candidate={candidate} />
    </article>
  );
}

export function SettingsDirectedRelationshipCandidateInbox(props: {
  candidates: DirectedRelationshipCandidate[];
  noDragRegionStyle?: CSSProperties;
  onApprove: (id: string) => void;
  onApproveAll: () => void;
  onApproveGroup: (candidateIds: string[]) => void;
  onReject: (id: string) => void;
  onRejectAll: () => void;
  onRejectGroup: (candidateIds: string[]) => void;
  onRollback: (id: string) => void;
  records: DirectedRelationshipRecord[];
}) {
  const candidates = [...props.candidates].sort((left, right) => right.createdAt - left.createdAt);
  const pending = candidates.filter((candidate) => candidate.status === 'pending');
  const approvable = pending.filter((candidate) => candidate.screeningDecision === 'manual-review');
  const groups = buildDirectedRelationshipCandidateGroups(props.candidates);
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-2xs font-semibold text-foreground">关系变化候选箱</h4>
        <p className="mt-1 text-2xs leading-4 text-muted-foreground">角色输出只会进入这里；未批准候选不会进入正式关系或角色 Context。</p>
      </div>
      <SettingsDirectedRelationshipBatchActions approvableCount={approvable.length}
        noDragRegionStyle={props.noDragRegionStyle} onApproveAll={props.onApproveAll}
        onRejectAll={props.onRejectAll} pendingCount={pending.length} />
      <SettingsDirectedRelationshipCandidateGroups groups={groups}
        noDragRegionStyle={props.noDragRegionStyle} onApproveGroup={props.onApproveGroup}
        onRejectGroup={props.onRejectGroup} />
      {candidates.length ? candidates.map((candidate) => (
        <CandidateCard key={candidate.id} candidate={candidate} noDragRegionStyle={props.noDragRegionStyle}
          onApprove={props.onApprove} onReject={props.onReject} onRollback={props.onRollback}
          reverseRecord={props.records.find((record) => record.sourceRoleId === candidate.targetRoleId
            && record.targetRoleId === candidate.sourceRoleId && record.invalidatedAt === undefined)}
          oppositeCandidate={pending.some((item) => item.id !== candidate.id
            && item.sourceRoleId === candidate.targetRoleId && item.targetRoleId === candidate.sourceRoleId)} />
      )) : <p className="rounded-sm border border-dashed border-border p-3 text-2xs text-muted-foreground">暂无关系变化候选。</p>}
    </div>
  );
}
