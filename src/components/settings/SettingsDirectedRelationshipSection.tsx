import { RotateCcw } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import {
  getLatestRollbackableRelationshipAudit,
  invalidateDirectedRelationship,
  restoreDirectedRelationship,
  rollbackDirectedRelationshipOperation,
  upsertDirectedRelationship,
  type DirectedRelationshipRecord,
  type DirectedRelationshipRepositoryData,
} from '../../character-relationship';
import type { DesktopPetSlot } from '../../multiPetRoster';
import { Button } from '../../../components/ui/button';
import { SettingsDirectedRelationshipEditor } from './SettingsDirectedRelationshipEditor';
import { SettingsDirectedRelationshipList } from './SettingsDirectedRelationshipList';
import { SettingsDirectedRelationshipTimeline } from './SettingsDirectedRelationshipTimeline';
import { SettingsDirectedRelationshipCandidateInbox } from './SettingsDirectedRelationshipCandidateInbox';
import { SettingsDirectedRelationshipShadowReport } from './SettingsDirectedRelationshipShadowReport';
import { useSettingsDirectedRelationshipCandidateReview } from './useSettingsDirectedRelationshipCandidateReview';
import { SettingsDirectedRelationshipBehaviorTimeline } from './SettingsDirectedRelationshipBehaviorTimeline';

function RelationshipSectionHeader(props: {
  canRollback: boolean;
  noDragRegionStyle?: CSSProperties;
  onRollback: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-xs font-semibold text-foreground">定向角色关系</h3>
        <p className="mt-1 text-2xs leading-4 text-muted-foreground">
          A→B 与 B→A 独立。候选必须由用户批准才写入；自动关系演化保持关闭。
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" disabled={!props.canRollback}
        style={props.noDragRegionStyle} onClick={props.onRollback}
        className="h-8 rounded-full px-3 text-2xs">
        <RotateCcw className="mr-1 h-3 w-3" />回滚上次操作
      </Button>
    </div>
  );
}

export function SettingsDirectedRelationshipSection(props: {
  noDragRegionStyle?: CSSProperties;
  onChange: (repository: DirectedRelationshipRepositoryData) => void;
  repository: DirectedRelationshipRepositoryData;
  slots: DesktopPetSlot[];
}) {
  const [editingRecord, setEditingRecord] = useState<DirectedRelationshipRecord | null>(null);
  const candidateReview = useSettingsDirectedRelationshipCandidateReview({
    onChange: props.onChange, repository: props.repository,
  });
  const rollbackable = getLatestRollbackableRelationshipAudit(props.repository);
  const apply = (repository: DirectedRelationshipRepositoryData) => {
    if (repository !== props.repository) props.onChange(repository);
  };
  const save = (input: Parameters<typeof upsertDirectedRelationship>[1]) => {
    apply(upsertDirectedRelationship(props.repository, input, {
      reason: editingRecord ? 'settings manual edit' : 'settings manual create', source: 'manual',
    }));
    setEditingRecord(null);
  };
  return (
    <section className="space-y-4 rounded-sm border border-border bg-secondary/20 p-4">
      <RelationshipSectionHeader canRollback={Boolean(rollbackable)} noDragRegionStyle={props.noDragRegionStyle}
        onRollback={() => rollbackable && apply(rollbackDirectedRelationshipOperation(props.repository, rollbackable.id))} />
      <SettingsDirectedRelationshipEditor
        key={editingRecord?.id ?? 'new'} initialRecord={editingRecord}
        noDragRegionStyle={props.noDragRegionStyle} onCancelEdit={() => setEditingRecord(null)}
        onSave={save} slots={props.slots}
      />
      <SettingsDirectedRelationshipShadowReport repository={props.repository} />
      {candidateReview.feedback && <p className="text-2xs text-muted-foreground">{candidateReview.feedback}</p>}
      <SettingsDirectedRelationshipCandidateInbox
        candidates={props.repository.candidates} noDragRegionStyle={props.noDragRegionStyle}
        onApprove={candidateReview.onApprove} onApproveAll={candidateReview.onApproveAll}
        onApproveGroup={candidateReview.onApproveGroup}
        onReject={candidateReview.onReject} onRejectAll={candidateReview.onRejectAll}
        onRejectGroup={candidateReview.onRejectGroup}
        onRollback={candidateReview.onRollback} records={props.repository.records}
      />
      <SettingsDirectedRelationshipTimeline entries={props.repository.auditTrail} />
      <SettingsDirectedRelationshipBehaviorTimeline traces={props.repository.behaviorTraces} />
      <SettingsDirectedRelationshipList
        noDragRegionStyle={props.noDragRegionStyle} onEdit={setEditingRecord}
        onInvalidate={(id) => apply(invalidateDirectedRelationship(props.repository, id))}
        onRestore={(id) => apply(restoreDirectedRelationship(props.repository, id))}
        records={props.repository.records} slots={props.slots}
      />
    </section>
  );
}
