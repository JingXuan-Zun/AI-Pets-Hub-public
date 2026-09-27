import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { type PetConfig } from '../../../types';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';

interface SettingsVisionFolderPositionsPanelProps {
  folders: PetConfig['folders'];
  onFolderPositionChange: (folderId: string, axis: 'x' | 'y', value: string) => void;
}

export function SettingsVisionFolderPositionsPanel({
  folders,
  onFolderPositionChange,
}: SettingsVisionFolderPositionsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const toggleTitle = expanded
    ? '\u6536\u8d77\u98df\u7269\u5750\u6807'
    : '\u5c55\u5f00\u98df\u7269\u5750\u6807';

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="rounded-sm border border-border bg-secondary/20">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            aria-label={toggleTitle}
            title={toggleTitle}
            className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
          >
            <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
              {'\u98df\u7269\u5750\u6807'}
            </Label>
            <span className="font-mono text-2xs text-primary">
              {folders.length > 0 ? `${folders.length} \u9879` : '\u6682\u65e0\u98df\u7269'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            aria-label={toggleTitle}
            title={toggleTitle}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-primary/60 bg-primary text-primary-foreground shadow-[0_0_14px_rgba(0,209,255,0.18)] transition-colors hover:bg-primary/85 hover:text-primary-foreground"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {expanded ? (
          <div className="space-y-3 border-t border-border px-4 py-4">
            {folders.length === 0 ? (
              <div className="rounded-sm border border-dashed border-border bg-secondary/20 px-3 py-3 text-2xs leading-4 text-muted-foreground">
                {'\u5f53\u524d\u8fd8\u6ca1\u6709\u53ef\u8c03\u6574\u7684\u98df\u7269\u70b9\u4f4d\u3002'}
              </div>
            ) : (
              folders.map((folder) => (
                <div key={folder.id} className="rounded-sm border border-border bg-secondary/20 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-2xs font-bold uppercase tracking-widest text-primary">{folder.name}</span>
                    <span className="font-mono text-3xs text-muted-foreground">{folder.id}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      className="h-9 rounded-sm border-border bg-secondary text-xs focus-visible:ring-primary"
                      value={folder.position.x}
                      onChange={(event) => onFolderPositionChange(folder.id, 'x', event.target.value)}
                    />
                    <Input
                      type="number"
                      className="h-9 rounded-sm border-border bg-secondary text-xs focus-visible:ring-primary"
                      value={folder.position.y}
                      onChange={(event) => onFolderPositionChange(folder.id, 'y', event.target.value)}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
