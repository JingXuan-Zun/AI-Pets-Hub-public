import { memo, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Slider } from '../../../components/ui/slider';
import { FoodAppearanceVisual } from '../food/FoodAppearanceVisual';
import { PetFoodCreationControls } from './PetFoodCreationControls';
import { resolveFoodAppearanceForFolder } from '../../foodAppearances';
import { type FolderItem, type PetConfig } from '../../types';

const STAT_SLIDER_MARKERS = [20, 40, 60, 80, 100];
const ACTIVITY_CONTROL_COLOR = '#2F80ED';
const ACTIVITY_REGION_EDGE_HANDLE_CLASS = 'pointer-events-auto absolute z-[70] bg-transparent';
const ACTIVITY_REGION_CORNER_HANDLE_CLASS = 'pointer-events-auto absolute z-[80] bg-transparent';

type Position = {
  x: number;
  y: number;
};

type Area = {
  width: number;
  height: number;
};

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

type FolderRenderItem = FolderItem & {
  renderPosition: Position;
};

type FolderVisualMetrics = {
  boundaryExtents: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  renderOffset: Position;
};

interface PetEnvironmentLayerProps {
  activityArea: Area;
  activityAreaScale: number;
  activityCenter: Position;
  config: PetConfig;
  folderRenderOffset: Position;
  folders: FolderRenderItem[];
  folderDragPreview: { folderId: string; position: Position } | null;
  isActivityRegionDragging: boolean;
  onFolderVisualMetricsChange: (metrics: FolderVisualMetrics) => void;
  onStartActivityRegionDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onStartActivityRegionResize: (event: ReactPointerEvent<HTMLDivElement>, direction: ResizeDirection) => void;
  onCreateFood: (appearanceId?: string) => void;
  onStartFolderDrag: (event: ReactPointerEvent<HTMLDivElement>, folder: FolderItem) => void;
  onUpdateStat: (key: 'affection' | 'hunger' | 'fatigue', value: number | number[]) => void;
}

