import { ChevronDown, ListChecks } from 'lucide-react';
import { buildStoryStateSummary } from './storyStateSummary';
import type { StoryParticipantOption, StorySessionState } from './storyTypes';

interface StoryStateOverviewProps {
  embedded?: boolean;
  participants: StoryParticipantOption[];
  session: StorySessionState;
}

function SummaryList({ emptyText, items }: { emptyText: string; items: string[] }) {
  return items.length > 0 ? (
    <ul className="mt-1 space-y-1">
      {items.map((item) => <li key={item}>• {item}</li>)}
    </ul>
  ) : <span className="ml-1 text-slate-400">{emptyText}</span>;
}

export function StoryStateOverview({ embedded = false, participants, session }: StoryStateOverviewProps) {
  const summary = buildStoryStateSummary(session, participants);
  return (
    <details className={embedded
      ? 'group w-full border-t border-slate-100 px-5 py-4 text-xs text-slate-700'
      : 'group rounded-xl border border-slate-200 bg-white/95 px-4 py-3 text-xs text-slate-700 shadow-sm'}>
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-slate-900">
        <ListChecks className="h-4 w-4 text-sky-700" />当前状态概览
        <span className="font-normal text-slate-400">点击展开或收起</span>
        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
        <div><b>时间：</b>{summary.time}</div>
        <div><b>累计推进：</b>{summary.elapsedTime}</div>
        <div><b>场景：</b>{summary.scene}</div>
        <div><b>当前角色：</b>{summary.activeCharacters.join('、') || '暂无'}</div>
        <div><b>物品：</b>{summary.inventory.join('、') || '暂无'}</div>
        <div className="sm:col-span-2"><b>角色当前心理</b><SummaryList items={summary.characterThoughts} emptyText="暂无可公开心理" /></div>
        <div><b>角色状态</b><SummaryList items={summary.characters} emptyText="暂无变化" /></div>
        <div><b>关系状态</b><SummaryList items={summary.relationships} emptyText="暂无记录" /></div>
        <div><b>目标</b><SummaryList items={summary.goals} emptyText="未启用" /></div>
        <div><b>任务</b><SummaryList items={summary.tasks} emptyText="未启用" /></div>
        <div className="sm:col-span-2"><b>最近事件</b><SummaryList items={summary.recentEvents} emptyText="暂无记录" /></div>
      </div>
    </details>
  );
}
