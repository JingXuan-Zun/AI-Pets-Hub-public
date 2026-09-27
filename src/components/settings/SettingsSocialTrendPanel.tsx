import { useMemo, useState, type CSSProperties } from 'react';
import type { DirectedRelationshipRepositoryData } from '../../character-relationship';
import type { GroupMemoryRepositoryData } from '../../group-memory';
import { buildDirectedRelationshipSocialTrends } from '../../social-trend';
import { SettingsSocialTrendCard } from './SettingsSocialTrendCard';

interface SettingsSocialTrendPanelProps {
  groupMemoryRepository: GroupMemoryRepositoryData;
  noDragRegionStyle?: CSSProperties;
  relationshipRepository: DirectedRelationshipRepositoryData;
  roleNames: Record<string, string>;
}

function TrendFilters(props: {
  memoryGroupId: string;
  memoryGroupIds: string[];
  memoryGroupNames: Record<string, string>;
  noDragRegionStyle?: CSSProperties;
  onMemoryGroupChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  roleId: string;
  roleIds: string[];
  roleNames: Record<string, string>;
}) {
  return <div className="grid gap-2 sm:grid-cols-2">
    <select value={props.roleId} onChange={(event) => props.onRoleChange(event.target.value)}
      style={props.noDragRegionStyle}
      className="h-9 rounded-sm border border-border bg-secondary px-2 text-2xs outline-none focus:border-primary">
      <option value="all">全部相关角色</option>
      {props.roleIds.map((id) => <option key={id} value={id}>{props.roleNames[id] || id}</option>)}
    </select>
    <select value={props.memoryGroupId}
      onChange={(event) => props.onMemoryGroupChange(event.target.value)}
      style={props.noDragRegionStyle}
      className="h-9 rounded-sm border border-border bg-secondary px-2 text-2xs outline-none focus:border-primary">
      <option value="all">全部记忆组</option>
      {props.memoryGroupIds.map((id) => (
        <option key={id} value={id}>{props.memoryGroupNames[id] || id}</option>
      ))}
    </select>
  </div>;
}

export function SettingsSocialTrendPanel(props: SettingsSocialTrendPanelProps) {
  const [memoryGroupId, setMemoryGroupId] = useState('all');
  const [roleId, setRoleId] = useState('all');
  const trends = useMemo(() => buildDirectedRelationshipSocialTrends(props), [
    props.groupMemoryRepository, props.relationshipRepository,
  ]);
  const roleIds = useMemo(() => [...new Set(trends.flatMap((trend) => (
    [trend.sourceRoleId, trend.targetRoleId]
  )))].sort(), [trends]);
  const memoryGroupIds = useMemo(() => [...new Set(trends.flatMap((trend) => (
    trend.sharedMemoryGroups.map((group) => group.memoryGroupId)
  )))].sort(), [trends]);
  const memoryGroupNames = useMemo(() => Object.fromEntries([
    ['current-group', '全部群聊角色'],
    ...props.groupMemoryRepository.subgroups.map((group) => [group.id, group.name]),
  ]), [props.groupMemoryRepository.subgroups]);
  const visible = trends.filter((trend) => (
    (roleId === 'all' || trend.sourceRoleId === roleId || trend.targetRoleId === roleId)
    && (memoryGroupId === 'all' || trend.sharedMemoryGroups.some((group) => (
      group.memoryGroupId === memoryGroupId
    )))
  ));
  return (
    <section className="space-y-3 rounded-sm border border-border bg-secondary/20 p-4">
      <div>
        <h3 className="text-xs font-semibold text-foreground">关系社会趋势（Shadow）</h3>
        <p className="mt-1 text-2xs leading-4 text-muted-foreground">
          只读汇总正式审计和已保留证据；不判断因果、不生成修改建议，也不会自动改变关系数值。
          记忆组筛选只表示同 Topic 共现，不表示关系归属于该记忆组。
        </p>
      </div>
      <TrendFilters memoryGroupId={memoryGroupId} memoryGroupIds={memoryGroupIds}
        memoryGroupNames={memoryGroupNames} noDragRegionStyle={props.noDragRegionStyle}
        onMemoryGroupChange={setMemoryGroupId} onRoleChange={setRoleId}
        roleId={roleId} roleIds={roleIds} roleNames={props.roleNames} />
      <div className="max-h-[30rem] space-y-2 overflow-y-auto pr-1">
        {visible.map((trend) => <SettingsSocialTrendCard key={trend.relationshipId}
          memoryGroupNames={memoryGroupNames} roleNames={props.roleNames} trend={trend} />)}
        {!visible.length && <div className="rounded-sm border border-dashed border-border p-5 text-center text-2xs text-muted-foreground">暂无正式关系趋势。</div>}
      </div>
    </section>
  );
}
