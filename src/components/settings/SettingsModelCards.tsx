import { Suspense, type MouseEvent as ReactMouseEvent } from 'react';
import { Box, Trash2 } from 'lucide-react';
import { resolve3DModelFormatFromUrl } from '../../model3dFormatSupport';
import PetVisualRenderer from '../pet/PetVisualRenderer';
import { type FoodAppearance, type PetModelPreset } from '../../types';
import { FoodAppearanceVisual } from '../food/FoodAppearanceVisual';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { resolveStoredAssetDisplayPath } from './settingsStoredAssetPath';

export function FoodAppearanceCard({
  appearance,
  allowCustomVideoActions,
  onRemove,
  onUpdateInteractionLabel,
  onUpdateInteractionType,
}: {
  appearance: FoodAppearance;
  allowCustomVideoActions: boolean;
  onRemove: (appearanceId: string) => void;
  onUpdateInteractionLabel: (appearanceId: string, label: string) => void;
  onUpdateInteractionType: (appearanceId: string, interactionType: 'eat' | 'toy' | 'custom') => void;
}) {
  return (
    <div className="rounded-sm border border-border/80 bg-secondary/20 p-2">
      <div className="mb-2 flex items-start justify-between gap-2">
        <FoodAppearanceVisual
          appearance={appearance}
          className="flex h-16 w-16 items-center justify-center rounded border border-primary/20 bg-primary/10"
          imageClassName="h-14 w-14 object-contain"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:bg-white/10 hover:text-destructive"
          onClick={() => onRemove(appearance.id)}
          title={`删除 ${appearance.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-1">
        <div className="truncate text-2xs font-medium text-foreground">{appearance.name}</div>
        <div className="font-mono text-3xs uppercase tracking-widest text-muted-foreground">
          {appearance.builtIn ? '预设道具' : '自定义道具'}
        </div>
        <select
          aria-label={`${appearance.name}交互类型`}
          value={appearance.interactionType ?? 'eat'}
          onChange={(event) => onUpdateInteractionType(appearance.id, event.target.value as 'eat' | 'toy' | 'custom')}
          className="mt-2 h-7 w-full rounded-sm border border-border bg-background px-2 text-2xs text-foreground outline-none focus:border-primary"
        >
          <option value="eat">交给角色：吃掉</option>
          <option value="toy">交给角色：玩具</option>
          {allowCustomVideoActions || appearance.interactionType === 'custom'
            ? <option value="custom">交给角色：自定义动作</option> : null}
        </select>
        {appearance.interactionType === 'custom' && allowCustomVideoActions ? (
          <input
            type="text"
            aria-label={`${appearance.name}动作名称`}
            maxLength={30}
            value={appearance.interactionLabel ?? ''}
            placeholder="例如：抚摸"
            onChange={(event) => onUpdateInteractionLabel(appearance.id, event.target.value)}
            className="mt-1 h-7 w-full rounded-sm border border-border bg-background px-2 text-2xs text-foreground"
          />
        ) : null}
      </div>
    </div>
  );
}

function ModelPresetPreview({
  formatLabel,
  isActive,
  preset,
}: {
  formatLabel: string;
  isActive: boolean;
  preset: PetModelPreset;
}) {
  if (preset.type === '2d') {
    if (preset.renderKind === 'gif') {
      return <img src={preset.url} alt={preset.name} className="pointer-events-none h-full w-full object-contain opacity-85" />;
    }
    if (preset.renderKind === 'video') {
      return (
        <video
          src={preset.url}
          muted
          autoPlay
          loop
          playsInline
          className="pointer-events-none h-full w-full object-contain opacity-85"
        />
      );
    }

    return (
      <img
        src={preset.url}
        alt={preset.name}
        className="pointer-events-none h-full w-full object-contain opacity-85"
        referrerPolicy="no-referrer"
      />
    );
  }

  if (preset.type === 'live2d' || preset.type === '3d') {
    if (isActive) {
      return (
        <Suspense fallback={<div className="h-full w-full animate-pulse bg-secondary/50" aria-label="正在加载模型预览" />}>
          <PetVisualRenderer
            action="IDLE"
            avatar3dRuntimeBackend="three"
            debugPetId={"settings-preview:" + preset.id}
            fitToPreview
            isMoving={false}
            modelType={preset.type}
            modelUrl={preset.url}
            renderKind={preset.renderKind}
            scale={1}
            staticPreview
            updatePriority="companion"
            visible
          />
        </Suspense>
      );
    }

    if (preset.type === 'live2d') {
      return (
        <div className="pointer-events-none relative flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(0,209,255,0.18),transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.32))] px-3 text-center">
          <div>
            <div className="font-mono text-2xs uppercase tracking-[0.22em] text-primary/90">
              LIVE2D
            </div>
            <div className="mt-2 line-clamp-2 text-2xs leading-relaxed text-muted-foreground">
              应用后使用 Live2D runtime 渲染
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-sm border border-white/20 bg-black/40 px-2 py-1 text-center text-3xs font-mono uppercase tracking-[0.2em] text-white/90 backdrop-blur-sm">
            {formatLabel} 模型
          </div>
        </div>
      );
    }

    return (
      <div className="pointer-events-none relative flex h-full w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.16),transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(15,23,42,0.42))] text-white/85">
        <Box className="h-8 w-8 stroke-[1.25]" />
        <div className="font-mono text-2xs uppercase tracking-[0.22em]">
          {formatLabel}
        </div>
        <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-sm border border-white/20 bg-black/40 px-2 py-1 text-center text-3xs font-mono uppercase tracking-[0.2em] text-white/90 backdrop-blur-sm">
          3D MODEL
        </div>
      </div>
    );
  }

  return null;
}

export function ModelPresetCard({
  isActive,
  preset,
  onClick,
  onRemove,
}: {
  isActive: boolean;
  preset: PetModelPreset;
  onClick: () => void;
  onRemove: (modelId: string) => void;
}) {
  const handleRemove = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onRemove(preset.id);
  };

  const formatLabel = preset.type === '3d'
    ? (resolve3DModelFormatFromUrl(preset.url)?.toUpperCase() ?? '3D')
    : preset.type === 'live2d'
        ? 'LIVE2D'
        : preset.renderKind === 'gif' ? 'GIF' : preset.renderKind === 'video' ? 'VIDEO' : '2D';

  const storedVideoPath = preset.type === '2d' && preset.renderKind === 'video' && !preset.builtIn
    ? resolveStoredAssetDisplayPath(preset.url)
    : '';
  return (
    <Card
      className={`cursor-pointer overflow-hidden rounded-sm border-border bg-secondary/30 transition-all duration-300 ${
        isActive
          ? 'border-primary shadow-sm ring-1 ring-primary'
          : 'hover:border-primary'
      }`}
      onClick={onClick}
    >
      <CardContent className="flex flex-col p-0">
        <div className="relative aspect-square overflow-hidden border-b border-border bg-black/40">
          <ModelPresetPreview preset={preset} formatLabel={formatLabel} isActive={isActive} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-7 w-7 border border-white/20 bg-black/45 text-white/80 hover:bg-black/60 hover:text-white"
            onClick={handleRemove}
            title={`删除 ${preset.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2 p-2">
          <span className="truncate text-2xs font-bold uppercase tracking-tight">{preset.name}</span>
          <span className="font-mono text-3xs text-muted-foreground">{preset.type.toUpperCase()}</span>
        </div>
        {storedVideoPath ? (
          <div
            className="border-t border-border/70 px-2 py-2"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-3xs font-medium uppercase tracking-wider text-muted-foreground">已保存地址</div>
            <code className="mt-1 block break-all select-text font-mono text-3xs leading-relaxed text-foreground">
              {storedVideoPath}
            </code>
          </div>
        ) : null}
        <div className="border-t border-border/70 p-2 pt-0">
          <Button
            type="button"
            variant={isActive ? 'secondary' : 'outline'}
            className={`h-8 w-full rounded-sm text-2xs uppercase tracking-widest ${
              isActive
                ? 'border-primary/30 bg-primary/12 text-primary hover:bg-primary/18'
                : 'border-border text-primary hover:bg-primary/10'
            }`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onClick();
            }}
          >
            {isActive ? '当前使用' : '应用模型'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="mt-2 h-8 w-full rounded-sm border-border text-2xs uppercase tracking-widest text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleRemove}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            删除模型
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
