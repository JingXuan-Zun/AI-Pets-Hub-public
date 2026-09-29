import { Button } from '../../../components/ui/button';

interface SettingsMcpHistoryServerFilterProps {
  disabled?: boolean;
  selectedServerId: string;
  serverIds: string[];
  onSelectServer: (serverId: string) => void;
}

export function SettingsMcpHistoryServerFilter({
  disabled = false,
  selectedServerId,
  serverIds,
  onSelectServer,
}: SettingsMcpHistoryServerFilterProps) {
  if (!serverIds.length && !selectedServerId) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <span className="mr-1 text-2xs text-muted-foreground">History server</span>
      <Button type="button" variant={selectedServerId ? 'ghost' : 'outline'} size="xs" disabled={disabled} onClick={() => onSelectServer('')}>
        All
      </Button>
      {serverIds.map((serverId) => (
        <Button key={serverId} type="button" variant={selectedServerId === serverId ? 'outline' : 'ghost'} size="xs" disabled={disabled} onClick={() => onSelectServer(serverId)}>
          {serverId}
        </Button>
      ))}
    </div>
  );
}
