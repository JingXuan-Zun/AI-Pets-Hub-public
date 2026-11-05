import { Fragment, useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { expressionLibraryBridge } from '../../../expression/expressionLibraryBridge';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { type ChatMessageContentSegment, type ChatMessageExpressionContentSegment, type ChatMessageImageAttachment } from '../../../types';
import { splitMessageTextByBrackets } from './messageTextUtils';
import { splitMessageDiagrams } from './messageDiagrams';

export function AvatarBadge({
  avatarUrl,
  fallbackText,
  size,
}: {
  avatarUrl: string;
  fallbackText: string;
  size: number;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-white font-semibold text-primary shadow-[0_8px_18px_rgba(148,163,184,0.12)]"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.28)),
      }}
    >
      {avatarUrl ? (
        <img alt="" src={avatarUrl} className="size-full object-cover" draggable={false} />
      ) : (
        <span>{Array.from(fallbackText.trim() || '?')[0]}</span>
      )}
    </div>
  );
}

type ImageMenuState = { attachment: ChatMessageImageAttachment; x: number; y: number };

/** Right-click on a chat picture: save or copy it (not the chat background menu). */
function ImageMenu({ menu, onClose }: { menu: ImageMenuState; onClose: () => void }) {
  const [note, setNote] = useState('');
  const bridge = window.desktopPetShell?.chatImage;
  const act = async (kind: 'copy' | 'save') => {
    if (!bridge) {
      setNote('只能在桌面版里保存');
      return;
    }
    const result = kind === 'save'
      ? await bridge.save(menu.attachment.dataUrl!, menu.attachment.name)
      : await bridge.copy(menu.attachment.dataUrl!);
    if (result.ok) {
      onClose();
      return;
    }
    if ('canceled' in result && result.canceled) return;
    setNote(result.error ?? '没成功');
  };
  const left = Math.min(menu.x, window.innerWidth - 150);
  const top = Math.min(menu.y, window.innerHeight - 96);
  return createPortal(
    <div
      className="fixed inset-0 z-[10000]"
      data-desktop-pet-interactive="true"
      onPointerDown={onClose}
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    >
      <div
        role="menu"
        className="absolute min-w-36 rounded-lg border border-border bg-white/95 p-1 text-xs text-foreground shadow-xl backdrop-blur-md"
        style={{ left, top }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" role="menuitem" onClick={() => void act('save')} className="block w-full rounded-md px-3 py-1.5 text-left hover:bg-primary/10">保存图片…</button>
        <button type="button" role="menuitem" onClick={() => void act('copy')} className="block w-full rounded-md px-3 py-1.5 text-left hover:bg-primary/10">复制图片</button>
        {note ? <div className="px-3 py-1 text-2xs text-destructive">{note}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/** A picture filling the window; a click anywhere or Esc closes it, right-click saves it. */
function ImageLightbox({ attachment, onClose, onImageMenu }: {
  attachment: ChatMessageImageAttachment;
  onClose: () => void;
  onImageMenu: (event: ReactMouseEvent) => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div
      role="dialog"
      aria-label={attachment.name}
      data-desktop-pet-interactive="true"
      className="fixed inset-0 z-[9999] flex cursor-zoom-out items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      // Outside the picture: nothing (the chat background menu is not for this view).
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
    >
      <img
        alt={attachment.name}
        src={attachment.dataUrl}
        className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        draggable={false}
        title="右键保存或复制"
        onContextMenu={onImageMenu}
      />
    </div>,
    document.body,
  );
}

export function PetChatMessageImageAttachments({
  attachments,
}: {
  attachments?: ChatMessageImageAttachment[] | null;
}) {
  const imageAttachments = (attachments ?? [])
    .filter((attachment) => attachment.kind === 'image' && attachment.dataUrl);
  const [opened, setOpened] = useState<ChatMessageImageAttachment | null>(null);
  const [menu, setMenu] = useState<ImageMenuState | null>(null);
  if (imageAttachments.length === 0) {
    return null;
  }
  // Stops here, so neither the chat background menu nor the bubble's memory menu opens.
  const openMenu = (attachment: ChatMessageImageAttachment) => (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ attachment, x: event.clientX, y: event.clientY });
  };

  return (
    <>
    {opened ? <ImageLightbox attachment={opened} onClose={() => setOpened(null)} onImageMenu={openMenu(opened)} /> : null}
    {menu ? <ImageMenu menu={menu} onClose={() => setMenu(null)} /> : null}
    <div className={`grid max-w-[260px] gap-2 ${imageAttachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
      {imageAttachments.map((attachment) => (
        <button
          type="button"
          key={attachment.id}
          className="cursor-zoom-in overflow-hidden rounded-xl border border-border bg-muted/40"
          title={`${attachment.name}（点开放大，右键保存）`}
          onClick={() => setOpened(attachment)}
          onContextMenu={openMenu(attachment)}
        >
          <img
            alt={attachment.name}
            src={attachment.dataUrl}
            className={imageAttachments.length === 1
              ? 'max-h-64 w-full object-contain'
              : 'h-28 w-28 object-cover'}
            draggable={false}
          />
        </button>
      ))}
    </div>
    </>
  );
}

function ExpressionContentSegment({ segment }: { segment: ChatMessageExpressionContentSegment }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (segment.expressionKind !== 'image' || !segment.assetId) return () => { active = false; };
    void expressionLibraryBridge.getPreview(segment.assetId).then((result) => {
      if (active && result.ok && result.dataUrl) setDataUrl(result.dataUrl);
      if (active && !result.ok) {
        pushFrontendRuntimeLog('expression-reply', 'image expression preview unavailable', {
          assetId: segment.assetId,
          error: result.error,
          rootId: segment.rootSnapshot?.id,
        });
      }
    });
    return () => { active = false; };
  }, [segment.assetId, segment.expressionKind]);

  if (segment.expressionKind !== 'image') {
    return <span className="mx-0.5 inline-block text-base leading-none" title={segment.expressionKind === 'emoji' ? '系统 Emoji' : '颜文字'}>{segment.value}</span>;
  }
  if (!dataUrl) return null;
  return (
    <img
      alt={segment.categorySnapshot?.name || '图片表情'}
      className="my-2 max-h-40 max-w-[220px] rounded-xl border border-border bg-muted/30 object-contain"
      draggable={false}
      src={dataUrl}
      title={`${segment.categorySnapshot?.name ?? '图片表情'}${segment.categorySnapshot?.description ? `：${segment.categorySnapshot.description}` : ''}`}
    />
  );
}

export function OrderedMessageContent({
  color,
  content,
  messageKey,
}: {
  color: string;
  content: ChatMessageContentSegment[];
  messageKey: string;
}) {
  return content.map((segment, index) => segment.kind === 'expression'
    ? <ExpressionContentSegment key={`${messageKey}-expression-${segment.expressionId}-${index}`} segment={segment} />
    : (
      <Fragment key={`${messageKey}-content-text-${index}`}>
        {splitMessageTextByBrackets(splitMessageDiagrams(segment.text).text).map((part, partIndex) => (
          <span key={`${messageKey}-content-text-${index}-${partIndex}`} style={{ ...(!part.isBracketContent ? { color } : {}), ...(part.bold ? { fontWeight: 700 } : {}) }}>{part.text}</span>
        ))}
      </Fragment>
    ));
}
