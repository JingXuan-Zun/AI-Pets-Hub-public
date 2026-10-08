import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Link2 } from 'lucide-react';
import { MEMORY_DRAG_TYPE } from './NeuralMemoryNoteList';
import type { MemoryNoteLink } from './neuralMemoryNotes';
import { memoryContentSegments } from './neuralMemoryNotes';

const AUTO_SAVE_DELAY_MS = 800;
// Shared by the colored mirror and the transparent textarea so text lines up exactly.
const TEXT_CLASS = 'col-start-1 row-start-1 m-0 min-h-48 w-full whitespace-pre-wrap break-words p-0 font-[inherit] text-base leading-8 tracking-normal';

function hasMemoryDrag(event: DragEvent) {
  return event.dataTransfer.types.includes(MEMORY_DRAG_TYPE);
}

/**
 * Always-editable memory text, like Obsidian's editor: click anywhere to type.
 * A mirror underneath colors linked text; Ctrl+click a link to open it.
 * Selecting text offers to link it; dropping a memory inserts a link there.
 */
export function NeuralMemoryNoteContent(props: {
  content: string;
  links: MemoryNoteLink[];
  nodeId: string;
  onDropLink: (targetNodeId: string, offset: number) => void;
  onEmpty: () => void;
  onLinkSelection: (text: string) => void;
  onOpenNode: (nodeId: string) => void;
  onSave: (content: string) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState(props.content);
  const [selection, setSelection] = useState('');
  const [dropping, setDropping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const latestRef = useRef({ draft, saved: props.content, onSave: props.onSave });
  latestRef.current.onSave = props.onSave;

  const flush = async () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const { draft: text, saved } = latestRef.current;
    if (!text.trim() || text.trim() === saved.trim()) return;
    latestRef.current.saved = text;
    await latestRef.current.onSave(text.trim());
  };

  useEffect(() => {
    setDraft(props.content);
    latestRef.current = { ...latestRef.current, draft: props.content, saved: props.content };
    setSelection('');
    return () => { void flush(); };
  }, [props.nodeId]);

  useEffect(() => {
    // Adopt saved content (e.g. after a drop inserted a link) unless the user is mid-edit.
    if (document.activeElement !== textareaRef.current || latestRef.current.draft === latestRef.current.saved) {
      setDraft(props.content);
      latestRef.current = { ...latestRef.current, draft: props.content, saved: props.content };
    }
  }, [props.content]);

  const updateDraft = (text: string) => {
    setDraft(text);
    latestRef.current.draft = text;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => { void flush(); }, AUTO_SAVE_DELAY_MS);
  };

  const segments = memoryContentSegments(draft, props.links);
  const linkAt = (offset: number) => {
    let cursor = 0;
    for (const segment of segments) {
      if (segment.link && offset >= cursor && offset <= cursor + segment.text.length) return segment.link;
      cursor += segment.text.length;
    }
    return undefined;
  };
  // The textarea covers the mirror, so hide it for a moment to hit-test the text underneath.
  const dropOffset = (event: DragEvent) => {
    const textarea = textareaRef.current;
    if (!textarea) return draft.length;
    textarea.style.pointerEvents = 'none';
    const caret = document.caretRangeFromPoint?.(event.clientX, event.clientY);
    textarea.style.pointerEvents = '';
    const segment = caret?.startContainer.parentElement?.closest<HTMLElement>('[data-segment-start]');
    if (!caret || !segment || !mirrorRef.current?.contains(segment)) return draft.length;
    return Number(segment.dataset.segmentStart) + caret.startOffset;
  };

  let cursor = 0;
  return (
    <div className="space-y-2">
      <div className={`relative grid rounded ${dropping ? 'bg-primary/5 outline-dashed outline-1 outline-primary/40' : ''}`}>
        <div ref={mirrorRef} aria-hidden className={`${TEXT_CLASS} pointer-events-none text-foreground`}>
          {segments.map((segment, index) => {
            const start = cursor;
            cursor += segment.text.length;
            return (
              <span key={index} data-segment-start={start} className={segment.link ? 'text-primary' : undefined}>
                {segment.text}
              </span>
            );
          })}
          {draft ? '\n' : <span className="text-muted-foreground">写下这条记忆……</span>}
        </div>
        <textarea
          ref={textareaRef}
          data-memory-note-content
          value={draft}
          spellCheck={false}
          onChange={(event) => updateDraft(event.target.value)}
          onBlur={() => {
            void flush();
            if (!latestRef.current.draft.trim()) props.onEmpty();
          }}
          onSelect={(event) => {
            const { selectionEnd, selectionStart } = event.currentTarget;
            setSelection(draft.slice(selectionStart, selectionEnd).trim().slice(0, 80));
          }}
          onClick={(event) => {
            if (!(event.ctrlKey || event.metaKey)) return;
            const link = linkAt(event.currentTarget.selectionStart);
            if (link) props.onOpenNode(link.other.nodeId);
          }}
          onDragOver={(event) => {
            if (!hasMemoryDrag(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'link';
            setDropping(true);
          }}
          onDragLeave={() => setDropping(false)}
          onDrop={(event) => {
            const targetId = event.dataTransfer.getData(MEMORY_DRAG_TYPE);
            if (!targetId) return;
            event.preventDefault();
            setDropping(false);
            const offset = dropOffset(event);
            void flush().then(() => props.onDropLink(targetId, offset));
          }}
          className={`${TEXT_CLASS} resize-none overflow-hidden bg-transparent text-transparent caret-foreground outline-none selection:bg-primary/25`}
        />
      </div>
      {selection ? (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => { props.onLinkSelection(selection); setSelection(''); }}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-primary hover:bg-primary/10"
        >
          <Link2 className="h-3 w-3" />把“{selection.length > 12 ? `${selection.slice(0, 11)}…` : selection}”关联到…
        </button>
      ) : null}
    </div>
  );
}
