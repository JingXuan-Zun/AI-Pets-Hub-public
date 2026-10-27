import { useState } from 'react';
import type { PetConfig } from '../../types';
import { createSelfCheckDeps } from '../../self-check/selfCheckDeps';
import { readSelfCheckLog, runSelfCheck } from '../../self-check/selfCheckRunner';
import type { SelfCheckEntry } from '../../self-check/selfCheckTypes';

// 一键体检: runs every check that applies to the current settings, fixes what is safe to fix,
// and lists the results with advice. The same check the character runs when asked.

const STATUS_STYLE: Record<SelfCheckEntry['result']['status'], { label: string; className: string }> = {
  ok: { className: 'border-emerald-200 bg-emerald-50 text-emerald-800', label: '正常' },
  problem: { className: 'border-rose-200 bg-rose-50 text-rose-800', label: '有问题' },
  unknown: { className: 'border-amber-200 bg-amber-50 text-amber-800', label: '没查清' },
};

export function SettingsHealthTab({ localConfig }: { localConfig: PetConfig }) {
  const [running, setRunning] = useState(false);
  const [entries, setEntries] = useState<SelfCheckEntry[] | null>(null);
  const lastRun = readSelfCheckLog().at(-1)?.checkedAt;

  const run = async () => {
    setRunning(true);
    try {
      setEntries(await runSelfCheck(createSelfCheckDeps(localConfig)));
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="space-y-4 rounded-sm border border-border bg-secondary/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-2xs font-bold uppercase tracking-widest text-primary">体检</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            检查聊天模型、本地语音、QQ 连接这些常出问题的地方；能安全自动修的（比如启动本地语音服务）会直接修好并再查一遍。也可以直接跟角色说“帮我检查一下哪里有问题”。
          </p>
          {lastRun ? <p className="mt-1 text-2xs text-muted-foreground">上次体检：{new Date(lastRun).toLocaleString()}</p> : null}
        </div>
        <button
          type="button"
          disabled={running}
          onClick={() => { void run(); }}
          className="rounded-sm border border-primary/50 px-4 py-2 text-xs text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          {running ? '体检中…' : '一键体检'}
        </button>
      </div>

      {entries ? (
        entries.length ? (
          <ul className="space-y-2">
            {entries.map((entry) => {
              const style = STATUS_STYLE[entry.result.status];
              return (
                <li key={entry.id} className="rounded-sm border border-border bg-background/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">{entry.title}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-2xs ${style.className}`}>{style.label}</span>
                  </div>
                  <p className="mt-1 text-2xs leading-5 text-muted-foreground">{entry.result.summary}</p>
                  {entry.repair ? <p className="mt-1 text-2xs leading-5 text-muted-foreground">{entry.repair.ok ? '已自动修复' : '自动修复没成功'}：{entry.repair.summary}</p> : null}
                  {entry.result.status === 'problem' && entry.result.advice ? <p className="mt-1 text-2xs leading-5 text-primary">建议：{entry.result.advice}</p> : null}
                </li>
              );
            })}
          </ul>
        ) : <p className="text-xs text-muted-foreground">按现在的设置，没有需要检查的项目。</p>
      ) : null}
    </section>
  );
}
