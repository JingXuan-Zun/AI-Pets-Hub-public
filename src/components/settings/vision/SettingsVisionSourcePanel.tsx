import { Button } from '../../../../components/ui/button';

interface SettingsVisionSourcePanelProps {
  activePreviewSourceId: string;
  captureMode: DesktopPetCaptureMode;
  captureSourcesLoading: boolean;
  desktopAreaSelection: DesktopPetAreaSelectionLike | null;
  isWindowAreaMode: boolean;
  previewCaptureSources: DesktopPetCaptureSourceLike[];
  selectedCaptureSource: DesktopPetCaptureSourceLike | null;
  onActivateWindowAreaMode: () => void;
  onRefreshCaptureSources: () => void;
  onSetCaptureMode: (mode: DesktopPetCaptureMode) => void;
  onSetSelectedCaptureSourceId: (sourceId: string) => void;
}

export function SettingsVisionSourcePanel({
  activePreviewSourceId,
  captureMode,
  captureSourcesLoading,
  desktopAreaSelection,
  isWindowAreaMode,
  previewCaptureSources,
  selectedCaptureSource,
  onActivateWindowAreaMode,
  onRefreshCaptureSources,
  onSetCaptureMode,
  onSetSelectedCaptureSourceId,
}: SettingsVisionSourcePanelProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onSetCaptureMode('screen')}
          className={`h-8 rounded-sm border text-2xs tracking-widest transition-colors ${
            captureMode === 'screen'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:border-primary/60 hover:text-primary'
          }`}
        >
          屏幕
        </button>
        <button
          type="button"
          onClick={onActivateWindowAreaMode}
          className={`h-8 rounded-sm border text-2xs tracking-widest transition-colors ${
            isWindowAreaMode
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:border-primary/60 hover:text-primary'
          }`}
        >
          窗口 / 区域
        </button>
      </div>

      {captureSourcesLoading && (
        <div className="font-mono text-3xs tracking-widest text-muted-foreground">
          正在加载捕捉源...
        </div>
      )}

      <div className="grid max-h-72 grid-cols-2 gap-3 overflow-y-auto pr-1">
        {previewCaptureSources.length ? previewCaptureSources.map((source) => {
          const isSelected = activePreviewSourceId === source.id;

          return (
            <button
              key={source.id}
              type="button"
              onClick={() => {
                if (source.type === 'screen' && captureMode !== 'screen') {
                  onSetCaptureMode('area');
                  return;
                }

                onSetSelectedCaptureSourceId(source.id);
                onSetCaptureMode(source.type);
              }}
              className={`group overflow-hidden rounded-sm border bg-background/40 text-left transition-all ${
                isSelected
                  ? 'border-primary shadow-sm'
                  : 'border-border hover:border-primary/60'
              }`}
            >
              <div className="relative aspect-video overflow-hidden bg-black/50">
                {source.thumbnail ? (
                  <img src={source.thumbnail} alt={source.name} className="h-full w-full object-cover opacity-90 transition-transform group-hover:scale-[1.03]" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center px-3 text-center text-3xs tracking-widest text-muted-foreground">
                    {source.type === 'window' ? '暂无窗口预览。' : '暂无屏幕预览。'}
                  </div>
                )}
                <div className="absolute left-2 top-2 rounded border border-white/30 bg-black/60 px-2 py-0.5 font-mono text-3xs uppercase tracking-widest text-white">
                  {source.type === 'screen' ? '屏幕' : '窗口'}
                </div>
                {isSelected && (
                  <div className="absolute right-2 top-2 rounded border border-primary bg-primary/20 px-2 py-0.5 font-mono text-3xs uppercase tracking-widest text-primary">
                    已选中
                  </div>
                )}
              </div>
              <div className="space-y-1 p-2">
                <div className="flex items-center gap-2">
                  {source.appIcon ? (
                    <img src={source.appIcon} alt="" className="h-4 w-4 rounded-sm object-cover" />
                  ) : (
                    <div className="h-4 w-4 rounded-sm border border-border/70 bg-secondary/60" />
                  )}
                  <div className="min-w-0 truncate text-2xs font-bold tracking-wide text-foreground">{source.name}</div>
                </div>
                <div className="font-mono text-3xs text-muted-foreground">
                  {Math.round(source.width ?? 0)} x {Math.round(source.height ?? 0)}
                </div>
              </div>
            </button>
          );
        }) : (
          <div className="col-span-2 rounded-sm border border-dashed border-border p-4 text-center text-2xs uppercase tracking-widest text-muted-foreground">
            {captureSourcesLoading ? '正在等待捕捉源列表...' : '暂时没有可用的捕捉源。'}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="font-mono text-3xs text-muted-foreground">
          {captureMode === 'area'
            ? (desktopAreaSelection
              ? '区域框选已完成，你可以在下面继续微调裁切范围。'
              : '区域模式已就绪，请先开始桌面框选。')
            : (selectedCaptureSource
              ? `当前已选：${selectedCaptureSource.name}`
              : (captureMode === 'screen'
                ? '请选择一个屏幕源进行连接。'
                : '请选择窗口源，或直接开始区域框选。'))}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onRefreshCaptureSources}
          disabled={captureSourcesLoading}
          className="h-9 rounded-sm border-border px-3 text-2xs uppercase tracking-widest"
        >
          刷新
        </Button>
      </div>
    </>
  );
}
