import { CircleOff, RotateCcw, Scale } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { StoredGroupMemoryKind, StoredGroupMemoryRecord } from '../../group-memory';
import { Button } from '../../../components/ui/button';

const KIND_LABELS: Record<StoredGroupMemoryKind, string> = {
  'discussion-summary': '讨论摘要',
  'role-perspective': '角色观点',
  'verified-fact': '已验证事实',
};

export interface GroupMemoryCardActions {
  conflictIds: string[];
  groupOptions: { disabled?: boolean; id: string; name: string }[];
  onInvalidate: (id: string) => void;
  onMoveGroup: (id: string, groupId: string) => void;
  onRestore: (id: string) => void;
  onToggleConflict: (id: string) => void;
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
}

function MemoryMetadata({ record }: { record: StoredGroupMemoryRecord }) {
  return (
    <div className="grid gap-1 text-2xs text-muted-foreground sm:grid-cols-2">
      <span>来源：{record.sourceRoleId}</span>
      <span>记忆组：{record.groupId}</span>
      <span>Topic：{record.topicId ?? '无'}</span>
      <span>置信度：{Math.round(record.confidence * 100)}%</span>
      <span>创建：{formatTimestamp(record.createdAt)}</span>
      <span className="break-all sm:col-span-2">稳定 ID：{record.id}</span>
      {record.supersedesId ? (
        <span className="break-all text-primary sm:col-span-2">
          替代记录：{record.supersedesId}
        </span>
      ) : null}
    </div>
  );
}

function MemoryCardActions({
  actions,
  noDragRegionStyle,
  record,
}: {
  actions: GroupMemoryCardActions;
  noDragRegionStyle?: CSSProperties;
  record: StoredGroupMemoryRecord;
}) {
  const invalidated = record.invalidatedAt !== undefined;
  const selected = actions.conflictIds.includes(record.id);
  return (
    <div className="flex shrink-0 flex-wrap justify-end gap-1">
      {!invalidated ? (
        <Button
          type="button" variant="ghost" size="sm" style={noDragRegionStyle}
          onClick={() => actions.onToggleConflict(record.id)}
          className={`h-7 rounded-full px-2 text-2xs ${selected ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}
        >
          <Scale className="mr-1 h-3 w-3" />{selected ? '已选冲突' : '冲突处理'}
        </Button>
      ) : null}
      <Button
        type="button" variant="ghost" size="sm" style={noDragRegionStyle}
        onClick={() => (invalidated ? actions.onRestore(record.id) : actions.onInvalidate(record.id))}
        className="h-7 rounded-full px-2 text-2xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        {invalidated
          ? <RotateCcw className="mr-1 h-3 w-3" />
          : <CircleOff className="mr-1 h-3 w-3" />}
        {invalidated ? '恢复' : '标记失效'}
      </Button>
    </div>
  );
}

export function SettingsGroupMemoryCard({
  actions,
  noDragRegionStyle,
  record,
}: {
  actions: GroupMemoryCardActions;
  noDragRegionStyle?: CSSProperties;
  record: StoredGroupMemoryRecord;
}) {
  return (
    <article className="space-y-3 rounded-sm border border-border bg-background/35 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-3xs text-primary">
            {KIND_LABELS[record.kind]}
          </span>
          {record.invalidatedAt !== undefined ? (
            <span className="rounded-full border border-destructive/30 px-2 py-1 text-3xs text-destructive">
              已失效
            </span>
          ) : null}
        </div>
        <MemoryCardActions actions={actions} noDragRegionStyle={noDragRegionStyle} record={record} />
      </div>
      <p className="whitespace-pre-wrap break-words text-xs leading-5 text-foreground">
        {record.summary}
      </p>
      <select value={record.groupId} disabled={record.invalidatedAt !== undefined}
        onChange={(event) => actions.onMoveGroup(record.id, event.target.value)}
        style={noDragRegionStyle}
        className="h-8 w-full rounded-sm border border-border bg-secondary px-2 text-2xs">
        {actions.groupOptions.map((option) => (
          <option disabled={option.disabled} key={option.id} value={option.id}>{option.name}</option>
        ))}
      </select>
      <MemoryMetadata record={record} />
    </article>
  );
}
