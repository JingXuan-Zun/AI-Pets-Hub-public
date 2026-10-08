import { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FileText, X } from 'lucide-react';
import {
  type DesktopIconArrangementItem,
  type DesktopIconArrangementRect,
} from '../../agent';
import { type DesktopOrganizationShowcaseRun } from './useDesktopOrganizationShowcase';

const ITEM_ANIMATION_DURATION_MS = 760;
const ITEM_ANIMATION_GAP_MS = 110;
const ITEM_STEP_MS = ITEM_ANIMATION_DURATION_MS + ITEM_ANIMATION_GAP_MS;
const MAX_RENDERED_SETTLED_ITEMS = 80;

type ViewportRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

interface DesktopOrganizationOverlayProps {
  onCancel: () => void;
  onComplete: () => void;
  run: DesktopOrganizationShowcaseRun | null;
  shellViewport: ViewportRect;
}

function clampIconVisualSize(value: number) {
  return Math.max(34, Math.min(74, Math.round(value)));
}

function formatIconName(name: string) {
  const trimmedName = name.trim();
  if (trimmedName.length <= 12) {
    return trimmedName;
  }

  return `${trimmedName.slice(0, 10)}...`;
}

function resolveIconStyle(rect: DesktopIconArrangementRect) {
  return {
    height: clampIconVisualSize(rect.height),
    left: rect.x,
    top: rect.y,
    width: clampIconVisualSize(rect.width),
  };
}

function DesktopIconGhost({
  item,
  rect,
  variant,
}: {
  item: DesktopIconArrangementItem;
  rect: DesktopIconArrangementRect;
  variant: 'active' | 'settled';
}) {
  const visualStyle = resolveIconStyle(rect);
  const isActive = variant === 'active';

  return (
    <div
      className="absolute flex select-none flex-col items-center"
      style={{
        left: visualStyle.left,
        top: visualStyle.top,
        width: visualStyle.width,
      }}
    >
      <div
        className={`flex items-center justify-center border bg-white/90 shadow-[0_14px_26px_rgba(158,84,140,0.14)] backdrop-blur-md ${
          isActive
            ? 'border-sky-300 text-sky-600'
            : 'border-slate-200 text-slate-500'
        }`}
        style={{
          borderRadius: 12,
          height: visualStyle.height,
          width: visualStyle.width,
        }}
      >
        <FileText
          aria-hidden="true"
          style={{
            height: Math.max(18, Math.round(visualStyle.height * 0.44)),
            width: Math.max(18, Math.round(visualStyle.width * 0.44)),
          }}
        />
      </div>
      <span className="mt-1 max-w-[84px] truncate rounded bg-white/80 px-1.5 py-0.5 text-center text-[9px] font-medium text-slate-600 shadow-sm">
        {formatIconName(item.iconName)}
      </span>
    </div>
  );
}

export const DesktopOrganizationOverlay = memo(function DesktopOrganizationOverlay({
  onCancel,
  onComplete,
  run,
  shellViewport,
}: DesktopOrganizationOverlayProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!run || run.status !== 'running') {
      return undefined;
    }

    setNow(Date.now());
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 80);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [run?.plan.id, run?.status]);

  const progress = useMemo(() => {
    if (!run) {
      return {
        activeIndex: -1,
        completedCount: 0,
      };
    }

    if (run.status === 'completed') {
      return {
        activeIndex: -1,
        completedCount: run.plan.items.length,
      };
    }

    const elapsedMs = Math.max(0, now - run.startedAt);
    const activeIndex = Math.min(run.plan.items.length, Math.floor(elapsedMs / ITEM_STEP_MS));

    return {
      activeIndex: activeIndex >= run.plan.items.length ? -1 : activeIndex,
      completedCount: Math.min(run.plan.items.length, activeIndex),
    };
  }, [now, run]);

  useEffect(() => {
    if (!run || run.status !== 'running') {
      return;
    }

    if (progress.completedCount >= run.plan.items.length) {
      onComplete();
    }
  }, [
    onComplete,
    progress.completedCount,
    run,
  ]);

  if (!run) {
    return null;
  }

  const settledItems = run.plan.items
    .slice(Math.max(0, progress.completedCount - MAX_RENDERED_SETTLED_ITEMS), progress.completedCount);
  const activeItem = progress.activeIndex >= 0 ? run.plan.items[progress.activeIndex] : null;
  const totalItems = run.plan.items.length;
  const statusText = run.status === 'completed'
    ? '完成'
    : `${Math.min(progress.completedCount + 1, totalItems)} / ${totalItems}`;

  return (
    <div className="pointer-events-none absolute inset-0 z-[18] overflow-visible">
      <div
        data-desktop-pet-interactive="true"
        data-desktop-pet-window-shape="true"
        data-desktop-pet-native-scope="pet"
        className="pointer-events-auto absolute flex items-center gap-2 rounded-full border border-sky-100/80 bg-white/88 px-3 py-2 shadow-[0_14px_32px_rgba(158,84,140,0.12)] backdrop-blur-md"
        style={{
          left: Math.round(shellViewport.x + 24),
          top: Math.round(shellViewport.y + 24),
        }}
      >
        <span className="text-[10px] font-semibold tracking-[0.1em] text-slate-600">整理 {statusText}</span>
        <button
          type="button"
          aria-label="取消桌面整理演出"
          title="取消"
          className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 transition-colors hover:border-sky-200 hover:text-sky-600"
          onClick={onCancel}
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="absolute inset-0">
        {settledItems.map((item) => (
          <motion.div
            key={`${run.plan.id}-${item.iconId}-settled`}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: run.status === 'completed' ? 0.72 : 0.52, scale: 1 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute"
            style={{
              left: 0,
              top: 0,
            }}
          >
            <DesktopIconGhost item={item} rect={item.to} variant="settled" />
          </motion.div>
        ))}

        <AnimatePresence mode="popLayout">
          {activeItem && (
            <motion.div
              key={`${run.plan.id}-${activeItem.iconId}-active`}
              initial={{
                left: activeItem.from.x,
                opacity: 0.2,
                scale: 0.9,
                top: activeItem.from.y,
              }}
              animate={{
                left: activeItem.to.x,
                opacity: 1,
                scale: 1,
                top: activeItem.to.y,
              }}
              exit={{
                opacity: 0.52,
                scale: 0.98,
              }}
              transition={{
                duration: ITEM_ANIMATION_DURATION_MS / 1000,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="absolute drop-shadow-[0_16px_24px_rgba(14,116,144,0.18)]"
            >
              <DesktopIconGhost
                item={activeItem}
                rect={{
                  ...activeItem.to,
                  x: 0,
                  y: 0,
                }}
                variant="active"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

DesktopOrganizationOverlay.displayName = 'DesktopOrganizationOverlay';
