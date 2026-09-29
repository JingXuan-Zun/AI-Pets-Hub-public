import { Button } from '../../../components/ui/button';
import type { DesktopPetChatMode } from '../../types';

const MODES: Array<{ label: string; mode: DesktopPetChatMode }> = [
  { label: '私聊', mode: 'single' },
  { label: '群聊', mode: 'group' },
  { label: '故事', mode: 'story' },
];

export function ChatModeSelector(props: {
  chatMode: DesktopPetChatMode;
  onChange: (mode: DesktopPetChatMode) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 pr-8">
      {MODES.map(({ label, mode }) => {
        const active = props.chatMode === mode;
        return (
          <Button
            key={mode}
            type="button"
            size="sm"
            variant={active ? 'default' : 'secondary'}
            onClick={() => props.onChange(mode)}
            className={`h-8 w-full rounded-full border px-4 text-2xs tracking-[0.14em] ${active
              ? '!border-primary !bg-primary !text-white'
              : '!border-border !bg-white !text-foreground hover:!bg-muted'}`}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
