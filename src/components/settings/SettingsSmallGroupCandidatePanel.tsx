import { useMemo } from 'react';
import type { DirectedRelationshipRepositoryData } from '../../character-relationship';
import type { GroupMemoryRepositoryData } from '../../group-memory';
import type { DesktopPetSlot } from '../../multiPetRoster';
import { buildSmallGroupCandidates } from '../../social-group';

function dimensions(value: { intimacy: number; trust: number; vigilance: number }) {
  return `信任 ${value.trust} · 亲密 ${value.intimacy} · 警惕 ${value.vigilance}`;
}

export function SettingsSmallGroupCandidatePanel(props: {
  groupMemoryRepository: GroupMemoryRepositoryData;
  relationshipRepository: DirectedRelationshipRepositoryData;
  slots: DesktopPetSlot[];
}) {
  const candidates = useMemo(() => buildSmallGroupCandidates({
    activeRoleIds: props.slots.map((slot) => slot.id),
    groupMemoryRepository: props.groupMemoryRepository,
    relationshipRepository: props.relationshipRepository,
    roleNames: Object.fromEntries(props.slots.map((slot) => [slot.id, slot.personality.name])),
  }), [props.groupMemoryRepository, props.relationshipRepository, props.slots]);
  return <div className="space-y-2 rounded-sm border border-dashed border-border p-3">
    <div className="text-2xs font-medium text-foreground">只读小团体候选</div>
    <p className="text-3xs leading-4 text-muted-foreground">
      仅根据公共群体记忆中的共同 Topic 与双向正式关系识别；不会自动建组或扩大记忆权限。
    </p>
    {candidates.map((candidate) => <article key={candidate.id}
      className="space-y-1 rounded-sm border border-border bg-background/30 p-2 text-3xs">
      <div className="font-medium text-foreground">
        {candidate.memberRoleNames[0]} ↔ {candidate.memberRoleNames[1]}
      </div>
      <div className="text-muted-foreground">
        共同 Topic {candidate.sharedTopicCount} · 公共正式记忆 {candidate.publicMemoryRecordCount}
      </div>
      {candidate.relationships.map((relationship) => <div key={relationship.relationshipId}
        className="text-muted-foreground">{relationship.relationshipId}：
        {dimensions(relationship.dimensions)}</div>)}
    </article>)}
    {!candidates.length && <p className="text-3xs text-muted-foreground">当前没有满足条件的候选。</p>}
  </div>;
}