export const PetEnvironmentLayer = memo(function PetEnvironmentLayer({
  activityArea,
  activityAreaScale,
  activityCenter,
  config,
  folderRenderOffset,
  folders,
  folderDragPreview,
  isActivityRegionDragging,
  onFolderVisualMetricsChange,
  onStartActivityRegionDrag,
  onStartActivityRegionResize,
  onCreateFood,
  onStartFolderDrag,
  onUpdateStat,
}: PetEnvironmentLayerProps) {
  const folderSampleRef = useRef<HTMLDivElement | null>(null);
  const folderSampleIconRef = useRef<HTMLDivElement | null>(null);
  const sampleAppearance = config.foodAppearances[0] ?? null;
  const [isStatusControlCollapsed, setIsStatusControlCollapsed] = useState(false);

  useEffect(() => {
    const sampleElement = folderSampleRef.current;
    const sampleIconElement = folderSampleIconRef.current;
    if (!sampleElement || !sampleIconElement) {
      return;
    }

    const measureFolderVisualMetrics = () => {
      const containerRect = sampleElement.getBoundingClientRect();
      const iconRect = sampleIconElement.getBoundingClientRect();
      if (
        containerRect.width <= 0
        || containerRect.height <= 0
        || iconRect.width <= 0
        || iconRect.height <= 0
      ) {
        return;
      }

      const iconCenterX = iconRect.left + iconRect.width / 2;
      const iconCenterY = iconRect.top + iconRect.height / 2;
      onFolderVisualMetricsChange({
        boundaryExtents: {
          left: Math.max(1, Math.round(iconRect.width / 2)),
          right: Math.max(1, Math.round(iconRect.width / 2)),
          top: Math.max(1, Math.round(iconRect.height / 2)),
          bottom: Math.max(1, Math.round(iconRect.height / 2)),
        },
        renderOffset: {
          x: Math.max(1, Math.round(iconCenterX - containerRect.left)),
          y: Math.max(1, Math.round(iconCenterY - containerRect.top)),
        },
      });
    };

    measureFolderVisualMetrics();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measureFolderVisualMetrics);
      return () => {
        window.removeEventListener('resize', measureFolderVisualMetrics);
      };
    }

    const observer = new ResizeObserver(() => {
      measureFolderVisualMetrics();
    });
    observer.observe(sampleElement);
    observer.observe(sampleIconElement);
    window.addEventListener('resize', measureFolderVisualMetrics);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measureFolderVisualMetrics);
    };
  }, [onFolderVisualMetricsChange]);

  return (
    <>
      {config.settings.activityAreaLimitEnabled && config.settings.activityBorderVisible && (
        <div
          className="pointer-events-none absolute z-[45] rounded-lg border border-[#2F80ED]/70 bg-transparent shadow-[0_0_18px_rgba(47,128,237,0.18)]"
          style={{
            left: activityCenter.x,
            top: activityCenter.y,
            width: activityArea.width,
            height: activityArea.height,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-[#2F80ED]/70" />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-[#2F80ED]/70" />
          <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-px bg-[#2F80ED]/70" />
          <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-px bg-[#2F80ED]/70" />

          <div
            data-desktop-pet-interactive="true"
            data-desktop-pet-window-shape="true"
            data-desktop-pet-native-scope="activity-region"
            className={`pointer-events-auto absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-[#2F80ED]/70 bg-black/35 px-3 py-1 font-mono text-[8px] uppercase tracking-[0.22em] text-[#2F80ED] ${isActivityRegionDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onPointerDown={onStartActivityRegionDrag}
            title="拖动整个活动区域"
          >
            拖动区域
          </div>

          <div className="absolute right-2 top-2 rounded border border-[#2F80ED]/70 bg-black/25 px-2 py-1 font-mono text-[9px] tracking-widest text-[#2F80ED]">
            ACTIVE {activityAreaScale}%
          </div>

          <div className="pointer-events-none absolute inset-0 z-30">
            <div
              data-desktop-pet-interactive="true"
              data-desktop-pet-activity-region-handle="true"
              data-desktop-pet-native-scope="activity-region"
              className={`${ACTIVITY_REGION_EDGE_HANDLE_CLASS} left-0 right-0 top-0 h-4 cursor-ns-resize border-t border-[#2F80ED]/70 bg-gradient-to-b from-[#2F80ED]/10 to-transparent`}
              onPointerDown={(event) => onStartActivityRegionResize(event, 'n')}
              title="拖动上边框缩放活动区域"
            />
            <div
              data-desktop-pet-interactive="true"
              data-desktop-pet-activity-region-handle="true"
              data-desktop-pet-native-scope="activity-region"
              className={`${ACTIVITY_REGION_EDGE_HANDLE_CLASS} bottom-0 left-0 right-0 h-4 cursor-ns-resize border-b border-[#2F80ED]/70 bg-gradient-to-t from-[#2F80ED]/10 to-transparent`}
              onPointerDown={(event) => onStartActivityRegionResize(event, 's')}
              title="拖动下边框缩放活动区域"
            />
            <div
              data-desktop-pet-interactive="true"
              data-desktop-pet-activity-region-handle="true"
              data-desktop-pet-native-scope="activity-region"
              className={`${ACTIVITY_REGION_EDGE_HANDLE_CLASS} bottom-0 left-0 top-0 w-4 cursor-ew-resize border-l border-[#2F80ED]/70 bg-gradient-to-r from-[#2F80ED]/10 to-transparent`}
              onPointerDown={(event) => onStartActivityRegionResize(event, 'w')}
              title="拖动左边框缩放活动区域"
            />
            <div
              data-desktop-pet-interactive="true"
              data-desktop-pet-activity-region-handle="true"
              data-desktop-pet-native-scope="activity-region"
              className={`${ACTIVITY_REGION_EDGE_HANDLE_CLASS} bottom-0 right-0 top-0 w-4 cursor-ew-resize border-r border-[#2F80ED]/70 bg-gradient-to-l from-[#2F80ED]/10 to-transparent`}
              onPointerDown={(event) => onStartActivityRegionResize(event, 'e')}
              title="拖动右边框缩放活动区域"
            />
            <div
              data-desktop-pet-interactive="true"
              data-desktop-pet-activity-region-handle="true"
              data-desktop-pet-native-scope="activity-region"
              className={`${ACTIVITY_REGION_CORNER_HANDLE_CLASS} left-0 top-0 h-5 w-5 cursor-nwse-resize border-l border-t border-[#2F80ED]/70 bg-gradient-to-br from-[#2F80ED]/10 to-transparent`}
              onPointerDown={(event) => onStartActivityRegionResize(event, 'nw')}
              title="拖动左上角缩放活动区域"
            />
            <div
              data-desktop-pet-interactive="true"
              data-desktop-pet-activity-region-handle="true"
              data-desktop-pet-native-scope="activity-region"
              className={`${ACTIVITY_REGION_CORNER_HANDLE_CLASS} right-0 top-0 h-5 w-5 cursor-nesw-resize border-r border-t border-[#2F80ED]/70 bg-gradient-to-bl from-[#2F80ED]/10 to-transparent`}
              onPointerDown={(event) => onStartActivityRegionResize(event, 'ne')}
              title="拖动右上角缩放活动区域"
            />
            <div
              data-desktop-pet-interactive="true"
              data-desktop-pet-activity-region-handle="true"
              data-desktop-pet-native-scope="activity-region"
              className={`${ACTIVITY_REGION_CORNER_HANDLE_CLASS} bottom-0 left-0 h-5 w-5 cursor-nesw-resize border-b border-l border-[#2F80ED]/70 bg-gradient-to-tr from-[#2F80ED]/10 to-transparent`}
              onPointerDown={(event) => onStartActivityRegionResize(event, 'sw')}
              title="拖动左下角缩放活动区域"
            />
            <div
              data-desktop-pet-interactive="true"
              data-desktop-pet-activity-region-handle="true"
              data-desktop-pet-native-scope="activity-region"
              className={`${ACTIVITY_REGION_CORNER_HANDLE_CLASS} bottom-0 right-0 h-5 w-5 cursor-nwse-resize border-b border-r border-[#2F80ED]/70 bg-gradient-to-tl from-[#2F80ED]/10 to-transparent`}
              onPointerDown={(event) => onStartActivityRegionResize(event, 'se')}
              title="拖动右下角缩放活动区域"
            />
          </div>

          <div className="pointer-events-none absolute left-2 top-2 w-60 max-w-[calc(100%-16px)]">
            <div
              className="pointer-events-none rounded bg-transparent p-3"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerMove={(event) => event.stopPropagation()}
              onWheel={(event) => event.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[#2F80ED]">
                  状态控制
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[8px] uppercase tracking-widest text-[#2F80ED]">
                    LIVE
                  </span>
                  <PetFoodCreationControls
                    onCreateFood={onCreateFood}
                  />
                  <Button
                    data-desktop-pet-interactive="true"
                    data-desktop-pet-window-shape="true"
                    data-desktop-pet-window-shape-padding="4"
                    data-desktop-pet-native-scope="activity-region"
                    type="button"
                    variant="outline"
                    className="pointer-events-auto h-6 rounded-sm border-[#2F80ED]/70 bg-transparent px-2 text-[9px] text-[#2F80ED] hover:bg-[#2F80ED]/10"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setIsStatusControlCollapsed((collapsed) => !collapsed)}
                    aria-label={isStatusControlCollapsed ? '展开状态控制' : '收纳状态控制'}
                  >
                    {isStatusControlCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                    <span className="ml-1">{isStatusControlCollapsed ? '展开' : '收纳'}</span>
                  </Button>
                </div>
              </div>

              {!isStatusControlCollapsed ? <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-[#2F80ED]">
                    <span>好感度</span>
                    <span className="font-mono text-[#2F80ED]">{Math.round(config.stats.affection)}%</span>
                  </div>
                  <Slider
                    data-desktop-pet-interactive="true"
                    data-desktop-pet-window-shape="true"
                    data-desktop-pet-window-shape-padding="3"
                    data-desktop-pet-native-scope="activity-region"
                    markers={STAT_SLIDER_MARKERS}
                    accentColor={ACTIVITY_CONTROL_COLOR}
                    className="pointer-events-auto"
                    value={[config.stats.affection]}
                    max={100}
                    step={1}
                    onValueChange={(value) => onUpdateStat('affection', value)}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-[#2F80ED]">
                    <span>饥饿值</span>
                    <span className="font-mono text-[#2F80ED]">{Math.round(config.stats.hunger)}%</span>
                  </div>
                  <Slider
                    data-desktop-pet-interactive="true"
                    data-desktop-pet-window-shape="true"
                    data-desktop-pet-window-shape-padding="3"
                    data-desktop-pet-native-scope="activity-region"
                    markers={STAT_SLIDER_MARKERS}
                    accentColor={ACTIVITY_CONTROL_COLOR}
                    className="pointer-events-auto"
                    value={[config.stats.hunger]}
                    max={100}
                    step={1}
                    onValueChange={(value) => onUpdateStat('hunger', value)}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-[#2F80ED]">
                    <span>疲劳值</span>
                    <span className="font-mono text-[#2F80ED]">{Math.round(config.stats.fatigue)}%</span>
                  </div>
                  <Slider
                    data-desktop-pet-interactive="true"
                    data-desktop-pet-window-shape="true"
                    data-desktop-pet-window-shape-padding="3"
                    data-desktop-pet-native-scope="activity-region"
                    markers={STAT_SLIDER_MARKERS}
                    accentColor={ACTIVITY_CONTROL_COLOR}
                    className="pointer-events-auto"
                    value={[config.stats.fatigue]}
                    max={100}
                    step={1}
                    onValueChange={(value) => onUpdateStat('fatigue', value)}
                  />
                </div>
              </div> : null}
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-0 z-[8] overflow-visible pointer-events-none">
        <div
          ref={folderSampleRef}
          className="pointer-events-none absolute left-[-9999px] top-[-9999px] flex select-none flex-col items-center gap-1 opacity-0"
          aria-hidden="true"
        >
          <div ref={folderSampleIconRef}>
            <FoodAppearanceVisual appearance={sampleAppearance} />
          </div>
          <span className="rounded bg-transparent px-1 font-mono text-[10px] uppercase tracking-tighter text-muted-foreground">
            食物 00
          </span>
        </div>

        {folders.map((folder) => {
          const appearance = resolveFoodAppearanceForFolder(folder, config.foodAppearances);

          return (
            <div
              key={folder.id}
              data-desktop-pet-interactive="true"
              data-desktop-pet-window-shape="true"
              data-desktop-pet-native-scope="folder"
              className={`pet-folder-appear absolute ${folderDragPreview?.folderId === folder.id ? 'z-20' : 'z-[8]'} flex cursor-grab touch-none select-none flex-col items-center gap-1 pointer-events-auto group active:cursor-grabbing`}
              style={{
                left: activityCenter.x + folder.renderPosition.x - folderRenderOffset.x,
                top: activityCenter.y + folder.renderPosition.y - folderRenderOffset.y,
              }}
              onPointerDown={(event) => onStartFolderDrag(event, folder)}
            >
              <FoodAppearanceVisual
                appearance={appearance}
                className="flex h-12 w-12 items-center justify-center rounded border border-primary/20 bg-primary/10 transition-colors group-hover:bg-primary/20"
              />
              <span className="rounded bg-transparent px-1 font-mono text-[10px] uppercase tracking-tighter text-muted-foreground">
                {folder.name}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
});

PetEnvironmentLayer.displayName = 'PetEnvironmentLayer';
