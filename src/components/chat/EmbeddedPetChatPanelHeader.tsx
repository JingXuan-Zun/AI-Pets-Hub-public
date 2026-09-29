import { type PointerEvent as ReactPointerEvent } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { WindowFrameControls } from '../WindowFrameControls';
import { type EmbeddedPetChatPanelDragHandler } from './embeddedPetChatPanelTypes';

interface EmbeddedPetChatPanelHeaderProps {
  dragDisabled: boolean;
  isMinimized: boolean;
  personalityName: string;
  voiceEnabled: boolean;
  onClose: () => void;
  onStartDrag: EmbeddedPetChatPanelDragHandler;
  onToggleMinimized: () => void;
  onToggleVoiceEnabled: () => void;
}

export function EmbeddedPetChatPanelHeader({
  dragDisabled,
  isMinimized,
  personalityName,
  voiceEnabled,
  onClose,
  onStartDrag,
  onToggleMinimized,
  onToggleVoiceEnabled,
}: EmbeddedPetChatPanelHeaderProps) {
  const stopHeaderControlDrag = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  return (
    <div
      className="shrink-0 flex items-center justify-between border-b border-sky-100/80 bg-[linear-gradient(135deg,rgba(252,254,255,0.88),rgba(236,245,253,0.78))] px-5 py-4"
      onPointerDown={dragDisabled ? undefined : onStartDrag}
    >
      <div className="min-w-0 flex items-center gap-2">
        <div className="h-2 w-2 shrink-0 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.4)]" />
        <span className="truncate text-xs font-semibold tracking-[0.24em] text-sky-950">{personalityName}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleVoiceEnabled}
          onPointerDown={stopHeaderControlDrag}
          className="h-8 w-8 rounded-full text-sky-700 hover:bg-sky-50/90 hover:text-sky-950"
          title={voiceEnabled ? '关闭语音播报' : '开启语音播报'}
        >
          {voiceEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
        </Button>
        <WindowFrameControls
          className="-my-4 -mr-5 ml-2"
          closeTitle="关闭聊天面板"
          minimizeTitle={isMinimized ? '展开聊天面板' : '收纳聊天面板'}
          onClose={onClose}
          onMinimize={onToggleMinimized}
        />
      </div>
    </div>
  );
}
