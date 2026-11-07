import { RotateCcw } from 'lucide-react';
import { effectiveCharge, urgeToSpeak } from '../../character-cognition/characterCognitionRules';
import { clearCharacterCognition, useCharacterCognitionMap } from '../../character-cognition/characterCognitionStore';
import { getDesktopPetSlots } from '../../multiPetRoster';
import type { PetConfig } from '../../types';

// "她此刻在想什么": each character's mood, what is on her mind (and how strongly), and who she
// wants to talk to — so the cognition layer is never a black box. Clearing one makes her start
// again from her persona.

function formatAgo(timestamp: number, now: number) {
  const minutes = Math.round((now - timestamp) / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} 小时前` : `${Math.round(hours / 24)} 天前`;
}

export function SettingsCharacterCognitionPanel({ config }: { config: PetConfig }) {
  const states = useCharacterCognitionMap();
  const now = Date.now();
  const slots = getDesktopPetSlots(config);
  const nameOf = (target: string) => (target === 'user' ? '你' : target);

  return (
    <div className="space-y-2">
      {slots.map((slot) => {
        const state = states[slot.id];
        return (
          <div key={slot.id} className="rounded-md border border-border/70 bg-background/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-foreground">
                {slot.personality.name}
                {state ? <span className="ml-2 font-normal text-muted-foreground">心情：{state.mood.label} · 想说话 {urgeToSpeak(state, now)}</span> : null}
              </div>
              {state ? (
                <button
                  type="button"
                  onClick={() => clearCharacterCognition(slot.id)}
                  title="清空，下次从她的人设重新读起"
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-2xs text-muted-foreground hover:bg-muted"
                >
                  <RotateCcw className="h-3 w-3" />重新读人设
                </button>
              ) : null}
            </div>
            {!state ? (
              <div className="mt-1 text-2xs text-muted-foreground">还没读过她的人设：打开软件一会儿后会自动读。</div>
            ) : (
              <div className="mt-1.5 space-y-1 text-2xs leading-5 text-muted-foreground">
                {state.baseline.rules.length ? <div>不会变的：{state.baseline.rules.join('；')}</div> : null}
                {state.baseline.neverNegativeTowardUser ? <div>对你的感情：只会变好，不会变冷淡</div> : null}
                {state.concerns.length ? state.concerns.map((concern) => {
                  const charge = Math.round(effectiveCharge(concern, now));
                  return (
                    <div key={concern.id} className="flex items-center gap-2">
                      <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${charge}%` }} />
                      </span>
                      <span className="text-foreground">{concern.text}</span>
                    </div>
                  );
                }) : <div>心里暂时没有特别惦记的事。</div>}
                {state.toward ? <div>想对{nameOf(state.toward.target)}说话：{state.toward.why}</div> : null}
                <div>{state.lastChange ? `${state.lastChange} · ` : ''}{formatAgo(state.updatedAt, now)}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
