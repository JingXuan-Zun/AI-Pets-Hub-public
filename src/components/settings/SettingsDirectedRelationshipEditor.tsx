import { useState, type CSSProperties } from 'react';
import type { DirectedRelationshipDimensions, DirectedRelationshipRecord } from '../../character-relationship';
import type { DesktopPetSlot } from '../../multiPetRoster';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

const DEFAULT_DIMENSIONS: DirectedRelationshipDimensions = { intimacy: 50, trust: 50, vigilance: 50 };

function clampScore(value: string) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 50;
}

function ScoreInput(props: {
  label: string;
  onChange: (value: number) => void;
  style?: CSSProperties;
  value: number;
}) {
  return (
    <label className="space-y-1 text-2xs text-muted-foreground">
      <span>{props.label}</span>
      <Input
        type="number" min={0} max={100} value={props.value} style={props.style}
        onChange={(event) => props.onChange(clampScore(event.target.value))}
        className="h-8 bg-secondary text-xs"
      />
    </label>
  );
}

function RelationshipIdentityFields(props: {
  editing: boolean;
  noDragRegionStyle?: CSSProperties;
  onSourceChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  slots: DesktopPetSlot[];
  sourceRoleId: string;
  targetRoleId: string;
}) {
  const selectClass = 'h-8 w-full rounded-sm border border-border bg-secondary px-2 text-xs';
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="space-y-1 text-2xs text-muted-foreground">
        <span>关系主体（A）</span>
        <select value={props.sourceRoleId} disabled={props.editing} style={props.noDragRegionStyle}
          onChange={(event) => props.onSourceChange(event.target.value)} className={selectClass}>
          {props.slots.map((slot) => <option key={slot.id} value={slot.id}>{slot.personality.name}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-2xs text-muted-foreground">
        <span>关系对象（B）</span>
        <select value={props.targetRoleId} disabled={props.editing} style={props.noDragRegionStyle}
          onChange={(event) => props.onTargetChange(event.target.value)} className={selectClass}>
          {props.slots.filter((slot) => slot.id !== props.sourceRoleId)
            .map((slot) => <option key={slot.id} value={slot.id}>{slot.personality.name}</option>)}
        </select>
      </label>
    </div>
  );
}

interface RelationshipEditorProps {
  initialRecord?: DirectedRelationshipRecord | null;
  noDragRegionStyle?: CSSProperties;
  onCancelEdit: () => void;
  onSave: (input: {
    dimensions: DirectedRelationshipDimensions;
    evidenceSummary: string;
    sourceRoleId: string;
    targetRoleId: string;
    targetRoleName?: string;
  }) => void;
  slots: DesktopPetSlot[];
}

export function SettingsDirectedRelationshipEditor(props: RelationshipEditorProps) {
  const firstId = props.initialRecord?.sourceRoleId ?? props.slots[0]?.id ?? '';
  const defaultTarget = props.slots.find((slot) => slot.id !== firstId)?.id ?? '';
  const [sourceRoleId, setSourceRoleId] = useState(firstId);
  const [targetRoleId, setTargetRoleId] = useState(props.initialRecord?.targetRoleId ?? defaultTarget);
  const [dimensions, setDimensions] = useState(props.initialRecord?.dimensions ?? DEFAULT_DIMENSIONS);
  const [evidenceSummary, setEvidenceSummary] = useState(props.initialRecord?.evidenceSummary ?? '');
  const updateScore = (key: keyof DirectedRelationshipDimensions, value: number) => (
    setDimensions((current) => ({ ...current, [key]: value }))
  );
  const valid = Boolean(sourceRoleId && targetRoleId && sourceRoleId !== targetRoleId);
  const save = () => {
    if (!valid) return;
    props.onSave({
      dimensions, evidenceSummary, sourceRoleId, targetRoleId,
      targetRoleName: props.slots.find((slot) => slot.id === targetRoleId)?.personality.name,
    });
  };
  return (
    <div className="space-y-3 rounded-sm border border-border bg-background/25 p-3">
      <RelationshipIdentityFields editing={Boolean(props.initialRecord)}
        noDragRegionStyle={props.noDragRegionStyle} onSourceChange={setSourceRoleId}
        onTargetChange={setTargetRoleId} slots={props.slots}
        sourceRoleId={sourceRoleId} targetRoleId={targetRoleId} />
      <div className="grid grid-cols-3 gap-2">
        <ScoreInput label="信任" value={dimensions.trust} style={props.noDragRegionStyle} onChange={(value) => updateScore('trust', value)} />
        <ScoreInput label="亲密" value={dimensions.intimacy} style={props.noDragRegionStyle} onChange={(value) => updateScore('intimacy', value)} />
        <ScoreInput label="警惕" value={dimensions.vigilance} style={props.noDragRegionStyle} onChange={(value) => updateScore('vigilance', value)} />
      </div>
      <Input value={evidenceSummary} style={props.noDragRegionStyle}
        onChange={(event) => setEvidenceSummary(event.target.value)}
        placeholder="修改依据（可选，不会直接当成世界事实）" className="h-8 bg-secondary text-xs" />
      <div className="flex justify-end gap-2">
        {props.initialRecord ? <Button type="button" variant="ghost" size="sm" onClick={props.onCancelEdit}>取消</Button> : null}
        <Button type="button" size="sm" disabled={!valid} onClick={save}>保存定向关系</Button>
      </div>
    </div>
  );
}
