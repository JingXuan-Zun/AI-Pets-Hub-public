import type { CSSProperties } from 'react';
import type { DirectedRelationshipCandidateGroup } from '../../character-relationship';
import { Button } from '../../../components/ui/button';

function signed(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

export function SettingsDirectedRelationshipCandidateGroups(props: {
  groups: DirectedRelationshipCandidateGroup[];
  noDragRegionStyle?: CSSProperties;
  onApproveGroup: (candidateIds: string[]) => void;
  onRejectGroup: (candidateIds: string[]) => void;
}) {
  if (!props.groups.length) return null;
  return <div className="space-y-2">
    <p className="text-2xs font-medium text-foreground">按定向关系分组审核</p>
    {props.groups.map((group) => <div key={group.id}
      className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border p-2">
      <div className="text-2xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {group.sourceRoleName} → {group.targetRoleName}
        </span>
        <span className="ml-2">待处理 {group.candidateIds.length}</span>
        <span className="ml-2">可批准 {group.approvableCandidateIds.length}</span>
        {group.blockedCount > 0 && <span className="ml-2">已阻断 {group.blockedCount}</span>}
        <div className="mt-1 font-mono">
          候选累计：信任 {signed(group.deltas.trust)} · 亲密 {signed(group.deltas.intimacy)}
          {' '}· 警惕 {signed(group.deltas.vigilance)}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={!group.approvableCandidateIds.length}
          style={props.noDragRegionStyle}
          onClick={() => props.onApproveGroup(group.approvableCandidateIds)}
          className="h-7 px-3 text-2xs">批准该组</Button>
        <Button type="button" size="sm" variant="outline" style={props.noDragRegionStyle}
          onClick={() => props.onRejectGroup(group.candidateIds)}
          className="h-7 px-3 text-2xs">拒绝该组</Button>
      </div>
    </div>)}
  </div>;
}
