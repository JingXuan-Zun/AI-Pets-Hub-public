import { PROACTIVE_LIMITS } from '../../character-cognition/proactiveSpeechRules';
import { useProactiveSpeechSnapshot } from '../../character-cognition/proactiveSpeechStore';
import {
  lifeCompanionRuntimeOverrideStore,
  useLifeCompanionRuntimeOverride,
} from '../../life-companion/lifeCompanionRuntimeOverride';

// Under the 主动找你聊天 switch: how often they spoke today, who said what and why, and why
// nobody is speaking right now.

function formatTime(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function SettingsProactiveSpeechStatus() {
  const snapshot = useProactiveSpeechSnapshot();
  const override = useLifeCompanionRuntimeOverride();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const today = snapshot.log.filter((entry) => entry.at >= dayStart.getTime());
  const recent = [...snapshot.log].sort((left, right) => right.at - left.at).slice(0, 3);

  return (
    <div className="space-y-2 rounded-sm border border-border/70 bg-background/40 p-2 text-2xs leading-5 text-muted-foreground">
      <div className="flex items-center justify-between gap-2">
        <span>今天主动说了 <span className="font-semibold text-primary">{today.length}</span> / {PROACTIVE_LIMITS.perDay} 次</span>
        <button
          type="button"
          className="rounded-sm border border-border px-2 py-0.5 text-2xs hover:bg-secondary"
          onClick={() => lifeCompanionRuntimeOverrideStore.setManualSuspended(!override.manualSuspended)}
        >
          {override.manualSuspended ? '继续' : '先暂停（到下次启动）'}
        </button>
      </div>
      {override.manualSuspended
        ? <div className="text-amber-500">已暂停，到下次启动前都不会主动开口。</div>
        : snapshot.waitingReason ? <div>现在没开口：{snapshot.waitingReason}</div> : null}
      {recent.length ? (
        <div className="space-y-1">
          {recent.map((entry) => (
            <div key={`${entry.roleId}-${entry.at}`} className="truncate">
              {formatTime(entry.at)} {entry.name}{entry.kind === 'welcome-back' ? '（你回来时）' : ''}：因为惦记“{entry.concernText}”
            </div>
          ))}
        </div>
      ) : <div>还没有人主动说过话。</div>}
    </div>
  );
}
