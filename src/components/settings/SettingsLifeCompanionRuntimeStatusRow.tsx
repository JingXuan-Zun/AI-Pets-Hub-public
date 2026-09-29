import { useLifeCompanionRuntimeStatus } from '../../life-companion/lifeCompanionRuntimeStatus';

const PHASE_CLASS = {
  armed: 'text-primary',
  disabled: 'text-muted-foreground',
  'quiet-hours': 'text-amber-400',
  suspended: 'text-amber-400',
} as const;

const TEXT_STATE_CLASS = {
  backoff: 'text-amber-400',
  cooldown: 'text-amber-400',
  off: 'text-muted-foreground',
  ready: 'text-primary',
} as const;

function formatRuntimeTime(value: number | null) {
  if (!value) {
    return 'none';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatLlmDetail(status: ReturnType<typeof useLifeCompanionRuntimeStatus>) {
  if (status.llmBackoffRetryAfter) {
    return `llm retry ${formatRuntimeTime(status.llmBackoffRetryAfter)}`;
  }

  return status.detail;
}

export function SettingsLifeCompanionRuntimeStatusRow() {
  const status = useLifeCompanionRuntimeStatus();

  return (
    <div className="mb-3 grid grid-cols-3 gap-2 rounded-sm border border-border/70 bg-background/40 p-2 font-mono text-3xs">
      <div>
        <div className="text-3xs uppercase tracking-widest text-muted-foreground">runtime</div>
        <div className={PHASE_CLASS[status.phase]}>{status.phase}</div>
      </div>
      <div>
        <div className="text-3xs uppercase tracking-widest text-muted-foreground">text</div>
        <div className={TEXT_STATE_CLASS[status.textPromptState]}>{status.textPromptState}</div>
      </div>
      <div>
        <div className="text-3xs uppercase tracking-widest text-muted-foreground">llm</div>
        <div className={TEXT_STATE_CLASS[status.llmTextPromptState]}>{status.llmTextPromptState}</div>
      </div>
      <div className="text-muted-foreground">
        next {formatRuntimeTime(status.nextInteractionAt)}
      </div>
      <div className="col-span-2 text-muted-foreground">
        last {status.lastEvent}
      </div>
      <div className="col-span-3 truncate text-muted-foreground">{formatLlmDetail(status)}</div>
      {status.llmLastErrorMessage && (
        <div className="col-span-3 truncate text-amber-400">{status.llmLastErrorMessage}</div>
      )}
    </div>
  );
}
