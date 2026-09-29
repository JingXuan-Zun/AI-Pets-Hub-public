import { AlertTriangle, GitCompareArrows } from 'lucide-react';
import { useMemo, type CSSProperties } from 'react';
import {
  detectGroupMemoryConflictCandidates,
  validateGroupMemoryIntegrity,
  type GroupMemoryConflictReason,
  type GroupMemoryIntegrityIssueKind,
  type GroupMemoryRepositoryData,
} from '../../group-memory';
import { Button } from '../../../components/ui/button';

const REASON_LABELS: Record<GroupMemoryConflictReason, string> = {
  'duplicate-summary': '摘要重复',
  'same-topic-kind': '同 Topic、同类型',
};

const ISSUE_LABELS: Record<GroupMemoryIntegrityIssueKind, string> = {
  'cross-group-target': '替代关系跨越群组',
  cycle: '替代链出现循环',
  'missing-target': '被替代记录不存在',
  'self-reference': '记录替代了自身',
  'target-still-active': '被替代记录仍处于有效状态',
};

export function SettingsGroupMemoryReviewPanel({
  noDragRegionStyle,
  onSelectPair,
  repository,
}: {
  noDragRegionStyle?: CSSProperties;
  onSelectPair: (firstId: string, secondId: string) => void;
  repository: GroupMemoryRepositoryData;
}) {
  const candidates = useMemo(
    () => detectGroupMemoryConflictCandidates(repository), [repository],
  );
  const issues = useMemo(() => validateGroupMemoryIntegrity(repository), [repository]);
  if (!candidates.length && !issues.length) return null;
  return (
    <details className="rounded-sm border border-amber-500/30 bg-amber-500/5 px-3 py-2">
      <summary className="cursor-pointer text-2xs text-amber-700">
        待复核：候选 {candidates.length} 组，替代链问题 {issues.length} 项
      </summary>
      <div className="mt-3 space-y-3">
        {candidates.map((candidate) => (
          <div key={candidate.id} className="flex flex-wrap items-center justify-between gap-2 text-2xs">
            <span className="min-w-0 break-all text-muted-foreground">
              <GitCompareArrows className="mr-1 inline h-3 w-3" />
              {candidate.firstRecordId} ↔ {candidate.secondRecordId} ·{' '}
              {candidate.reasons.map((reason) => REASON_LABELS[reason]).join('、')}
            </span>
            <Button
              type="button" variant="outline" size="sm" style={noDragRegionStyle}
              onClick={() => onSelectPair(candidate.firstRecordId, candidate.secondRecordId)}
              className="h-7 rounded-full px-2 text-2xs"
            >
              选择此候选
            </Button>
          </div>
        ))}
        {issues.map((integrityIssue) => (
          <div key={integrityIssue.id} className="break-all text-2xs text-destructive">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            {ISSUE_LABELS[integrityIssue.kind]}：{integrityIssue.recordIds.join(' → ')}
          </div>
        ))}
        <p className="text-3xs leading-4 text-muted-foreground">
          这里只生成复核候选，不会自动修改、失效或合并任何记忆。
        </p>
      </div>
    </details>
  );
}
