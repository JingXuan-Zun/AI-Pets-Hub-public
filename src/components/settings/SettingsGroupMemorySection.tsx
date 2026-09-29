import { RotateCcw, Search } from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';
import type { DesktopPetSlot } from '../../multiPetRoster';
import type { DirectedRelationshipRepositoryData } from '../../character-relationship';
import {
  CURRENT_GROUP_MEMORY_GROUP_ID,
  type GroupMemoryRepositoryData,
  type StoredGroupMemoryKind,
  type StoredGroupMemoryRecord,
} from '../../group-memory';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  SettingsGroupMemoryCard,
  type GroupMemoryCardActions,
} from './SettingsGroupMemoryCard';
import { SettingsGroupMemoryConflictPanel } from './SettingsGroupMemoryConflictPanel';
import {
  SettingsGroupMemoryCandidateInbox,
  type GroupMemoryCandidateActions,
} from './SettingsGroupMemoryCandidateInbox';
import { SettingsGroupMemoryHistory } from './SettingsGroupMemoryHistory';
import { SettingsGroupMemoryEvidenceScopePanel } from './SettingsGroupMemoryEvidenceScopePanel';
import { SettingsGroupMemoryReviewPanel } from './SettingsGroupMemoryReviewPanel';
import { SettingsGroupMemoryShadowCorpusPreview } from './SettingsGroupMemoryShadowCorpusPreview';
import { SettingsGroupMemorySubgroupPanel } from './SettingsGroupMemorySubgroupPanel';
import { useSettingsGroupMemoryManagement } from './useSettingsGroupMemoryManagement';
import { useSettingsGroupMemoryCandidateManagement } from './useSettingsGroupMemoryCandidateManagement';

type KindFilter = 'all' | StoredGroupMemoryKind;

interface SettingsGroupMemorySectionProps {
  noDragRegionStyle?: CSSProperties;
  onChange: (repository: GroupMemoryRepositoryData) => void;
  repository: GroupMemoryRepositoryData;
  relationshipRepository: DirectedRelationshipRepositoryData;
  slots: DesktopPetSlot[];
}

type GroupMemoryManagement = ReturnType<typeof useSettingsGroupMemoryManagement>;

function matchesRecord(record: StoredGroupMemoryRecord, query: string) {
  if (!query) return true;
  const searchable = [
    record.summary, record.sourceRoleId, record.topicId ?? '', record.id, record.groupId,
  ].join('\n').toLocaleLowerCase();
  return searchable.includes(query.toLocaleLowerCase());
}

function MemoryFilters({
  kindFilter,
  noDragRegionStyle,
  onKindFilterChange,
  onQueryChange,
  query,
}: {
  kindFilter: KindFilter;
  noDragRegionStyle?: CSSProperties;
  onKindFilterChange: (value: KindFilter) => void;
  onQueryChange: (value: string) => void;
  query: string;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索摘要、来源、Topic 或 ID"
          style={noDragRegionStyle}
          className="h-9 border-border bg-secondary pl-9 text-xs"
        />
      </div>
      <select
        value={kindFilter}
        onChange={(event) => onKindFilterChange(event.target.value as KindFilter)}
        style={noDragRegionStyle}
        className="h-9 rounded-sm border border-border bg-secondary px-2 text-2xs outline-none focus:border-primary"
      >
        <option value="all">全部类型</option>
        <option value="discussion-summary">讨论摘要</option>
        <option value="role-perspective">角色观点</option>
        <option value="verified-fact">已验证事实</option>
      </select>
    </div>
  );
}

function MemoryRecordList({
  actions,
  noDragRegionStyle,
  repositoryCount,
  records,
}: {
  actions: GroupMemoryCardActions;
  noDragRegionStyle?: CSSProperties;
  repositoryCount: number;
  records: StoredGroupMemoryRecord[];
}) {
  if (!records.length) {
    return (
      <div className="rounded-sm border border-dashed border-border px-3 py-5 text-center text-2xs text-muted-foreground">
        {repositoryCount ? '没有符合筛选条件的群体记忆。' : '还没有群体记忆。'}
      </div>
    );
  }
  return (
    <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
      {records.map((record) => (
        <SettingsGroupMemoryCard
          actions={actions}
          key={record.id}
          noDragRegionStyle={noDragRegionStyle}
          record={record}
        />
      ))}
    </div>
  );
}

function MemorySectionHeader({
  canUndo,
  count,
  noDragRegionStyle,
  onUndo,
}: {
  canUndo: boolean;
  count: number;
  noDragRegionStyle?: CSSProperties;
  onUndo: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-xs font-semibold text-foreground">群体记忆</h3>
        <p className="mt-1 text-2xs leading-4 text-muted-foreground">
          全部角色共享的唯一记录，共 {count} 条。自动长期写入当前关闭。
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canUndo}
        onClick={onUndo}
        style={noDragRegionStyle}
        className="h-8 rounded-full px-3 text-2xs disabled:opacity-40"
      >
        <RotateCcw className="mr-1 h-3 w-3" />
        回滚上次操作
      </Button>
    </div>
  );
}

