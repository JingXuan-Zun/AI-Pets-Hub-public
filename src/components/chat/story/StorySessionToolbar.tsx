import { Eye, Plus } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { STORY_PRIMARY_BUTTON_CLASS } from './storyButtonStyles';
import type { StoryDefinition } from './storyTypes';

export function StorySessionToolbar(props: {
  definition: StoryDefinition;
  onCreateStory: () => void;
  onViewStory: () => void;
}) {
  return (
    <div className="w-full rounded-lg border border-sky-100 bg-white p-2.5 shadow-sm">
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-[0.16em] text-sky-400">当前故事</div>
        <div className="mt-0.5 break-words text-[11px] font-semibold leading-4 text-sky-950">
          {props.definition.title || '未命名故事'}
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        <Button type="button" size="sm" variant="outline" onClick={props.onViewStory} className={`${STORY_PRIMARY_BUTTON_CLASS} h-8 w-full justify-start px-2 text-[10px]`}>
          <Eye className="mr-1 h-3 w-3" />查看设定
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={props.onCreateStory} className={`${STORY_PRIMARY_BUTTON_CLASS} h-8 w-full justify-start px-2 text-[10px]`}>
          <Plus className="mr-1 h-3 w-3" />新故事
        </Button>
      </div>
    </div>
  );
}
