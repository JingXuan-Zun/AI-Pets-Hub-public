import { Check, X } from 'lucide-react';
import { useState } from 'react';
import {
  CURRENT_GROUP_MEMORY_GROUP_ID,
  getWritableGroupMemoryGroupOptions,
  type GroupMemoryRepositoryData,
} from '../../../../group-memory';
import { Button } from '../../../../../components/ui/button';
import type { GroupTaskMemoryCandidateNotice } from './useGroupTaskMemoryCandidateCapture';

export function GroupTaskMemoryCandidatePrompt({
  notice,
  onApprove,
  onIgnore,
  repository,
}: {
  notice: GroupTaskMemoryCandidateNotice;
  onApprove: (groupId: string) => void;
  onIgnore: () => void;
  repository: GroupMemoryRepositoryData;
}) {
  const [groupId, setGroupId] = useState(CURRENT_GROUP_MEMORY_GROUP_ID);
  const groupOptions = getWritableGroupMemoryGroupOptions(repository);
  const writable = groupOptions.some((group) => group.id === groupId);
  return (
    <aside className="mx-3 mb-2 rounded-lg border border-amber-300/70 bg-amber-50/95 p-3 text-amber-950 shadow-sm">
      <div className="text-2xs font-medium">任务结果已进入长期记忆候选箱</div>
      <p className="mt-1 line-clamp-2 text-2xs leading-4 opacity-80">{notice.summary}</p>
      <p className="mt-1 text-3xs opacity-65">批准前不会进入角色上下文。</p>
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <select aria-label="任务候选写入目标组" value={groupId}
          onChange={(event) => setGroupId(event.target.value)}
          className="h-7 max-w-36 rounded-md border border-amber-300 bg-white px-2 text-2xs">
          {groupOptions.map((group) => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </select>
        <Button type="button" variant="outline" size="sm" onClick={onIgnore} className="h-7 px-2 text-2xs">
          <X className="mr-1 h-3 w-3" />忽略
        </Button>
        <Button type="button" size="sm" disabled={!writable}
          onClick={() => onApprove(groupId)} className="h-7 px-2 text-2xs">
          <Check className="mr-1 h-3 w-3" />批准写入
        </Button>
      </div>
    </aside>
  );
}
