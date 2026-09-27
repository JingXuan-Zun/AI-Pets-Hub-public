import { CircleOff, Pencil, RotateCcw } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { DirectedRelationshipRecord } from '../../character-relationship';
import type { DesktopPetSlot } from '../../multiPetRoster';
import { Button } from '../../../components/ui/button';
import { SettingsDirectedRelationshipBehaviorPreview } from './SettingsDirectedRelationshipBehaviorPreview';

function roleName(slots: DesktopPetSlot[], roleId: string, fallback?: string) {
  return slots.find((slot) => slot.id === roleId)?.personality.name ?? fallback ?? roleId;
}

export function SettingsDirectedRelationshipList(props: {
  noDragRegionStyle?: CSSProperties;
  onEdit: (record: DirectedRelationshipRecord) => void;
  onInvalidate: (id: string) => void;
  onRestore: (id: string) => void;
  records: DirectedRelationshipRecord[];
  slots: DesktopPetSlot[];
}) {
  if (!props.records.length) {
    return <div className="rounded-sm border border-dashed border-border p-4 text-center text-2xs text-muted-foreground">暂无定向关系记录。</div>;
  }
  return (
    <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
      {props.records.map((record) => {
        const invalidated = record.invalidatedAt !== undefined;
        return (
          <article key={record.id} className="space-y-2 rounded-sm border border-border bg-background/25 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-medium text-foreground">
                {roleName(props.slots, record.sourceRoleId)} → {roleName(props.slots, record.targetRoleId, record.targetRoleName)}
                {invalidated ? <span className="ml-2 text-3xs text-destructive">已失效</span> : null}
              </div>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" style={props.noDragRegionStyle}
                  onClick={() => props.onEdit(record)} className="h-7 px-2 text-2xs">
                  <Pencil className="mr-1 h-3 w-3" />编辑
                </Button>
                <Button type="button" variant="ghost" size="sm" style={props.noDragRegionStyle}
                  onClick={() => (invalidated ? props.onRestore(record.id) : props.onInvalidate(record.id))}
                  className="h-7 px-2 text-2xs text-muted-foreground">
                  {invalidated ? <RotateCcw className="mr-1 h-3 w-3" /> : <CircleOff className="mr-1 h-3 w-3" />}
                  {invalidated ? '恢复' : '失效'}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-2xs text-muted-foreground">
              <span>信任 {record.dimensions.trust}</span>
              <span>亲密 {record.dimensions.intimacy}</span>
              <span>警惕 {record.dimensions.vigilance}</span>
            </div>
            {!invalidated && <SettingsDirectedRelationshipBehaviorPreview record={record} />}
            {record.evidenceSummary ? <p className="text-2xs leading-4 text-muted-foreground">依据：{record.evidenceSummary}</p> : null}
          </article>
        );
      })}
    </div>
  );
}
