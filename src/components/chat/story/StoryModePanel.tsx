import { Dices, FileInput, Loader2, Pencil, Play, Sparkles } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { Button } from '../../../../components/ui/button';
import type { PetConfig } from '../../../types';
import type { DesktopPetChatSendOptions } from '../../../chatState';
import { StoryCoreFields, STORY_TEXTAREA_CLASS } from './StoryCoreFields';
import { StoryObjectivesEditor } from './StoryObjectivesEditor';
import { StoryParticipantSelector } from './StoryParticipantSelector';
import { StoryParticipantRoutesEditor } from './StoryParticipantRoutesEditor';
import { StoryPromptSettings } from './StoryPromptSettings';
import { StoryPreview } from './StoryPreview';
import { StoryLibraryPanel } from './StoryLibraryPanel';
import { STORY_PRIMARY_BUTTON_CLASS } from './storyButtonStyles';
import { createEmptyStoryDefinition } from './storyDefaults';
import type { StoryDefinition, StoryParticipantOption, StorySource } from './storyTypes';
import { useStorySetupController } from './useStorySetupController';
import { normalizeStoryDefinition } from './storyDraftNormalization';

interface StoryModePanelProps {
  config: PetConfig;
  initialDraft?: StoryDefinition | null;
  storyLibrary?: StoryDefinition[];
  onCancel?: () => void;
  onDeleteStory?: (story: StoryDefinition) => void;
  onStarted?: () => void;
  onSendMessage: (text?: string, options?: DesktopPetChatSendOptions) => void | Promise<void>;
  participants: StoryParticipantOption[];
}

type StorySetupController = ReturnType<typeof useStorySetupController>;
const SOURCE_BUTTONS: Array<{ icon: typeof Pencil; label: string; source: StorySource }> = [
  { icon: Pencil, label: '手动创建', source: 'manual' },
  { icon: FileInput, label: '导入剧本', source: 'imported' },
];

function StorySourceButtons(props: {
  controller: StorySetupController;
}) {
  const { controller } = props;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {SOURCE_BUTTONS.map(({ icon: Icon, label, source }) => (
          <Button key={source} type="button" size="sm" variant={controller.draft.source === source ? 'default' : 'outline'} onClick={() => controller.setSource(source)} className={`${STORY_PRIMARY_BUTTON_CLASS} h-8 text-[11px] ${controller.draft.source === source ? 'ring-2 ring-sky-300 ring-offset-1' : ''}`}>
            <Icon className="mr-1 h-3.5 w-3.5" />{label}
          </Button>
        ))}
        <Button type="button" size="sm" variant="outline" disabled={controller.isGenerating} onClick={() => void controller.generate('random')} className={`${STORY_PRIMARY_BUTTON_CLASS} h-8 text-[11px]`}>
          {controller.isGenerating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Dices className="mr-1 h-3.5 w-3.5" />}
          随机补全 / 换一个空白内容
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={controller.isGenerating} onClick={() => void controller.generate('complete')} className={`${STORY_PRIMARY_BUTTON_CLASS} h-8 text-[11px]`}>
          <Sparkles className="mr-1 h-3.5 w-3.5" />基于已有内容补全
        </Button>
        {controller.isGenerating ? (
          <Button type="button" size="sm" variant="ghost" onClick={controller.cancelGeneration} className="h-8 text-[11px] text-rose-600">
            取消生成
          </Button>
        ) : null}
      </div>
      {controller.isGenerating ? (
        <p className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800" role="status">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          正在生成故事，当前模型最长可能需要 5 分钟，请稍候…
        </p>
      ) : null}
      {controller.error ? <p className="text-xs text-rose-600" role="alert">{controller.error}</p> : null}
    </div>
  );
}

function StoryCustomScript({ controller }: { controller: StorySetupController }) {
  return (
    <label className="block space-y-1 text-[11px] text-sky-700">
      <span>用户自定义剧本 / 导入内容</span>
      <textarea
        value={controller.draft.customScript}
        onChange={(event) => controller.updateDraft({
          customScript: event.target.value,
          source: controller.draft.source === 'manual' ? 'imported' : controller.draft.source,
        })}
        placeholder="可以粘贴完整剧本、角色关系、分幕内容或只写几个关键设定。模型补全时不会覆盖这里。"
        className={`${STORY_TEXTAREA_CLASS} min-h-32`}
      />
    </label>
  );
}

function StorySetupBody(props: {
  controller: StorySetupController;
  participants: StoryParticipantOption[];
}) {
  const { controller, participants } = props;
  return (
    <>
      <StoryPromptSettings draft={controller.draft} onChange={controller.updateDraft} />
      <StorySourceButtons controller={controller} />
      <StoryParticipantSelector draft={controller.draft} onChange={controller.updateDraft} participants={participants} />
      <StoryParticipantRoutesEditor draft={controller.draft} onChange={controller.updateDraft} participants={participants} />
      {controller.isPreviewing ? (
        <StoryPreview draft={controller.draft} participants={participants} />
      ) : (
        <>
          <StoryCoreFields draft={controller.draft} onChange={controller.updateDraft} />
          <StoryObjectivesEditor draft={controller.draft} onChange={controller.updateDraft} />
          <StoryCustomScript controller={controller} />
        </>
      )}
    </>
  );
}