function MemoryManagementPanels({
  candidateActions,
  management,
  noDragRegionStyle,
  repository,
}: {
  candidateActions: GroupMemoryCandidateActions;
  management: GroupMemoryManagement;
  noDragRegionStyle?: CSSProperties;
  repository: GroupMemoryRepositoryData;
}) {
  return (
    <>
      <SettingsGroupMemoryShadowCorpusPreview noDragRegionStyle={noDragRegionStyle}
        repository={repository} />
      <SettingsGroupMemoryCandidateInbox
        actions={candidateActions}
        noDragRegionStyle={noDragRegionStyle}
        repository={repository}
      />
      <SettingsGroupMemoryConflictPanel
        noDragRegionStyle={noDragRegionStyle}
        onResolve={management.resolveConflict}
        records={management.conflictRecords}
      />
      <SettingsGroupMemoryReviewPanel
        noDragRegionStyle={noDragRegionStyle}
        onSelectPair={management.selectConflictPair}
        repository={repository}
      />
      <SettingsGroupMemoryHistory
        archives={repository.receiptArchives}
        receipts={repository.receipts}
      />
    </>
  );
}

function MemoryRepositoryPanels(props: {
  candidateActions: GroupMemoryCandidateActions;
  management: GroupMemoryManagement;
  noDragRegionStyle?: CSSProperties;
  onChange: (repository: GroupMemoryRepositoryData) => void;
  repository: GroupMemoryRepositoryData;
  relationshipRepository: DirectedRelationshipRepositoryData;
  slots: DesktopPetSlot[];
}) {
  return <>
    <SettingsGroupMemorySubgroupPanel
      noDragRegionStyle={props.noDragRegionStyle} onChange={props.onChange}
      repository={props.repository} slots={props.slots}
      relationshipRepository={props.relationshipRepository}
    />
    <SettingsGroupMemoryEvidenceScopePanel
      noDragRegionStyle={props.noDragRegionStyle} onChange={props.onChange}
      repository={props.repository}
    />
    <MemoryManagementPanels
      candidateActions={props.candidateActions} management={props.management}
      noDragRegionStyle={props.noDragRegionStyle} repository={props.repository}
    />
  </>;
}

function createMemoryCardActions(management: GroupMemoryManagement): GroupMemoryCardActions {
  const repository = management.repository;
  return {
    conflictIds: management.conflictIds,
    groupOptions: [
      { id: CURRENT_GROUP_MEMORY_GROUP_ID, name: '全部群聊角色' },
      ...repository.subgroups.map((group) => ({
        disabled: group.invalidatedAt !== undefined, id: group.id, name: group.name,
      })),
    ],
    onInvalidate: management.invalidate, onMoveGroup: management.moveToGroup,
    onRestore: management.restore, onToggleConflict: management.toggleConflict,
  };
}

export function SettingsGroupMemorySection(
  { noDragRegionStyle, onChange, relationshipRepository, repository, slots }:
    SettingsGroupMemorySectionProps,
) {
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const management = useSettingsGroupMemoryManagement(repository, onChange);
  const candidateActions = useSettingsGroupMemoryCandidateManagement(repository, onChange);
  const visibleRecords = useMemo(() => repository.records.filter((record) => (
    (kindFilter === 'all' || record.kind === kindFilter) && matchesRecord(record, query.trim())
  )), [kindFilter, query, repository.records]);

  const actions = createMemoryCardActions(management);
  return (
    <section className="space-y-4 rounded-sm border border-border bg-secondary/20 p-4">
      <MemorySectionHeader
        canUndo={Boolean(management.rollbackableReceipt)}
        count={repository.records.length}
        noDragRegionStyle={noDragRegionStyle}
        onUndo={management.rollback}
      />

      <MemoryFilters
        kindFilter={kindFilter}
        noDragRegionStyle={noDragRegionStyle}
        onKindFilterChange={setKindFilter}
        onQueryChange={setQuery}
        query={query}
      />

      <MemoryRepositoryPanels
        candidateActions={candidateActions}
        management={management}
        noDragRegionStyle={noDragRegionStyle}
        onChange={onChange}
        repository={repository}
        relationshipRepository={relationshipRepository}
        slots={slots}
      />

      <MemoryRecordList
        actions={actions}
        noDragRegionStyle={noDragRegionStyle}
        records={visibleRecords}
        repositoryCount={repository.records.length}
      />
    </section>
  );
}
