import { Search } from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';
import type { DirectedRelationshipRepositoryData } from '../../character-relationship';
import type { GroupMemoryRepositoryData } from '../../group-memory';
import type { GroupTopicRepositoryData } from '../../group-topic';
import {
  buildSocialEventTimeline,
  type SocialEventSource,
  type SocialEventTimelineEntry,
} from '../../social-timeline';
import { Input } from '../../../components/ui/input';
import { SettingsSocialEventEvidence } from './SettingsSocialEventEvidence';
import { SettingsSocialEventLinks } from './SettingsSocialEventLinks';

type SourceFilter = 'all' | SocialEventSource;

interface SettingsSocialEventTimelineProps {
  directedRelationshipRepository: DirectedRelationshipRepositoryData;
  groupMemoryRepository: GroupMemoryRepositoryData;
  groupTopicRepository: GroupTopicRepositoryData;
  noDragRegionStyle?: CSSProperties;
  roleNames: Record<string, string>;
}

const SOURCE_LABELS: Record<SocialEventSource, string> = {
  'group-memory': '群体记忆', relationship: '角色关系', topic: 'Topic',
};

const KIND_LABELS: Record<SocialEventTimelineEntry['kind'], string> = {
  'group-memory-evidence-scope': '证据范围快照',
  'group-memory-evidence-scope-correction': '范围关联纠正',
  'group-memory-operation': '记忆操作',
  'group-memory-review': '记忆审核',
  'relationship-behavior-context': '关系行为上下文',
  'relationship-operation': '关系操作',
  'relationship-review': '关系审核',
  'topic-transition': 'Topic 迁移',
};

const SCOPE_STATUS_LABELS = {
  active: '当前可读',
  'group-disabled': '当前组已停用或失效',
  'record-invalidated': '正式记忆已失效',
  'record-unavailable': '正式记忆已不在活动记录中',
} as const;

function TimelineMemoryScope(props: {
  entry: SocialEventTimelineEntry;
  memoryGroupNames: Record<string, string>;
}) {
  const scope = props.entry.memoryScope;
  if (!scope) return null;
  const groupName = (id: string | null) => id
    ? props.memoryGroupNames[id] || id : '无活动记录';
  return (
    <div className="mt-2 rounded-sm border border-primary/30 bg-primary/5 p-2 text-2xs leading-4">
      <div className="font-medium text-foreground">原始证据范围（不可变）</div>
      <div className="text-muted-foreground">原始写入组：{groupName(scope.capturedGroupId)}</div>
      <div className="text-muted-foreground">当前记录组：{groupName(scope.currentGroupId)}</div>
      <div className="text-muted-foreground">有效历史组：{groupName(scope.effectiveGroupId)}</div>
      {scope.latestCorrectionId && <div className="break-all font-mono text-muted-foreground">
        最新纠正：{scope.latestCorrectionId}
      </div>}
      <div className="text-muted-foreground">当前状态：{SCOPE_STATUS_LABELS[scope.currentScopeStatus]}</div>
      <div className="break-all font-mono text-muted-foreground">原始记录 ID：{scope.recordId}</div>
      {scope.effectiveRecordId !== scope.recordId && <div
        className="break-all font-mono text-muted-foreground">
        有效记录 ID：{scope.effectiveRecordId}
      </div>}
      <div className="text-muted-foreground">
        来源：{scope.snapshotSource === 'manual-save' ? '手动保存' : '候选审批通过'}
      </div>
    </div>
  );
}

