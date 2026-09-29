import { Clock3, GitBranch } from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';
import {
  buildGroupTopicTimeline,
  formatGroupTopicMembers,
  type GroupTopicRepositoryData,
  type GroupTopicTimelineRow,
} from '../../group-topic';
import type { GroupTopicStatus } from '../chat/group/topic/topicLifecycle';

type TopicStatusFilter = 'all' | GroupTopicStatus;

interface SettingsGroupTopicTimelineProps {
  noDragRegionStyle?: CSSProperties;
  repository: GroupTopicRepositoryData;
  roleNames: Record<string, string>;
}

const STATUS_LABELS: Record<GroupTopicStatus, string> = {
  starting: '开始', active: '讨论中', disputed: '存在分歧',
  'waiting-information': '等待信息', resolving: '整理中', concluded: '阶段结论',
  decaying: '自然衰减', closed: '已结束', archived: '已归档',
};

const AUDIT_SOURCE_LABELS = {
  derivation: '话题派生', inactivity: '自然调度',
  'role-signal': '角色信号', task: '任务状态', 'user-input': '用户输入',
} as const;

const AUDIT_REASON_LABELS: Record<string, string> = {
  'archive-requested': '请求归档',
  'conclusion-retention-expired': '结论保留期结束',
  'decay-retention-expired': '衰减保留期结束',
  'discussion-inactive': '讨论长时间无变化',
  'new-task-or-role-information': '获得新信息',
  'new-task-information': '获得任务执行信息',
  'new-user-input': '收到新用户输入',
  'new-user-task': '收到新的用户任务',
  'repeated-role-replies': '角色回复开始重复',
  'role-disagreement': '角色报告分歧',
  'role-stage-conclusion': '角色报告阶段结论',
  'role-waiting-information': '角色请求等待信息',
  'role-turn-progress': '角色回合推进',
  'topic-derived': '确认派生话题',
  'user-topic-change': '用户切换话题',
  'waiting-for-task-information': '等待任务信息',
  'waiting-information-timeout': '等待信息超时',
};

function formatTimestamp(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '时间未知';
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime())
    ? timestamp.toLocaleString('zh-CN', { hour12: false })
    : '时间未知';
}

function TopicTimelineRow({ row }: { row: GroupTopicTimelineRow }) {
  return (
    <div
      className="rounded-sm border border-border/70 bg-secondary/40 px-3 py-2"
      style={{ marginLeft: Math.min(row.depth, 4) * 12 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <GitBranch className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate font-mono text-2xs text-foreground">{row.id}</span>
          {row.isCurrent && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-3xs text-primary">当前</span>
          )}
        </div>
        <span className="text-3xs text-muted-foreground">{STATUS_LABELS[row.status]}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-3xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3 w-3" />{formatTimestamp(row.recordedAt)}
        </span>
        {row.parentTopicId && <span>父 Topic：{row.parentTopicId}</span>}
        {row.parentMissing && <span className="text-amber-500">父节点未保留</span>}
        {row.relationCycle && <span className="text-amber-500">父子关系循环</span>}
      </div>
      {row.transitions.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-border/60 pt-2 text-3xs text-muted-foreground">
          {row.transitions.map((transition, index) => (
            <div key={`${transition.recordedAt}-${index}`}>
              {formatTimestamp(transition.recordedAt)} · {AUDIT_SOURCE_LABELS[transition.source]} ·{' '}
              {transition.fromStatus ? STATUS_LABELS[transition.fromStatus] : '新 Topic'}
              {' → '}{STATUS_LABELS[transition.toStatus]} ·{' '}
              {AUDIT_REASON_LABELS[transition.reason] ?? transition.reason}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TopicTimelineList({ rows, totalCount }: { rows: GroupTopicTimelineRow[]; totalCount: number }) {
  if (!rows.length) {
    return (
      <div className="rounded-sm border border-dashed border-border px-3 py-5 text-center text-2xs text-muted-foreground">
        {totalCount ? '当前筛选条件下没有 Topic。' : '这个成员组合还没有 Topic 记录。'}
      </div>
    );
  }
  return <div className="max-h-96 space-y-2 overflow-y-auto pr-1">{rows.map((row) => <TopicTimelineRow key={row.id} row={row} />)}</div>;
}

function TopicTimelineFilters(props: {
  noDragRegionStyle?: CSSProperties;
  repository: GroupTopicRepositoryData;
  roleNames: Record<string, string>;
  selectedGroupKey: string;
  setSelectedGroupKey: (value: string) => void;
  setStatusFilter: (value: TopicStatusFilter) => void;
  statusFilter: TopicStatusFilter;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
      <select value={props.selectedGroupKey} onChange={(event) => props.setSelectedGroupKey(event.target.value)}
        style={props.noDragRegionStyle} className="h-9 rounded-sm border border-border bg-secondary px-2 text-2xs outline-none focus:border-primary">
        {!props.repository.snapshots.length && <option value="">暂无成员组合</option>}
        {props.repository.snapshots.map((snapshot) => (
          <option key={snapshot.groupKey} value={snapshot.groupKey}>
            {formatGroupTopicMembers(snapshot.groupKey, props.roleNames) || snapshot.groupKey}
          </option>
        ))}
      </select>
      <select value={props.statusFilter} onChange={(event) => props.setStatusFilter(event.target.value as TopicStatusFilter)}
        style={props.noDragRegionStyle} className="h-9 rounded-sm border border-border bg-secondary px-2 text-2xs outline-none focus:border-primary">
        <option value="all">全部状态</option>
        {Object.entries(STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
      </select>
    </div>
  );
}

export function SettingsGroupTopicTimeline({
  noDragRegionStyle,
  repository,
  roleNames,
}: SettingsGroupTopicTimelineProps) {
  const [selectedGroupKey, setSelectedGroupKey] = useState('');
  const [statusFilter, setStatusFilter] = useState<TopicStatusFilter>('all');
  const selectedSnapshot = repository.snapshots.find((item) => item.groupKey === selectedGroupKey)
    ?? repository.snapshots.at(-1)
    ?? null;
  const rows = useMemo(() => (
    selectedSnapshot ? buildGroupTopicTimeline(selectedSnapshot) : []
  ), [selectedSnapshot]);
  const visibleRows = statusFilter === 'all'
    ? rows
    : rows.filter((row) => row.status === statusFilter);

  return (
    <section className="space-y-4 rounded-sm border border-border bg-secondary/20 p-4">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-foreground">群聊 Topic 时间线</h3>
          <span className="rounded-full border border-border px-2 py-0.5 text-3xs text-muted-foreground">只读</span>
        </div>
        <p className="mt-1 text-2xs leading-4 text-muted-foreground">
          查看持久化 Topic 状态和父子关系；此处不能删除、修改或强制切换 Topic。
        </p>
      </div>

      <TopicTimelineFilters
        noDragRegionStyle={noDragRegionStyle}
        repository={repository}
        roleNames={roleNames}
        selectedGroupKey={selectedSnapshot?.groupKey ?? ''}
        setSelectedGroupKey={setSelectedGroupKey}
        setStatusFilter={setStatusFilter}
        statusFilter={statusFilter}
      />

      <TopicTimelineList rows={visibleRows} totalCount={rows.length} />
    </section>
  );
}
