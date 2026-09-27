import { useState, type CSSProperties } from 'react';
import {
  appendGroupMemoryEvidenceScopeCorrection,
  CURRENT_GROUP_MEMORY_GROUP_ID,
  latestEvidenceScopeCorrection,
  type GroupMemoryRepositoryData,
} from '../../group-memory';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

interface SettingsGroupMemoryEvidenceScopePanelProps {
  noDragRegionStyle?: CSSProperties;
  onChange: (repository: GroupMemoryRepositoryData) => void;
  repository: GroupMemoryRepositoryData;
}

function ScopeCorrectionHistory({ repository }: { repository: GroupMemoryRepositoryData }) {
  const corrections = [...repository.evidenceScopeCorrections]
    .sort((left, right) => right.occurredAt - left.occurredAt).slice(0, 20);
  if (!corrections.length) return null;
  return <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
    {corrections.map((item) => <div key={item.id}
      className="rounded-sm border border-border/70 bg-background/30 p-2 text-2xs leading-4">
      <div className="break-all font-mono text-foreground">{item.snapshotId}</div>
      <div className="text-muted-foreground">
        → {item.correctedRecordId} / {item.correctedGroupId}
      </div>
      <div className="break-words text-muted-foreground">{item.reason}</div>
      {item.supersedesCorrectionId && <div className="break-all text-muted-foreground">
        替代纠正：{item.supersedesCorrectionId}
      </div>}
    </div>)}
  </div>;
}

function ScopeCorrectionFields(props: {
  groupId: string;
  noDragRegionStyle?: CSSProperties;
  onGroupId: (value: string) => void;
  onReason: (value: string) => void;
  onRecordId: (value: string) => void;
  onSnapshotId: (value: string) => void;
  reason: string;
  recordId: string;
  repository: GroupMemoryRepositoryData;
  snapshotId: string;
}) {
  return <>
    <select value={props.snapshotId} onChange={(event) => props.onSnapshotId(event.target.value)}
      style={props.noDragRegionStyle}
      className="h-9 w-full rounded-sm border border-border bg-secondary px-2 text-2xs">
      <option value="">选择需要纠正的范围快照</option>
      {props.repository.evidenceScopeSnapshots.map((item) => <option key={item.id} value={item.id}>
        {item.id} · {item.recordId} / {item.groupId}
      </option>)}
    </select>
    <div className="grid gap-2 sm:grid-cols-2">
      <select value={props.recordId} onChange={(event) => props.onRecordId(event.target.value)}
        style={props.noDragRegionStyle}
        className="h-9 rounded-sm border border-border bg-secondary px-2 text-2xs">
        <option value="">纠正后的正式记录</option>
        {props.repository.records.map((item) => <option key={item.id} value={item.id}>
          {item.id}{item.invalidatedAt === undefined ? '' : '（已失效）'}
        </option>)}
      </select>
      <select value={props.groupId} onChange={(event) => props.onGroupId(event.target.value)}
        style={props.noDragRegionStyle}
        className="h-9 rounded-sm border border-border bg-secondary px-2 text-2xs">
        <option value={CURRENT_GROUP_MEMORY_GROUP_ID}>全部群聊角色</option>
        {props.repository.subgroups.map((item) => <option key={item.id} value={item.id}>
          {item.name}{item.invalidatedAt === undefined ? '' : '（已停用，仅审计）'}
        </option>)}
      </select>
    </div>
    <Input value={props.reason} onChange={(event) => props.onReason(event.target.value)}
      placeholder="填写纠正原因（必填）" style={props.noDragRegionStyle}
      className="h-9 border-border bg-secondary text-xs" />
  </>;
}

export function SettingsGroupMemoryEvidenceScopePanel(
  props: SettingsGroupMemoryEvidenceScopePanelProps,
) {
  const [snapshotId, setSnapshotId] = useState('');
  const [recordId, setRecordId] = useState('');
  const [groupId, setGroupId] = useState(CURRENT_GROUP_MEMORY_GROUP_ID);
  const [reason, setReason] = useState('');
  const selectedSnapshot = props.repository.evidenceScopeSnapshots.find((item) => (
    item.id === snapshotId
  ));
  const latest = selectedSnapshot
    ? latestEvidenceScopeCorrection(props.repository, selectedSnapshot.id) : null;
  const submit = () => {
    const next = appendGroupMemoryEvidenceScopeCorrection(props.repository, {
      correctedGroupId: groupId, correctedRecordId: recordId, reason, snapshotId,
    });
    if (next === props.repository) return;
    props.onChange(next);
    setReason('');
  };
  return <section className="space-y-2 rounded-sm border border-border bg-background/20 p-3">
    <div>
      <h4 className="text-2xs font-semibold text-foreground">证据范围关联纠正</h4>
      <p className="mt-1 text-2xs leading-4 text-muted-foreground">
        仅追加纠正记录，不覆盖原快照、不迁移正式记忆，也不会自动修改关系。
      </p>
    </div>
    <ScopeCorrectionFields groupId={groupId} noDragRegionStyle={props.noDragRegionStyle}
      onGroupId={setGroupId} onReason={setReason} onRecordId={setRecordId}
      onSnapshotId={setSnapshotId} reason={reason} recordId={recordId}
      repository={props.repository} snapshotId={snapshotId} />
    {latest && <div className="rounded-sm bg-amber-500/10 p-2 text-2xs text-muted-foreground">
      当前有效纠正：{latest.correctedRecordId} / {latest.correctedGroupId}
    </div>}
    <Button type="button" variant="outline" size="sm" onClick={submit}
      disabled={!selectedSnapshot || !recordId || !reason.trim()}
      style={props.noDragRegionStyle} className="h-8 text-2xs">
      追加纠正记录
    </Button>
    <ScopeCorrectionHistory repository={props.repository} />
  </section>;
}
