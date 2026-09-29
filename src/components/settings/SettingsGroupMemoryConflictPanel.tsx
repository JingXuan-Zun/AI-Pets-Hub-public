import { Scale } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { StoredGroupMemoryRecord } from '../../group-memory';
import { Button } from '../../../components/ui/button';

function recordLabel(record: StoredGroupMemoryRecord) {
  return record.summary.length > 28 ? `${record.summary.slice(0, 28)}…` : record.summary;
}

export function SettingsGroupMemoryConflictPanel({
  noDragRegionStyle,
  onResolve,
  records,
}: {
  noDragRegionStyle?: CSSProperties;
  onResolve: (preferredId: string, rejectedId: string) => void;
  records: StoredGroupMemoryRecord[];
}) {
  if (records.length !== 2) {
    return (
      <div className="rounded-sm border border-dashed border-border px-3 py-2 text-2xs text-muted-foreground">
        选择两条仍有效的记忆后，可以人工决定保留哪一条。系统不会自动裁决。
      </div>
    );
  }
  const [first, second] = records as [StoredGroupMemoryRecord, StoredGroupMemoryRecord];
  return (
    <div className="space-y-2 rounded-sm border border-primary/25 bg-primary/5 p-3">
      <div className="flex items-center gap-2 text-2xs text-primary">
        <Scale className="h-3.5 w-3.5" />已选择两条冲突记忆，请人工确认保留项
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button" variant="outline" size="sm" style={noDragRegionStyle}
          onClick={() => onResolve(first.id, second.id)}
          className="h-auto min-h-9 justify-start whitespace-normal px-3 py-2 text-left text-2xs"
        >
          保留：{recordLabel(first)}
        </Button>
        <Button
          type="button" variant="outline" size="sm" style={noDragRegionStyle}
          onClick={() => onResolve(second.id, first.id)}
          className="h-auto min-h-9 justify-start whitespace-normal px-3 py-2 text-left text-2xs"
        >
          保留：{recordLabel(second)}
        </Button>
      </div>
    </div>
  );
}
