import { NotebookPen, Trash2 } from 'lucide-react';
import { normalizeWorkTaskSettings, projectDecisions, MAX_RECENT_TASKS, type WorkTaskSettings } from '../../../work-tasks/workTaskSettings';
import type { PetConfig, PetConfigUpdateHandler } from '../../../types';

const CARD_CLASS = 'rounded-2xl border border-white/80 hub-glass-card px-4 py-3';
const ICON_BUTTON_CLASS = 'shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive';
const SHOWN_DECISIONS = 20;

/**
 * The progress card (进度卡) the characters keep while the user works: the open task and the project's
 * settled decisions. Same data as in the conversation (work.* tools).
 */
export function ChatHubWorkTaskCard({ config, onUpdateConfig }: { config: PetConfig; onUpdateConfig: PetConfigUpdateHandler }) {
  const work = normalizeWorkTaskSettings(config.settings.workTasks);
  const task = work.activeTask;
  const save = (next: WorkTaskSettings) => {
    onUpdateConfig({ ...config, settings: { ...config.settings, workTasks: next } }, { persist: true });
  };
  const decisions = task ? projectDecisions(work, task.project).slice(-SHOWN_DECISIONS) : [];
  const finishTask = () => {
    if (!task) return;
    const now = Date.now();
    save({ ...work, activeTask: null, recentTasks: [{ ...task, finishedAt: now, updatedAt: now }, ...work.recentTasks].slice(0, MAX_RECENT_TASKS) });
  };

  return (
    <div className={CARD_CLASS}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary"><NotebookPen className="h-3.5 w-3.5" />进度卡</div>
        {task ? (
          <button type="button" onClick={finishTask} className="rounded-full border border-white/80 bg-white/70 px-3 py-1 text-xs text-foreground hover:bg-white">
            收起
          </button>
        ) : null}
      </div>
      {task ? (
        <div className="mt-2 space-y-1.5 text-sm text-foreground">
          <p className="font-semibold">{task.title}{task.project ? <span className="ml-2 text-xs font-normal text-muted-foreground">{task.project}</span> : null}</p>
          {task.goal ? <p><span className="text-xs text-muted-foreground">目标：</span>{task.goal}</p> : null}
          {task.progress ? <p><span className="text-xs text-muted-foreground">做到：</span>{task.progress}</p> : null}
          {task.next ? <p><span className="text-xs text-muted-foreground">下一步：</span>{task.next}</p> : null}
          {decisions.length ? (
            <div className="pt-1">
              <p className="text-xs text-muted-foreground">{task.project || '这个项目'}已定下的事</p>
              <ul className="mt-1 space-y-1">
                {decisions.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm">{item.text}</span>
                    <button
                      type="button"
                      onClick={() => save({ ...work, decisions: work.decisions.filter((entry) => entry.id !== item.id) })}
                      className={ICON_BUTTON_CLASS}
                      title="删除这条决定"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 space-y-1.5">
          <p className="text-sm text-muted-foreground">没有正在做的任务。跟角色说“今天做战斗系统的翻滚”，她就会建一张进度卡，一直记着目标、定下的事和下一步。</p>
          {work.recentTasks.slice(0, 3).map((item) => (
            <p key={item.id} className="text-xs text-muted-foreground">
              上次：{item.title}{item.next ? ` · 下一步 ${item.next}` : item.progress ? ` · ${item.progress}` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
