import { Input } from '../../../../components/ui/input';
import type { StoryDefinition } from './storyTypes';

interface StoryCoreFieldsProps {
  draft: StoryDefinition;
  onChange: (patch: Partial<StoryDefinition>) => void;
}

const TEXTAREA_CLASS = 'min-h-20 w-full resize-y rounded-lg border border-sky-100 bg-white px-3 py-2 text-xs text-sky-950 outline-none focus:border-sky-300';
const INPUT_CLASS = 'h-9 border-sky-100 text-xs';

function StoryPrimaryFields({ draft, onChange }: StoryCoreFieldsProps) {
  return (
    <>
      <label className="space-y-1 text-[11px] text-sky-700">
        <span>故事标题 / 题材方向</span>
        <Input value={draft.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="例如：赛博朋克侦探；也可写想要的题材、风格或故事方向" className={INPUT_CLASS} />
      </label>
      <label className="space-y-1 text-[11px] text-sky-700">
        <span>用户身份</span>
        <Input value={draft.userRole} onChange={(event) => onChange({ userRole: event.target.value })} placeholder="例如：受委托调查失踪案的旅客" className={INPUT_CLASS} />
      </label>
      <label className="space-y-1 text-[11px] text-sky-700 md:col-span-2">
        <span>故事梗概</span>
        <textarea value={draft.premise} onChange={(event) => onChange({ premise: event.target.value })} placeholder="冲突、悬念和故事方向。" className={TEXTAREA_CLASS} />
      </label>
    </>
  );
}

function StorySceneFields({ draft, onChange }: StoryCoreFieldsProps) {
  return (
    <>
      <label className="space-y-1 text-[11px] text-sky-700">
        <span>世界与场景设定</span>
        <textarea value={draft.setting} onChange={(event) => onChange({ setting: event.target.value })} placeholder="时代、地点、世界规律。" className={TEXTAREA_CLASS} />
      </label>
      <label className="space-y-1 text-[11px] text-sky-700">
        <span>开场场景</span>
        <textarea value={draft.openingScene} onChange={(event) => onChange({ openingScene: event.target.value })} placeholder="故事开始时发生了什么。" className={TEXTAREA_CLASS} />
      </label>
    </>
  );
}

function StoryConditionFields({ draft, onChange }: StoryCoreFieldsProps) {
  return (
    <>
      <label className="space-y-1 text-[11px] text-sky-700">
        <span>成功条件（可选）</span>
        <Input value={draft.successCondition} onChange={(event) => onChange({ successCondition: event.target.value })} placeholder="怎样算完成故事" className={INPUT_CLASS} />
      </label>
      <label className="space-y-1 text-[11px] text-sky-700">
        <span>失败条件（可选）</span>
        <Input value={draft.failureCondition} onChange={(event) => onChange({ failureCondition: event.target.value })} placeholder="什么情况会失败" className={INPUT_CLASS} />
      </label>
    </>
  );
}

export function StoryCoreFields(props: StoryCoreFieldsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <StoryPrimaryFields {...props} />
      <StorySceneFields {...props} />
      <StoryConditionFields {...props} />
    </div>
  );
}

export { TEXTAREA_CLASS as STORY_TEXTAREA_CLASS };
