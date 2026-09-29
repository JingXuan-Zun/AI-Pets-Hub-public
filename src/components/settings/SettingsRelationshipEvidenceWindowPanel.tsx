import { useMemo, useState, type CSSProperties } from 'react';
import type { DirectedRelationshipRepositoryData } from '../../character-relationship';
import type { GroupMemoryRepositoryData } from '../../group-memory';
import { buildScopedRelationshipEvidenceWindows } from '../../social-trend';
import { SettingsRelationshipEvidenceWindowCard } from './SettingsRelationshipEvidenceWindowCard';
import { SettingsRelationshipEvidenceShadowCorpusPreview } from './SettingsRelationshipEvidenceShadowCorpusPreview';

interface RelationshipEvidenceWindowPanelProps {
  groupMemoryRepository: GroupMemoryRepositoryData;
  noDragRegionStyle?: CSSProperties;
  repository: DirectedRelationshipRepositoryData;
  roleNames: Record<string, string>;
}

function scopeKey(window: ReturnType<typeof buildScopedRelationshipEvidenceWindows>[number]) {
  return window.memoryGroupId ?? window.scopeReason;
}

function EvidenceWindowFilters(props: {
  memoryScope: string;
  noDragRegionStyle?: CSSProperties;
  onMemoryScopeChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  roleId: string;
  roleIds: string[];
  roleNames: Record<string, string>;
  scopeLabels: Record<string, string>;
  scopes: string[];
}) {
  return <div className="grid gap-2 sm:grid-cols-2">
    <select value={props.roleId} onChange={(event) => props.onRoleChange(event.target.value)}
      style={props.noDragRegionStyle}
      className="h-9 rounded-sm border border-border bg-secondary px-2 text-2xs outline-none focus:border-primary">
      <option value="all">全部相关角色</option>
      {props.roleIds.map((id) => <option key={id} value={id}>{props.roleNames[id] || id}</option>)}
    </select>
    <select value={props.memoryScope}
      onChange={(event) => props.onMemoryScopeChange(event.target.value)}
      style={props.noDragRegionStyle}
      className="h-9 rounded-sm border border-border bg-secondary px-2 text-2xs outline-none focus:border-primary">
      <option value="all">全部记忆范围</option>
      {props.scopes.map((scope) => <option key={scope} value={scope}>
        {props.scopeLabels[scope] || scope}
      </option>)}
    </select>
  </div>;
}

export function SettingsRelationshipEvidenceWindowPanel(
  props: RelationshipEvidenceWindowPanelProps,
) {
  const [memoryScope, setMemoryScope] = useState('all');
  const [roleId, setRoleId] = useState('all');
  const windows = useMemo(() => buildScopedRelationshipEvidenceWindows({
    groupMemoryRepository: props.groupMemoryRepository, repository: props.repository,
  }), [
    props.groupMemoryRepository, props.repository,
  ]);
  const roleIds = useMemo(() => [...new Set(windows.flatMap((window) => (
    [window.sourceRoleId, window.targetRoleId]
  )))].sort(), [windows]);
  const scopes = useMemo(() => [...new Set(windows.map(scopeKey))].sort(), [windows]);
  const scopeLabels = useMemo(() => Object.fromEntries([
    ['current-group', '全部群聊角色'],
    ['no-formal-memory-link', '未关联正式群体记忆'],
    ['ambiguous-formal-memory-link', '多个正式记忆组（未归类）'],
    ...props.groupMemoryRepository.subgroups.map((group) => [
      group.id, `${group.name}${group.invalidatedAt === undefined ? '' : '（已停用）'}`,
    ]),
  ]), [props.groupMemoryRepository.subgroups]);
  const visible = windows.filter((window) => (
    (roleId === 'all' || window.sourceRoleId === roleId || window.targetRoleId === roleId)
    && (memoryScope === 'all' || scopeKey(window) === memoryScope)
  ));
  return (
    <section className="space-y-3 rounded-sm border border-border bg-secondary/20 p-4">
      <div>
        <h3 className="text-xs font-semibold text-foreground">长期关系证据窗口（30天 Shadow）</h3>
        <p className="mt-1 text-2xs leading-4 text-muted-foreground">
          只观察候选与审核历史，不创建候选、不写正式关系，也不会限制或拦截用户聊天内容。
          仅按可验证的正式群体记忆关联分区，无法确认时保留为未关联范围。
        </p>
      </div>
      <EvidenceWindowFilters memoryScope={memoryScope} noDragRegionStyle={props.noDragRegionStyle}
        onMemoryScopeChange={setMemoryScope} onRoleChange={setRoleId} roleId={roleId}
        roleIds={roleIds} roleNames={props.roleNames} scopeLabels={scopeLabels} scopes={scopes} />
      <div className="max-h-[30rem] space-y-2 overflow-y-auto pr-1">
        {visible.map((window) => <SettingsRelationshipEvidenceWindowCard key={window.windowId}
          memoryGroupNames={scopeLabels} roleNames={props.roleNames} window={window} />)}
        {!visible.length && <div className="rounded-sm border border-dashed border-border p-5 text-center text-2xs text-muted-foreground">最近30天暂无关系候选证据。</div>}
      </div>
      <SettingsRelationshipEvidenceShadowCorpusPreview
        noDragRegionStyle={props.noDragRegionStyle}
      />
    </section>
  );
}
