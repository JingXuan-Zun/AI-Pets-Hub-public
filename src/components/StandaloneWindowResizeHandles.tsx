import { type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { type StandaloneWindowResizeDirection } from '../standaloneWindowResize';

interface StandaloneWindowResizeHandlesProps {
  onStartResize: (event: ReactPointerEvent<HTMLElement>, direction: StandaloneWindowResizeDirection) => void;
}

const noDragRegionStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties;

export function StandaloneWindowResizeHandles({
  onStartResize,
}: StandaloneWindowResizeHandlesProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[120] select-none"
      style={noDragRegionStyle}
    >
      <div
        className="pointer-events-auto absolute left-[12px] right-[12px] top-0 h-[12px] touch-none cursor-ns-resize"
        style={noDragRegionStyle}
        onPointerDown={(event) => onStartResize(event, 'n')}
      />
      <div
        className="pointer-events-auto absolute bottom-0 left-[12px] right-[12px] h-[8px] touch-none cursor-ns-resize"
        style={noDragRegionStyle}
        onPointerDown={(event) => onStartResize(event, 's')}
      />
      <div
        className="pointer-events-auto absolute bottom-[12px] left-0 top-[12px] w-[8px] touch-none cursor-ew-resize"
        style={noDragRegionStyle}
        onPointerDown={(event) => onStartResize(event, 'w')}
      />
      <div
        className="pointer-events-auto absolute bottom-[12px] right-0 top-[12px] w-[8px] touch-none cursor-ew-resize"
        style={noDragRegionStyle}
        onPointerDown={(event) => onStartResize(event, 'e')}
      />
      <div
        className="pointer-events-auto absolute left-0 top-0 h-[12px] w-[12px] touch-none cursor-nwse-resize"
        style={noDragRegionStyle}
        onPointerDown={(event) => onStartResize(event, 'nw')}
      />
      <div
        className="pointer-events-auto absolute right-0 top-0 h-[12px] w-[12px] touch-none cursor-nesw-resize"
        style={noDragRegionStyle}
        onPointerDown={(event) => onStartResize(event, 'ne')}
      />
      <div
        className="pointer-events-auto absolute bottom-0 left-0 h-[12px] w-[12px] touch-none cursor-nesw-resize"
        style={noDragRegionStyle}
        onPointerDown={(event) => onStartResize(event, 'sw')}
      />
      <div
        className="pointer-events-auto absolute bottom-0 right-0 h-[12px] w-[12px] touch-none cursor-nwse-resize"
        style={noDragRegionStyle}
        onPointerDown={(event) => onStartResize(event, 'se')}
      />
    </div>
  );
}
