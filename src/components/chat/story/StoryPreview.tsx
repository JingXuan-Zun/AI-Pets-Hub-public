import type { StoryDefinition, StoryEntry, StoryParticipantOption } from './storyTypes';
import { getStoryPromptOrderList } from './storyPromptPresetSchema';

function PreviewList(props: { enabled: boolean; entries: StoryEntry[]; title: string }) {
  if (!props.enabled) return <p className="text-[11px] text-sky-400">{props.title}：未启用</p>;
  const entries = props.entries.filter((entry) => entry.enabled && entry.text.trim());
  return (
    <section>
      <h4 className="text-xs font-semibold text-sky-950">{props.title}</h4>
      {entries.length > 0 ? (
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-[11px] text-sky-700">
          {entries.map((entry) => <li key={entry.id}>{entry.text}</li>)}
        </ol>
      ) : <p className="mt-1 text-[11px] text-sky-400">未填写</p>}
    </section>
  );
}

function StoryPromptPreview({ draft }: { draft: StoryDefinition }) {
  if (!draft.customPromptEnabled) return null;
  if (draft.customPromptMode === 'manual') {
    return draft.customPrompt.trim() ? (
      <section>
        <h4 className="text-xs font-semibold text-sky-950">自定义提示词 <span className="text-[9px] text-amber-600">破甲词</span></h4>
        <p className="mt-1 text-[9px] text-sky-500">{draft.customPromptManualRole}</p>
        <p className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-[11px]">{draft.customPrompt}</p>
      </section>
    ) : null;
  }
  const order = draft.customPromptPreset ? getStoryPromptOrderList(draft.customPromptPreset)?.order ?? [] : [];
  const enabledCount = order.filter((entry) => entry.enabled).length;
  return (
    <section>
      <h4 className="text-xs font-semibold text-sky-950">自定义提示词 <span className="text-[9px] text-amber-600">破甲词 · JSON</span></h4>
      <p className="mt-1 text-[11px] text-sky-700">{draft.customPromptPresetName || '未命名预设'} · 已启用 {enabledCount}/{order.length} 个模块</p>
    </section>
  );
}

export function StoryPreview(props: {
  draft: StoryDefinition;
  participants: StoryParticipantOption[];
}) {
  const selectedNames = props.participants
    .filter((participant) => props.draft.participantIds.includes(participant.id))
    .map((participant) => participant.name);
  return (
    <div className="space-y-3 rounded-xl border border-sky-200 bg-white p-4 text-xs text-sky-800">
      <div>
        <h3 className="text-base font-semibold text-sky-950">{props.draft.title || '未命名故事'}</h3>
        <p className="mt-1 whitespace-pre-wrap">{props.draft.premise || '未填写故事梗概。'}</p>
      </div>
      <p><span className="font-semibold text-sky-950">用户身份：</span>{props.draft.userRole || '未设置'}</p>
      <p><span className="font-semibold text-sky-950">参与角色：</span>{selectedNames.join('、') || '未选择'}</p>
      <p className="whitespace-pre-wrap"><span className="font-semibold text-sky-950">场景：</span>{props.draft.setting || '未设置'}</p>
      <StoryPromptPreview draft={props.draft} />
      <PreviewList title="故事目标" enabled={props.draft.sections.goals} entries={props.draft.goals} />
      <PreviewList title="特定任务" enabled={props.draft.sections.tasks} entries={props.draft.tasks} />
      <PreviewList title="故事规则" enabled={props.draft.sections.rules} entries={props.draft.rules} />
      {props.draft.customScript && (
        <section>
          <h4 className="text-xs font-semibold text-sky-950">用户剧本</h4>
          <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-[11px]">{props.draft.customScript}</p>
        </section>
      )}
    </div>
  );
}
