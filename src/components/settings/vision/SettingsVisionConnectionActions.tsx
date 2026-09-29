import { Monitor, RotateCcw } from 'lucide-react';

interface SettingsVisionConnectionActionsProps {
  isDesktopConnected: boolean;
  onStartConfiguredScreenCapture: () => Promise<void>;
  onStopScreenCapture: () => Promise<void> | void;
}

export function SettingsVisionConnectionActions({
  isDesktopConnected,
  onStartConfiguredScreenCapture,
  onStopScreenCapture,
}: SettingsVisionConnectionActionsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => void onStartConfiguredScreenCapture()}
        className={`flex w-full items-center justify-center gap-2 rounded-sm border p-3 transition-all ${
          isDesktopConnected
            ? 'border-green-500/50 bg-green-500/20 text-green-500 hover:bg-green-500/25'
            : 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20'
        }`}
        >
        <Monitor className="h-4 w-4" />
        <span className="text-2xs font-bold tracking-widest uppercase">
          {isDesktopConnected ? '重新连接桌面' : '连接桌面'}
        </span>
      </button>
      <button
        type="button"
        onClick={() => void onStopScreenCapture()}
        disabled={!isDesktopConnected}
        className={`flex w-full items-center justify-center gap-2 rounded-sm border p-3 transition-all ${
          isDesktopConnected
            ? 'border-border bg-secondary/70 text-foreground hover:border-red-500/60 hover:text-red-400'
            : 'cursor-not-allowed border-border/60 bg-secondary/30 text-muted-foreground'
        }`}
      >
        <RotateCcw className="h-4 w-4" />
        <span className="text-2xs font-bold tracking-widest uppercase">断开连接</span>
      </button>
    </div>
  );
}
