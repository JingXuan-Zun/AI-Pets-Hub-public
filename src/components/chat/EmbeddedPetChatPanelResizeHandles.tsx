import { type EmbeddedPetChatPanelResizeHandler } from './embeddedPetChatPanelTypes';

interface EmbeddedPetChatPanelResizeHandlesProps {
  onStartResize: EmbeddedPetChatPanelResizeHandler;
}

const EDGE_HANDLE_CLASS = 'pointer-events-auto absolute z-[70] touch-none bg-transparent';
const CORNER_HANDLE_CLASS = 'pointer-events-auto absolute z-[80] touch-none bg-transparent';

export function EmbeddedPetChatPanelResizeHandles({
  onStartResize,
}: EmbeddedPetChatPanelResizeHandlesProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      <div
        className={`${EDGE_HANDLE_CLASS} left-0 right-0 top-0 h-5 cursor-ns-resize border-t border-primary/45 bg-gradient-to-b from-primary/10 to-transparent`}
        onPointerDown={(event) => onStartResize(event, 'n')}
        title="向上调整面板高度"
      />
      <div
        className={`${EDGE_HANDLE_CLASS} bottom-0 left-0 right-0 h-5 cursor-ns-resize border-b border-primary/45 bg-gradient-to-t from-primary/10 to-transparent`}
        onPointerDown={(event) => onStartResize(event, 's')}
        title="向下调整面板高度"
      />
      <div
        className={`${EDGE_HANDLE_CLASS} bottom-0 left-0 top-0 w-5 cursor-ew-resize border-l border-primary/45 bg-gradient-to-r from-primary/10 to-transparent`}
        onPointerDown={(event) => onStartResize(event, 'w')}
        title="向左调整面板宽度"
      />
      <div
        className={`${EDGE_HANDLE_CLASS} bottom-0 right-0 top-0 w-5 cursor-ew-resize border-r border-primary/45 bg-gradient-to-l from-primary/10 to-transparent`}
        onPointerDown={(event) => onStartResize(event, 'e')}
        title="向右调整面板宽度"
      />
      <div
        className={`${CORNER_HANDLE_CLASS} left-0 top-0 h-7 w-7 cursor-nwse-resize border-l border-t border-primary/45 bg-gradient-to-br from-primary/10 to-transparent`}
        onPointerDown={(event) => onStartResize(event, 'nw')}
        title="向左上调整面板大小"
      />
      <div
        className={`${CORNER_HANDLE_CLASS} right-0 top-0 h-7 w-7 cursor-nesw-resize border-r border-t border-primary/45 bg-gradient-to-bl from-primary/10 to-transparent`}
        onPointerDown={(event) => onStartResize(event, 'ne')}
        title="向右上调整面板大小"
      />
      <div
        className={`${CORNER_HANDLE_CLASS} bottom-0 left-0 h-7 w-7 cursor-nesw-resize border-b border-l border-primary/45 bg-gradient-to-tr from-primary/10 to-transparent`}
        onPointerDown={(event) => onStartResize(event, 'sw')}
        title="向左下调整面板大小"
      />
      <div
        className={`${CORNER_HANDLE_CLASS} bottom-0 right-0 h-7 w-7 cursor-nwse-resize border-b border-r border-primary/45 bg-gradient-to-tl from-primary/10 to-transparent`}
        onPointerDown={(event) => onStartResize(event, 'se')}
        title="向右下调整面板大小"
      />
    </div>
  );
}
