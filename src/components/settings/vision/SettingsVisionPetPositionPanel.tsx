import { Label } from '../../../../components/ui/label';
import { Input } from '../../../../components/ui/input';

interface SettingsVisionPetPositionPanelProps {
  position: {
    x: number;
    y: number;
  };
  onPositionChange: (axis: 'x' | 'y', value: string) => void;
}

export function SettingsVisionPetPositionPanel({
  position,
  onPositionChange,
}: SettingsVisionPetPositionPanelProps) {
  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">角色坐标</Label>
        <span className="font-mono text-2xs text-primary">X {Math.round(position.x)} / Y {Math.round(position.y)}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          type="number"
          className="h-9 rounded-sm border-border bg-secondary text-xs focus-visible:ring-primary"
          value={position.x}
          onChange={(event) => onPositionChange('x', event.target.value)}
        />
        <Input
          type="number"
          className="h-9 rounded-sm border-border bg-secondary text-xs focus-visible:ring-primary"
          value={position.y}
          onChange={(event) => onPositionChange('y', event.target.value)}
        />
      </div>
    </div>
  );
}