function StorySetupFooter({ controller, onCancel }: { controller: StorySetupController; onCancel?: () => void }) {
  return (
    <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 rounded-[15px] border border-white/70 glass-bar px-3 py-3 shadow-[0_10px_30px_rgba(158,84,140,0.14)]">
      {onCancel ? <Button type="button" size="sm" variant="ghost" onClick={onCancel} className="mr-auto h-8 text-[11px]">返回故事</Button> : null}
      <Button type="button" size="sm" variant="outline" onClick={() => controller.setIsPreviewing(!controller.isPreviewing)} className={`${STORY_PRIMARY_BUTTON_CLASS} h-8 text-[11px]`}>
        {controller.isPreviewing && <Pencil className="mr-1 h-3.5 w-3.5" />}
        {controller.isPreviewing ? '编辑设定' : '预览故事'}
      </Button>
      <Button type="button" size="sm" onClick={() => void controller.start()} className={`${STORY_PRIMARY_BUTTON_CLASS} h-8 text-[11px]`}>
        <Play className="mr-1 h-3.5 w-3.5" />开始故事
      </Button>
    </div>
  );
}

function StoryModeEditor(props: {
  controller: StorySetupController;
  onCancel?: () => void;
  onDelete: (story: StoryDefinition) => void;
  participants: StoryParticipantOption[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  storyLibrary: StoryDefinition[];
}) {
  const { controller, onCancel, onDelete, participants, scrollContainerRef, storyLibrary } = props;
  return (
    <div ref={scrollContainerRef} className="flex h-full min-h-0 w-full min-w-0 flex-1 basis-0 flex-col overscroll-contain overflow-y-auto p-4" style={{ overflowAnchor: 'none' }} onPointerDown={(event) => event.stopPropagation()}>
      <div className="glass-card mx-auto w-full max-w-4xl space-y-4 rounded-[15px] p-4">
        <div><div className="text-[10px] uppercase tracking-[0.2em] text-sky-500">Story Mode</div><h2 className="mt-1 text-lg font-semibold text-sky-950">创建或导入故事</h2><p className="mt-1 text-[11px] leading-5 text-sky-600">所有内容都可以修改。手动内容和导入剧本优先于模型生成内容。</p></div>
        <StoryLibraryPanel stories={storyLibrary} onDelete={onDelete} onSelect={(story) => { controller.setDraft(normalizeStoryDefinition(story, participants, story.source)); controller.setIsPreviewing(true); }} />
        <StorySetupBody controller={controller} participants={participants} />
        <StorySetupFooter controller={controller} onCancel={onCancel} />
      </div>
    </div>
  );
}

function StoryModePanelView(props: {
  controller: StorySetupController;
  onCancel?: () => void;
  onDeleteStory?: (story: StoryDefinition) => void;
  participants: StoryParticipantOption[];
  storyLibrary: StoryDefinition[];
}) {
  const { controller, onCancel, onDeleteStory, participants, storyLibrary } = props;
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollResetKey = `${controller.draft.id}:${controller.draft.participantIds.join('|')}`;
  useLayoutEffect(() => {
    let secondFrame = 0;
    const reset = () => { scrollContainerRef.current?.scrollTo({ behavior: 'auto', top: 0 }); };
    reset();
    const firstFrame = requestAnimationFrame(() => {
      reset();
      secondFrame = requestAnimationFrame(reset);
    });
    const settleTimer = window.setTimeout(reset, 120);
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      window.clearTimeout(settleTimer);
    };
  }, [scrollResetKey]);
  const deleteStory = (story: StoryDefinition) => {
    onDeleteStory?.(story);
    if (controller.draft.id !== story.id) return;
    controller.setDraft(createEmptyStoryDefinition(participants.slice(0, 4).map((item) => item.id)));
    controller.setIsPreviewing(false);
  };
  return <StoryModeEditor controller={controller} onCancel={onCancel} onDelete={deleteStory} participants={participants} scrollContainerRef={scrollContainerRef} storyLibrary={storyLibrary} />;
}

export function StoryModePanel({ config, initialDraft = null, storyLibrary = [], onCancel, onDeleteStory, onSendMessage, onStarted, participants }: StoryModePanelProps) {
  const controller = useStorySetupController({
    config,
    initialDraft,
    participants,
    onStart: async (definition) => {
      await onSendMessage(
        `开始故事《${definition.title || '未命名故事'}》。请按照故事设定进入开场，并给我可以回应的空间。`,
        { storyDefinition: definition },
      );
      onStarted?.();
    },
  });
  return <StoryModePanelView controller={controller} onCancel={onCancel} onDeleteStory={onDeleteStory} participants={participants} storyLibrary={storyLibrary} />;
}
