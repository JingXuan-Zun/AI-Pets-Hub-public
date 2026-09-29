import { Inbox } from 'lucide-react';
import { Button } from '../../../../../components/ui/button';

export function GroupMemoryCandidateSaveButton({ onSave }: { onSave: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onSave}
      className="h-7 rounded-full px-2 text-2xs text-amber-700 hover:bg-amber-50 hover:text-amber-950"
      title="提交到候选箱，审核通过后才会成为群体记忆"
    >
      <Inbox className="mr-1 h-3 w-3" />
      记忆候选
    </Button>
  );
}
