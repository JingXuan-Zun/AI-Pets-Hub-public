import { useEffect, useState } from 'react';
import { AlarmClock, Check, ClipboardCheck, Repeat, Timer, Trash2 } from 'lucide-react';
import { createProductivityId, normalizeProductivitySettings } from '../../../productivity/productivitySettings';
import { formatDueTime, localDateKey, REPEAT_LABELS } from '../../../productivity/productivityTime';
import type { ProductivitySettings } from '../../../productivity/productivityTypes';
import type { PetConfig, PetConfigUpdateHandler } from '../../../types';
import { ChatHubWorkTaskCard } from './ChatHubWorkTaskCard';

const PANEL_CLASS = 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/80 hub-glass-panel shadow-[0_18px_48px_rgba(158,84,140,0.16)]';
const CARD_CLASS = 'rounded-2xl border border-white/80 hub-glass-card px-4 py-3';
const ICON_BUTTON_CLASS = 'shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive';

/**
 * 「任务」页：角色帮你记下的提醒、待办和番茄钟。和对话里说的是同一份数据——
 * 在这里勾掉或删掉，角色也会知道；跟角色说“三点提醒我喝水”，这里马上出现。
 */
export function ChatHubTasksPage({ config, onUpdateConfig }: { config: PetConfig; onUpdateConfig: PetConfigUpdateHandler }) {
  const productivity = normalizeProductivitySettings(config.settings.productivity);
  const [now, setNow] = useState(() => Date.now());
  const [todoDraft, setTodoDraft] = useState('');
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const save = (next: ProductivitySettings) => {
    onUpdateConfig({ ...config, settings: { ...config.settings, productivity: next } }, { persist: true });
  };
  const reminders = [...productivity.reminders].sort((left, right) => left.dueAt - right.dueAt);
  const openTodos = productivity.todos.filter((item) => !item.done);
  const doneTodos = productivity.todos.filter((item) => item.done);
  const pomodoro = productivity.pomodoro;
  const today = localDateKey(now);
  const completedToday = pomodoro.completedTodayDate === today ? pomodoro.completedToday : 0;
  const minutesLeft = pomodoro.phaseEndsAt ? Math.max(0, Math.ceil((pomodoro.phaseEndsAt - now) / 60_000)) : 0;

  const addTodo = () => {
    const text = todoDraft.trim();
    if (!text) return;
    save({ ...productivity, todos: [...productivity.todos, { createdAt: Date.now(), done: false, doneAt: null, id: createProductivityId('todo'), text }] });
    setTodoDraft('');
  };
  const toggleTodo = (id: string) => save({
    ...productivity,
    todos: productivity.todos.map((item) => (item.id === id ? { ...item, done: !item.done, doneAt: item.done ? null : Date.now() } : item)),
  });
  const startPomodoro = () => {
    const started = Date.now();
    save({
      ...productivity,
      pomodoro: {
        ...pomodoro,
        completedToday,
        completedTodayDate: today,
        phase: 'focus',
        phaseEndsAt: started + pomodoro.focusMinutes * 60_000,
        task: '',
      },
    });
  };

  return (
    <section className={PANEL_CLASS}>
      <header className="flex shrink-0 items-center gap-3 border-b border-white/70 px-6 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
          <ClipboardCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-foreground">任务</h2>
          <p className="truncate text-xs text-muted-foreground">角色帮你记下的进度卡、提醒、待办和番茄钟。直接跟角色说也可以。</p>
        </div>
      </header>
      <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        <ChatHubWorkTaskCard config={config} onUpdateConfig={onUpdateConfig} />

        <div className={CARD_CLASS}>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary"><Timer className="h-3.5 w-3.5" />番茄钟</div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              {pomodoro.phase === 'idle'
                ? `没在计时 · 专注 ${pomodoro.focusMinutes} 分钟，休息 ${pomodoro.breakMinutes} 分钟`
                : `${pomodoro.phase === 'focus' ? '专注中' : '休息中'}${pomodoro.task ? `：${pomodoro.task}` : ''} · 还剩约 ${minutesLeft} 分钟`}
              <span className="ml-2 text-xs text-muted-foreground">今天完成 {completedToday} 个</span>
            </p>
            <button
              type="button"
              onClick={() => (pomodoro.phase === 'idle' ? startPomodoro() : save({ ...productivity, pomodoro: { ...pomodoro, phase: 'idle', phaseEndsAt: null, task: '' } }))}
              className="rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-xs text-foreground hover:bg-white"
            >
              {pomodoro.phase === 'idle' ? '开始专注' : '停止'}
            </button>
          </div>
        </div>

        <div className={CARD_CLASS}>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary"><AlarmClock className="h-3.5 w-3.5" />提醒</div>
          {reminders.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">还没有提醒。跟角色说“下午三点提醒我喝水”“每天早上八点提醒我吃药”就能加。</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {reminders.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 text-xs text-muted-foreground">{formatDueTime(item.dueAt, now)}</span>
                  <p className="min-w-0 flex-1 truncate text-sm text-foreground">{item.text}</p>
                  {item.repeat !== 'none' ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-2xs text-primary"><Repeat className="h-3 w-3" />{REPEAT_LABELS[item.repeat]}</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => save({ ...productivity, reminders: productivity.reminders.filter((reminder) => reminder.id !== item.id) })}
                    className={ICON_BUTTON_CLASS}
                    title="取消这个提醒"
                    aria-label="取消这个提醒"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={CARD_CLASS}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary"><Check className="h-3.5 w-3.5" />待办 · {openTodos.length} 项没做完</div>
            {doneTodos.length ? (
              <button type="button" onClick={() => save({ ...productivity, todos: openTodos })} className="text-2xs text-muted-foreground hover:text-foreground">
                清掉做完的 {doneTodos.length} 项
              </button>
            ) : null}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(event) => { event.preventDefault(); addTodo(); }}
          >
            <input
              value={todoDraft}
              onChange={(event) => setTodoDraft(event.target.value)}
              placeholder="加一项待办，回车确认"
              className="min-w-0 flex-1 rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            />
          </form>
          {productivity.todos.length ? (
            <ul className="mt-2 space-y-1.5">
              {[...openTodos, ...doneTodos].map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleTodo(item.id)}
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${item.done ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50 bg-white/70'}`}
                    aria-label={item.done ? '标记为没做完' : '标记为做完'}
                  >
                    {item.done ? <Check className="h-3 w-3" /> : null}
                  </button>
                  <p className={`min-w-0 flex-1 truncate text-sm ${item.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{item.text}</p>
                  <button
                    type="button"
                    onClick={() => save({ ...productivity, todos: productivity.todos.filter((todo) => todo.id !== item.id) })}
                    className={ICON_BUTTON_CLASS}
                    title="删除这项待办"
                    aria-label="删除这项待办"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">待办是空的。可以在上面输入，也可以跟角色说“把买牛奶加到待办”。</p>
          )}
        </div>
      </div>
    </section>
  );
}
