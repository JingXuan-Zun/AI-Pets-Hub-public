import { StorySessionToolbar } from './StorySessionToolbar';
import type { StoryDefinition } from './storyTypes';

interface StoryConversationSidebarPanelProps {
  definition: StoryDefinition | null;
  onCreateStory: () => void;
  onViewStory: () => void;
  participantNames: string[];
}

export function StoryConversationSidebarPanel(props: StoryConversationSidebarPanelProps) {
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-[10px] leading-relaxed text-sky-700">
      <div className="space-y-3 rounded-lg border border-sky-100 bg-sky-50/50 p-2.5">
        <div className="font-semibold text-sky-950">互动故事</div>
        <p>支持手动创建、导入剧本、随机生成和基于已有内容补全。</p>
        <p>目标、任务和规则都可启用、删除或继续添加。</p>
        <div>
          <div className="font-semibold text-sky-950">可选角色</div>
          <div className="mt-1">{props.participantNames.join('、') || '暂无'}</div>
        </div>
      </div>
      {props.definition ? (
        <StorySessionToolbar
          definition={props.definition}
          onCreateStory={props.onCreateStory}
          onViewStory={props.onViewStory}
        />
      ) : null}
    </div>
  );
}
