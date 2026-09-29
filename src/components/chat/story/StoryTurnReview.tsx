import { Brain, ChevronDown } from 'lucide-react';
import { buildStoryTurnReview } from './storyTurnReviewSummary';
import type { StorySessionState } from './storyTypes';

interface StoryTurnReviewProps {
  embedded?: boolean;
  session: StorySessionState;
}

export function StoryTurnReview({ embedded = false, session }: StoryTurnReviewProps) {
  const items = buildStoryTurnReview(session);
  if (items.length === 0) return null;
  return (
    <details open className={embedded
      ? 'group w-full border-b border-violet-100 px-5 py-4 text-xs text-slate-700'
      : 'group mx-auto w-full max-w-4xl rounded-xl border border-violet-200 bg-white/95 px-4 py-3 text-xs text-slate-700 shadow-sm'}>
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-violet-700">
        <Brain className="h-4 w-4" />思考 / 剧情分析与输出计划（公开）
        <span className="font-normal text-slate-400">点击展开或收起</span>
        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 space-y-2 border-t border-violet-100 pt-3">
        <p className="text-[11px] text-slate-500">
          这里展示模型结合已有剧情与本轮要求形成的公开规划摘要，不包含隐藏思维链、系统提示或内部推理原文。
        </p>
        {items.map((item) => (
          <div key={item.label} className="leading-5">
            <b className="text-slate-900">{item.label}：</b>{item.text}
          </div>
        ))}
      </div>
    </details>
  );
}