function matchesEntry(entry: SocialEventTimelineEntry, query: string) {
  if (!query) return true;
  return [entry.title, entry.summary, entry.topicId ?? '', entry.groupSessionId ?? '',
    ...entry.roleIds, ...entry.memoryGroupIds,
    entry.memoryScope?.recordId ?? '', entry.memoryScope?.currentScopeStatus ?? '',
    ...entry.evidence.flatMap((item) => [item.referenceId ?? '', item.excerpt]),
    ...entry.links.flatMap((item) => [item.relation, item.targetReferenceId, item.targetEventId ?? ''])]
    .join('\n').toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function TimelineExactFilters(props: {
  memoryGroup: string;
  memoryGroupIds: string[];
  memoryGroupNames: Record<string, string>;
  noDragRegionStyle?: CSSProperties;
  onMemoryGroupChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onTopicChange: (value: string) => void;
  role: string;
  roleIds: string[];
  roleNames: Record<string, string>;
  topic: string;
  topicIds: string[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <select value={props.role} onChange={(event) => props.onRoleChange(event.target.value)}
        style={props.noDragRegionStyle}
        className="h-9 rounded-sm border border-border bg-secondary px-2 text-2xs outline-none focus:border-primary">
        <option value="all">全部角色</option>
        {props.roleIds.map((id) => <option key={id} value={id}>{props.roleNames[id] || id}</option>)}
      </select>
      <select value={props.memoryGroup}
        onChange={(event) => props.onMemoryGroupChange(event.target.value)}
        style={props.noDragRegionStyle}
        className="h-9 rounded-sm border border-border bg-secondary px-2 text-2xs outline-none focus:border-primary">
        <option value="all">全部记忆组</option>
        {props.memoryGroupIds.map((id) => (
          <option key={id} value={id}>{props.memoryGroupNames[id] || id}</option>
        ))}
      </select>
      <select value={props.topic} onChange={(event) => props.onTopicChange(event.target.value)}
        style={props.noDragRegionStyle}
        className="h-9 rounded-sm border border-border bg-secondary px-2 text-2xs outline-none focus:border-primary">
        <option value="all">全部 Topic</option>
        {props.topicIds.map((id) => <option key={id} value={id}>{id}</option>)}
      </select>
    </div>
  );
}

function TimelineFilters(props: {
  noDragRegionStyle?: CSSProperties;
  onQueryChange: (value: string) => void;
  onSourceChange: (value: SourceFilter) => void;
  query: string;
  source: SourceFilter;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={props.query} onChange={(event) => props.onQueryChange(event.target.value)}
          placeholder="搜索事件、角色、Topic 或会话" style={props.noDragRegionStyle}
          className="h-9 border-border bg-secondary pl-9 text-xs" />
      </div>
      <select value={props.source}
        onChange={(event) => props.onSourceChange(event.target.value as SourceFilter)}
        style={props.noDragRegionStyle}
        className="h-9 rounded-sm border border-border bg-secondary px-2 text-2xs outline-none focus:border-primary">
        <option value="all">全部来源</option>
        <option value="topic">Topic</option>
        <option value="group-memory">群体记忆</option>
        <option value="relationship">角色关系</option>
      </select>
    </div>
  );
}

function TimelineEntryCard(props: {
  entry: SocialEventTimelineEntry;
  eventTitles: Record<string, string>;
  memoryGroupNames: Record<string, string>;
  roleNames: Record<string, string>;
}) {
  const { entry } = props;
  const roles = entry.roleIds.map((id) => props.roleNames[id] || id).join('、');
  const memoryGroups = entry.memoryGroupIds
    .map((id) => props.memoryGroupNames[id] || id).join('、');
  return (
    <article className="rounded-sm border border-border bg-background/30 p-3 text-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-foreground">
          {SOURCE_LABELS[entry.source]} · {KIND_LABELS[entry.kind]}
        </span>
        <time className="font-mono text-muted-foreground">{new Date(entry.occurredAt).toLocaleString()}</time>
      </div>
      <div className="mt-1 text-foreground">{entry.title}</div>
      {entry.summary && <div className="mt-1 break-words leading-4 text-muted-foreground">{entry.summary}</div>}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
        {roles && <span>角色：{roles}</span>}
        {memoryGroups && <span>记忆组：{memoryGroups}</span>}
        {entry.topicId && <span>Topic：{entry.topicId}</span>}
        {entry.groupSessionId && <span>会话：{entry.groupSessionId}</span>}
        {entry.claimLevel === 'policy-supplied-only' && <span>结论：仅证明策略已提供</span>}
      </div>
      <TimelineMemoryScope entry={entry} memoryGroupNames={props.memoryGroupNames} />
      <SettingsSocialEventLinks eventTitles={props.eventTitles} links={entry.links} />
      <SettingsSocialEventEvidence evidence={entry.evidence} />
    </article>
  );
}

function TimelineEntryList(props: {
  entries: SocialEventTimelineEntry[];
  eventTitles: Record<string, string>;
  memoryGroupNames: Record<string, string>;
  roleNames: Record<string, string>;
}) {
  return (
    <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
      {props.entries.map((entry) => <TimelineEntryCard
        entry={entry} eventTitles={props.eventTitles} key={entry.id}
        memoryGroupNames={props.memoryGroupNames} roleNames={props.roleNames}
      />)}
      {!props.entries.length && <div className="rounded-sm border border-dashed border-border p-5 text-center text-2xs text-muted-foreground">暂无符合条件的社会事件。</div>}
    </div>
  );
}

export function SettingsSocialEventTimeline(props: SettingsSocialEventTimelineProps) {
  const [query, setQuery] = useState('');
  const [memoryGroup, setMemoryGroup] = useState('all');
  const [role, setRole] = useState('all');
  const [source, setSource] = useState<SourceFilter>('all');
  const [topic, setTopic] = useState('all');
  const entries = useMemo(() => buildSocialEventTimeline(props), [
    props.directedRelationshipRepository, props.groupMemoryRepository, props.groupTopicRepository,
  ]);
  const eventTitles = useMemo(() => Object.fromEntries(entries.map((entry) => [entry.id, entry.title])), [entries]);
  const memoryGroupIds = useMemo(() => [
    ...new Set(entries.flatMap((entry) => entry.memoryGroupIds)),
  ].sort(), [entries]);
  const memoryGroupNames = useMemo(() => Object.fromEntries([
    ['current-group', '全部群聊角色'],
    ...props.groupMemoryRepository.subgroups.map((group) => [
      group.id, `${group.name}${group.invalidatedAt === undefined ? '' : '（已停用）'}`,
    ]),
  ]), [props.groupMemoryRepository.subgroups]);
  const roleIds = useMemo(() => [...new Set(entries.flatMap((entry) => entry.roleIds))].sort(), [entries]);
  const topicIds = useMemo(() => [...new Set(entries.flatMap((entry) => entry.topicId ? [entry.topicId] : []))].sort(), [entries]);
  const visible = useMemo(() => entries.filter((entry) => (
    (source === 'all' || entry.source === source)
    && (memoryGroup === 'all' || entry.memoryGroupIds.includes(memoryGroup))
    && (role === 'all' || entry.roleIds.includes(role))
    && (topic === 'all' || entry.topicId === topic)
    && matchesEntry(entry, query.trim())
  )), [entries, memoryGroup, query, role, source, topic]);
  return (
    <section className="space-y-3 rounded-sm border border-border bg-secondary/20 p-4">
      <div>
        <h3 className="text-xs font-semibold text-foreground">社会事件时间线</h3>
        <p className="mt-1 text-2xs leading-4 text-muted-foreground">
          只读聚合现有审计记录，不创建新仓储、不复制数据，也不会据此自动修改关系或记忆。
        </p>
      </div>
      <TimelineFilters noDragRegionStyle={props.noDragRegionStyle} onQueryChange={setQuery}
        onSourceChange={setSource} query={query} source={source} />
      <TimelineExactFilters noDragRegionStyle={props.noDragRegionStyle}
        memoryGroup={memoryGroup} memoryGroupIds={memoryGroupIds}
        memoryGroupNames={memoryGroupNames} onMemoryGroupChange={setMemoryGroup}
        onRoleChange={setRole} onTopicChange={setTopic} role={role} roleIds={roleIds}
        roleNames={props.roleNames} topic={topic} topicIds={topicIds} />
      <div className="text-2xs text-muted-foreground">显示 {visible.length} / {entries.length} 条</div>
      <TimelineEntryList entries={visible} eventTitles={eventTitles}
        memoryGroupNames={memoryGroupNames} roleNames={props.roleNames} />
    </section>
  );
}
