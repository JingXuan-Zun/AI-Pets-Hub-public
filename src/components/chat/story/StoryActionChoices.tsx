import { Compass } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { STORY_PRIMARY_BUTTON_CLASS } from './storyButtonStyles';

interface StoryActionChoicesProps {
  actions: string[];
  onChooseAction: (action: string) => void;
}

export function StoryActionChoices({ actions, onChooseAction }: StoryActionChoicesProps) {
  if (actions.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-900">
        <Compass className="h-4 w-4 text-sky-700" />选择下一步
        <span className="font-normal text-slate-500">点击后可在输入框中修改</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action, index) => (
          <Button
            key={action}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChooseAction(action)}
            className={`${STORY_PRIMARY_BUTTON_CLASS} h-auto min-h-8 whitespace-normal text-left text-[11px] leading-5`}
          >
            {index + 1}. {action}
          </Button>
        ))}
      </div>
    </div>
  );
}
