import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';

interface SettingsVisionAreaPanelProps {
  captureCropRect: DesktopPetCaptureRectLike;
  captureMode: DesktopPetCaptureMode;
  desktopAreaSelection: DesktopPetAreaSelectionLike | null;
  isWindowAreaMode: boolean;
  selectedCaptureSource: DesktopPetCaptureSourceLike | null;
  onPickDesktopCaptureArea: () => Promise<DesktopPetAreaSelectionLike | null>;
  onSetCaptureMode: (mode: DesktopPetCaptureMode) => void;
  onUpdateCaptureCropRect: (key: keyof DesktopPetCaptureRectLike, value: string) => void;
}

export function SettingsVisionAreaPanel({
  captureCropRect,
  captureMode,
  desktopAreaSelection,
  isWindowAreaMode,
  selectedCaptureSource,
  onPickDesktopCaptureArea,
  onSetCaptureMode,
  onUpdateCaptureCropRect,
}: SettingsVisionAreaPanelProps) {
  return (
    <>
      {isWindowAreaMode && (
        <div
          className={`space-y-4 rounded-sm border p-4 transition-colors ${
            captureMode === 'area'
              ? 'border-primary/40 bg-primary/5'
              : 'border-primary/20 bg-primary/5'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-2xs font-bold tracking-widest text-primary">自定义区域捕捉</div>
              <div className="text-2xs text-muted-foreground">
                直接在桌面上拉框选区，完成后可以在这里继续微调 X、Y、宽度和高度。
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {desktopAreaSelection && captureMode !== 'area' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onSetCaptureMode('area')}
                  className="h-9 rounded-sm border-border px-3 text-2xs tracking-widest"
                >
                  使用选区
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => void onPickDesktopCaptureArea().then((selection) => {
                  if (selection) {
                    onSetCaptureMode('area');
                  }
                })}
                className="h-9 rounded-sm border-primary/40 bg-primary/10 px-3 text-2xs tracking-widest text-primary hover:bg-primary/20"
              >
                {desktopAreaSelection ? '重新框选' : '开始框选'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-sm border border-border bg-background/40 p-3">
              <div className="text-3xs tracking-widest text-muted-foreground">所在屏幕</div>
              <div className="mt-1 text-xs font-medium text-foreground">
                {desktopAreaSelection ? desktopAreaSelection.displayLabel || desktopAreaSelection.sourceName : '未选择'}
              </div>
            </div>
            <div className="rounded-sm border border-border bg-background/40 p-3">
              <div className="text-3xs tracking-widest text-muted-foreground">裁切尺寸</div>
              <div className="mt-1 text-xs font-medium text-foreground">
                {desktopAreaSelection
                  ? `${Math.round(captureCropRect.width)} x ${Math.round(captureCropRect.height)}`
                  : '未选择'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <Input type="number" min={0} disabled={!desktopAreaSelection} className="h-9 rounded-sm border-border bg-secondary text-xs focus-visible:ring-primary" value={captureCropRect.x} onChange={(event) => onUpdateCaptureCropRect('x', event.target.value)} placeholder="X" />
            <Input type="number" min={0} disabled={!desktopAreaSelection} className="h-9 rounded-sm border-border bg-secondary text-xs focus-visible:ring-primary" value={captureCropRect.y} onChange={(event) => onUpdateCaptureCropRect('y', event.target.value)} placeholder="Y" />
            <Input type="number" min={1} disabled={!desktopAreaSelection} className="h-9 rounded-sm border-border bg-secondary text-xs focus-visible:ring-primary" value={captureCropRect.width} onChange={(event) => onUpdateCaptureCropRect('width', event.target.value)} placeholder="W" />
            <Input type="number" min={1} disabled={!desktopAreaSelection} className="h-9 rounded-sm border-border bg-secondary text-xs focus-visible:ring-primary" value={captureCropRect.height} onChange={(event) => onUpdateCaptureCropRect('height', event.target.value)} placeholder="H" />
          </div>

          <div className="font-mono text-3xs text-muted-foreground">
            {desktopAreaSelection
              ? `裁切基准：${desktopAreaSelection.cropBasisWidth} x ${desktopAreaSelection.cropBasisHeight} // 来源：${desktopAreaSelection.sourceName}`
              : '当前还没有完成区域框选。'}
          </div>
        </div>
      )}

      <div className="font-mono text-3xs text-muted-foreground">
        {captureMode === 'area'
          ? (desktopAreaSelection
            ? `当前选区：${desktopAreaSelection.sourceName} / ${Math.round(captureCropRect.width)} x ${Math.round(captureCropRect.height)}`
            : '当前还没有选中的区域。')
          : (selectedCaptureSource
            ? `当前源：${selectedCaptureSource.name}`
            : (captureMode === 'screen'
              ? '当前还没有选择屏幕源。'
              : '当前还没有选择窗口源。'))}
      </div>
    </>
  );
}
