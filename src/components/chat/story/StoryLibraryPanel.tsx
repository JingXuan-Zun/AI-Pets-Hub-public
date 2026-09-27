import { BookOpen, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { STORY_PRIMARY_BUTTON_CLASS } from './storyButtonStyles';
import type { StoryDefinition } from './storyTypes';

function resolveStoryDate(story: StoryDefinition) {
  if (!Number.isFinite(story.updatedAt)) return '';
  return new Date(story.updatedAt).toLocaleDateString();
}

function confirmStoryDeletion(story: StoryDefinition) {
  const title = story.title || '未命名故事';
  return window.confirm(`确定删除故事“${title}”吗？故事设定、进度和聊天记录将一并删除。`);
}

function StoryLibraryItem(props: {
  onDelete?: (story: StoryDefinition) => void;
  onSelect: (story: StoryDefinition) => void;
  story: StoryDefinition;
}) {
  const { story } = props;
  const description = story.premise || story.customScript || '暂无梗概';
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-sky-100 bg-sky-50/40 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold text-sky-950">{story.title || '未命名故事'}</div>
        <div className="mt-0.5 truncate text-[10px] text-sky-600">{description}{resolveStoryDate(story) ? ` · ${resolveStoryDate(story)}` : ''}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" size="sm" variant="outline" onClick={() => props.onSelect(story)} className={`${STORY_PRIMARY_BUTTON_CLASS} h-7 px-2 text-[10px]`}>
          <RotateCcw className="mr-1 h-3 w-3" />查看并继续
        </Button>
        {props.onDelete ? (
          <Button type="button" size="icon" variant="ghost" aria-label={`删除故事“${story.title || '未命名故事'}”`} onClick={() => confirmStoryDeletion(story) && props.onDelete?.(story)} className="h-7 w-7 text-rose-500 hover:bg-rose-50 hover:text-rose-700">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function StoryLibraryPanel(props: {
  stories: StoryDefinition[];
  onDelete?: (story: StoryDefinition) => void;
  onSelect: (story: StoryDefinition) => void;
}) {
  if (props.stories.length === 0) return null;

  return (
    <section className="rounded-xl border border-sky-100 bg-white/80 p-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-sky-900">
        <BookOpen className="h-3.5 w-3.5" />
        故事档案
        <span className="font-normal text-sky-500">可再次查看设定并继续</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {props.stories.map((story) => (
          <StoryLibraryItem key={story.id} story={story} onDelete={props.onDelete} onSelect={props.onSelect} />
        ))}
      </div>
    </section>
  );
}
