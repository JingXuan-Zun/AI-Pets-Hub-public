import { UsersRound } from 'lucide-react';
import { useState } from 'react';
import {
  CURRENT_GROUP_MEMORY_GROUP_ID,
  getWritableGroupMemoryGroupOptions,
  type GroupMemoryRepositoryData,
} from '../../../../group-memory';
import { Button } from '../../../../../components/ui/button';

export function GroupMemorySaveButton({
  onSave,
  repository,
}: {
  onSave: (groupId: string) => void;
  repository: GroupMemoryRepositoryData;
}) {
  const [groupId, setGroupId] = useState(CURRENT_GROUP_MEMORY_GROUP_ID);
  const options = getWritableGroupMemoryGroupOptions(repository);
  const writable = options.some((option) => option.id === groupId);
  return (
    <div className="flex items-center gap-1">
      <select
        aria-label="群体记忆目标组"
        className="h-7 max-w-28 rounded-full border border-border bg-white px-2 text-2xs text-primary"
        onChange={(event) => setGroupId(event.target.value)}
        value={groupId}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.name}</option>
        ))}
      </select>
      <Button
        type="button" variant="ghost" size="sm" disabled={!writable}
        onClick={() => onSave(groupId)}
        className="h-7 rounded-full px-2 text-2xs text-primary hover:bg-muted hover:text-foreground"
        title="存入所选范围的群体记忆"
      >
        <UsersRound className="mr-1 h-3 w-3" />群体记忆
      </Button>
    </div>
  );
}
