import { Fragment, useEffect, useState } from 'react';
import { expressionLibraryBridge } from '../../../expression/expressionLibraryBridge';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { type ChatMessageContentSegment, type ChatMessageExpressionContentSegment, type ChatMessageImageAttachment } from '../../../types';
import { splitMessageTextByBrackets } from './messageTextUtils';

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

export function PetChatMessageImageAttachments({
  attachments,
}: {
  attachments?: ChatMessageImageAttachment[] | null;
}) {
  const imageAttachments = (attachments ?? [])
    .filter((attachment) => attachment.kind === 'image' && attachment.dataUrl);
  if (imageAttachments.length === 0) {
    return null;
  }

  return (
    <div className={`grid max-w-[260px] gap-2 ${imageAttachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
      {imageAttachments.map((attachment) => (
        <div
          key={attachment.id}
          className="overflow-hidden rounded-xl border border-border bg-muted/40"
          title={attachment.name}
        >
          <img
            alt={attachment.name}
            src={attachment.dataUrl}
            className={imageAttachments.length === 1
              ? 'max-h-64 w-full object-contain'
              : 'h-28 w-28 object-cover'}
            draggable={false}
          />
        </div>
      ))}
    </div>
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
        {splitMessageTextByBrackets(segment.text).map((part, partIndex) => (
          <span key={`${messageKey}-content-text-${index}-${partIndex}`} style={!part.isBracketContent ? { color } : undefined}>{part.text}</span>
        ))}
      </Fragment>
    ));
}
