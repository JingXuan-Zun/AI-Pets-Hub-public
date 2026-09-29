import { useState, type CSSProperties } from 'react';
import type { DesktopPetSlot } from '../../multiPetRoster';
import type { DirectedRelationshipRepositoryData } from '../../character-relationship';
import {
  createGroupMemorySubgroup,
  invalidateGroupMemorySubgroup,
  restoreGroupMemorySubgroup,
  updateGroupMemorySubgroupMembers,
  type GroupMemoryRepositoryData,
  type StoredGroupMemorySubgroup,
} from '../../group-memory';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { SettingsSmallGroupCandidatePanel } from './SettingsSmallGroupCandidatePanel';

type PanelProps = {
  noDragRegionStyle?: CSSProperties;
  onChange: (repository: GroupMemoryRepositoryData) => void;
  repository: GroupMemoryRepositoryData;
  relationshipRepository: DirectedRelationshipRepositoryData;
  slots: DesktopPetSlot[];
};

function MemberChecks(props: {
  disabled?: boolean;
  memberRoleIds: string[];
  onChange: (memberRoleIds: string[]) => void;
  slots: DesktopPetSlot[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {props.slots.map((slot) => {
        const checked = props.memberRoleIds.includes(slot.id);
        return (
          <label key={slot.id} className="flex items-center gap-1 text-2xs text-muted-foreground">
            <input type="checkbox" checked={checked} disabled={props.disabled}
              onChange={() => props.onChange(checked
              ? props.memberRoleIds.filter((id) => id !== slot.id)
              : [...props.memberRoleIds, slot.id])} />
            {slot.personality.name}
          </label>
        );
      })}
    </div>
  );
}

function SubgroupCreator({ noDragRegionStyle, onChange, repository, slots }: PanelProps) {
  const [name, setName] = useState('');
  const [memberRoleIds, setMemberRoleIds] = useState<string[]>([]);
  const create = () => {
    const next = createGroupMemorySubgroup(repository, { memberRoleIds, name });
    if (next === repository) return;
    onChange(next);
    setName('');
    setMemberRoleIds([]);
  };
  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border p-3">
      <Input value={name} onChange={(event) => setName(event.target.value)}
        placeholder="小团体名称" style={noDragRegionStyle} className="h-8 text-xs" />
      <MemberChecks memberRoleIds={memberRoleIds} onChange={setMemberRoleIds} slots={slots} />
      <Button type="button" size="sm" variant="outline" onClick={create}
        disabled={!name.trim() || memberRoleIds.length < 2} style={noDragRegionStyle}
        className="h-7 text-2xs">人工创建小团体</Button>
    </div>
  );
}

function SubgroupCard(props: PanelProps & { subgroup: StoredGroupMemorySubgroup }) {
  const { subgroup } = props;
  const inactive = subgroup.invalidatedAt !== undefined;
  const updateMembers = (memberRoleIds: string[]) => {
    const next = updateGroupMemorySubgroupMembers(props.repository, subgroup.id, memberRoleIds);
    if (next !== props.repository) props.onChange(next);
  };
  const toggleStatus = () => props.onChange(inactive
    ? restoreGroupMemorySubgroup(props.repository, subgroup.id)
    : invalidateGroupMemorySubgroup(props.repository, subgroup.id));
  return (
    <article className="space-y-2 rounded-sm border border-border bg-background/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div><div className="text-2xs text-foreground">{subgroup.name}</div>
          <div className="text-3xs text-muted-foreground">{subgroup.id}</div></div>
        <Button type="button" size="sm" variant="ghost" onClick={toggleStatus}
          style={props.noDragRegionStyle} className="h-7 text-2xs">
          {inactive ? '恢复' : '停用'}
        </Button>
      </div>
      <MemberChecks disabled={inactive} memberRoleIds={subgroup.memberRoleIds}
        onChange={updateMembers} slots={props.slots} />
      {inactive ? <div className="text-3xs text-destructive">已停用，成员暂时无法读取该组记忆。</div> : null}
    </article>
  );
}

export function SettingsGroupMemorySubgroupPanel(props: PanelProps) {
  return (
    <details className="rounded-sm border border-border bg-background/20 px-3 py-2">
      <summary className="cursor-pointer text-2xs text-muted-foreground">
        小团体与成员权限（{props.repository.subgroups.length}）
      </summary>
      <p className="my-2 text-3xs leading-4 text-amber-500">
        仅支持人工创建和调整；自动组团、自动传播与自动写入保持关闭。
      </p>
      <div className="space-y-2">
        <SettingsSmallGroupCandidatePanel groupMemoryRepository={props.repository}
          relationshipRepository={props.relationshipRepository} slots={props.slots} />
        <SubgroupCreator {...props} />
        {props.repository.subgroups.map((subgroup) => (
          <SubgroupCard {...props} key={subgroup.id} subgroup={subgroup} />
        ))}
      </div>
    </details>
  );
}
