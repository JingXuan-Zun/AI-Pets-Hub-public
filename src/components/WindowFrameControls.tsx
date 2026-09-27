import { useRef, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

interface WindowFrameControlsProps {
  buttonClassName?: string;
  className?: string;
  closeButtonClassName?: string;
  closeDangerHover?: boolean;
  closeTitle: string;
  minimizeButtonClassName?: string;
  minimizeTitle: string;
  style?: CSSProperties;
  onClose: () => void;
  onMinimize: () => void;
}

const CONTROL_BUTTON_CLASS = [
  'inline-flex h-10 w-12 items-center justify-center rounded-none',
  'text-slate-900 transition-colors hover:bg-slate-200/80',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
].join(' ');

const COMPACT_HANDLE_CLASS = [
  'flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-sky-100',
  'bg-white text-sky-900 opacity-100 shadow-[0_10px_28px_rgba(15,23,42,0.16)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
].join(' ');

export function WindowFrameControls({
  buttonClassName = '',
  className = '',
  closeButtonClassName = '',
  closeDangerHover = true,
  closeTitle,
  minimizeButtonClassName = '',
  minimizeTitle,
  style,
  onClose,
  onMinimize,
}: WindowFrameControlsProps) {
  const stopFrameDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };
  const minimizeClassName = `${CONTROL_BUTTON_CLASS} ${buttonClassName} ${minimizeButtonClassName}`.trim();
  const closeHoverClassName = closeDangerHover ? 'hover:bg-red-500 hover:text-white' : '';
  const closeClassName = `${CONTROL_BUTTON_CLASS} ${closeHoverClassName} ${buttonClassName} ${closeButtonClassName}`.trim();

  return (
    <div className={`flex shrink-0 items-center overflow-hidden ${className}`} style={style}>
      <button
        type="button"
        className={minimizeClassName}
        title={minimizeTitle}
        aria-label={minimizeTitle}
        onClick={onMinimize}
        onPointerDown={stopFrameDrag}
      >
        <ChevronDown className="h-4 w-4 stroke-[2.4]" />
      </button>
      <button
        type="button"
        className={closeClassName}
        title={closeTitle}
        aria-label={closeTitle}
        onClick={onClose}
        onPointerDown={stopFrameDrag}
      >
        <X className="h-4 w-4 stroke-[2.2]" />
      </button>
    </div>
  );
}

interface WindowCompactHandleProps {
  className?: string;
  onStartDrag?: (event: ReactPointerEvent<HTMLElement>) => void;
  style?: CSSProperties;
  title: string;
  onExpand: () => void;
}

export function WindowCompactHandle({
  className = '',
  onStartDrag,
  style,
  title,
  onExpand,
}: WindowCompactHandleProps) {
  const dragGestureRef = useRef<{ moved: boolean; pointerId: number } | null>(null);
  const stopFrameDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };
  const handlePointerDownCapture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    dragGestureRef.current = { moved: false, pointerId: event.pointerId };
    onStartDrag?.(event);
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = dragGestureRef.current;
    if (gesture?.pointerId === event.pointerId && Math.hypot(event.movementX, event.movementY) >= 1) {
      gesture.moved = true;
    }
  };
  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const gesture = dragGestureRef.current;
    dragGestureRef.current = null;
    if (gesture?.moved) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onExpand();
  };
  const compactHandleStyle = {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    opacity: 1,
    WebkitAppRegion: 'no-drag',
    ...style,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={`${COMPACT_HANDLE_CLASS} ${className}`}
      title={title}
      aria-label={title}
      data-desktop-pet-compact-handle="true"
      onClick={handleClick}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMove={handlePointerMove}
      onPointerDown={stopFrameDrag}
      style={compactHandleStyle}
    >
      <ChevronUp className="h-5 w-5 stroke-[2.5]" />
    </button>
  );
}
