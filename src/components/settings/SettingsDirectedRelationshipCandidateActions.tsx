import type { CSSProperties } from 'react';
import type { DirectedRelationshipCandidate } from '../../character-relationship';
import { Button } from '../../../components/ui/button';

export function SettingsDirectedRelationshipCandidateActions(props: {
  candidate: DirectedRelationshipCandidate;
  noDragRegionStyle?: CSSProperties;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRollback: (id: string) => void;
}) {
  const pending = props.candidate.status === 'pending';
  if (!pending) {
    return (
      <Button type="button" size="sm" variant="outline" style={props.noDragRegionStyle}
        onClick={() => props.onRollback(props.candidate.id)} className="h-7 px-3 text-2xs">
        撤销审核
      </Button>
    );
  }
  return (
    <div className="flex gap-2">
      <Button type="button" size="sm" disabled={props.candidate.screeningDecision === 'blocked'}
        style={props.noDragRegionStyle} onClick={() => props.onApprove(props.candidate.id)}
        className="h-7 px-3 text-2xs">批准写入</Button>
      <Button type="button" size="sm" variant="outline" style={props.noDragRegionStyle}
        onClick={() => props.onReject(props.candidate.id)} className="h-7 px-3 text-2xs">拒绝</Button>
    </div>
  );
}

export function SettingsDirectedRelationshipBatchActions(props: {
  approvableCount: number;
  noDragRegionStyle?: CSSProperties;
  onApproveAll: () => void;
  onRejectAll: () => void;
  pendingCount: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" disabled={!props.approvableCount} style={props.noDragRegionStyle}
        onClick={props.onApproveAll} className="h-7 px-3 text-2xs">
        批准可审核项（{props.approvableCount}）
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={!props.pendingCount}
        style={props.noDragRegionStyle} onClick={props.onRejectAll} className="h-7 px-3 text-2xs">
        拒绝全部待处理（{props.pendingCount}）
      </Button>
    </div>
  );
}
