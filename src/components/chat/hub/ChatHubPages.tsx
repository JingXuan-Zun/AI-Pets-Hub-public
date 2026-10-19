import { Check, SlidersHorizontal } from 'lucide-react';
import { type PetConfig } from '../../../types';
import { resolveActiveChatSlot, type ChatTargetOption } from '../multiPetChat';
import { HubAvatar, resolveHubSignature } from './chatHubShared';

const PANEL_CLASS = 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/80 hub-glass-panel shadow-[0_18px_48px_rgba(158,84,140,0.16)]';

export interface ChatHubRolesPageProps {
  activePetId: string;
  config: PetConfig;
  petOptions: ChatTargetOption[];
  onChooseRole: (petId: string) => void;
  onEditRoles: () => void;
}

/** 「角色」页：选一个角色聊天。 */
export function ChatHubRolesPage({ activePetId, config, petOptions, onChooseRole, onEditRoles }: ChatHubRolesPageProps) {
  return (
    <section className={PANEL_CLASS}>
      <header className="flex items-center justify-between border-b border-white/70 px-6 py-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">角色</h2>
          <p className="text-xs text-muted-foreground">选一个角色开始聊天</p>
        </div>
        <button
          type="button"
          onClick={onEditRoles}
          className="flex items-center gap-1.5 rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-xs text-foreground hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          高级设置
        </button>
      </header>
      <div className="custom-scrollbar grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto p-5">
        {petOptions.map((option) => {
          const slot = resolveActiveChatSlot(config, option.id);
          const isActive = option.id === activePetId;
          const signature = slot ? resolveHubSignature(slot.personality.greeting) : '';
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChooseRole(option.id)}
              className={[
                'relative flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                isActive ? 'border-primary/50 bg-primary/10' : 'border-white/80 hub-glass-card hover:bg-white/80',
              ].join(' ')}
            >
              <HubAvatar slot={slot} name={option.name} className="h-12 w-12 text-base ring-2 ring-white" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{option.name}</span>
                {signature ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{signature}</span> : null}
              </span>
              {isActive ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
