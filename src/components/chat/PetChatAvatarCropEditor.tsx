import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, Crop, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Slider } from '../../../components/ui/slider';
import { CHAT_AVATAR_IMAGE_MAX_EDGE } from './chatAppearanceUtils';

export type ChatAvatarCropTarget = 'pet' | 'user';

export type ChatAvatarCropDraft = {
  fileName: string;
  imageUrl: string;
  naturalHeight: number;
  naturalWidth: number;
  target: ChatAvatarCropTarget;
};

type Point = {
  x: number;
  y: number;
};

type CropDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffset: Point;
};

const AVATAR_CROP_VIEW_SIZE = 240;
const AVATAR_CROP_ZOOM_MIN = 1;
const AVATAR_CROP_ZOOM_MAX = 4;

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getAvatarCropMetrics(draft: ChatAvatarCropDraft, zoom: number) {
  const naturalWidth = Math.max(1, draft.naturalWidth);
  const naturalHeight = Math.max(1, draft.naturalHeight);
  const coverScale = Math.max(AVATAR_CROP_VIEW_SIZE / naturalWidth, AVATAR_CROP_VIEW_SIZE / naturalHeight);
  const imageWidth = naturalWidth * coverScale * zoom;
  const imageHeight = naturalHeight * coverScale * zoom;

  return {
    imageHeight,
    imageWidth,
    maxOffsetX: Math.max(0, (imageWidth - AVATAR_CROP_VIEW_SIZE) / 2),
    maxOffsetY: Math.max(0, (imageHeight - AVATAR_CROP_VIEW_SIZE) / 2),
  };
}

function clampAvatarCropOffset(draft: ChatAvatarCropDraft, offset: Point, zoom: number) {
  const metrics = getAvatarCropMetrics(draft, zoom);

  return {
    x: clampValue(offset.x, -metrics.maxOffsetX, metrics.maxOffsetX),
    y: clampValue(offset.y, -metrics.maxOffsetY, metrics.maxOffsetY),
  };
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片读取失败。'));
    image.src = src;
  });
}

export async function createChatAvatarCropDraft(file: File, target: ChatAvatarCropTarget) {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件。');
  }

  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(imageUrl);

    return {
      fileName: file.name,
      imageUrl,
      naturalHeight: image.naturalHeight,
      naturalWidth: image.naturalWidth,
      target,
    };
  } catch (error) {
    URL.revokeObjectURL(imageUrl);
    throw error;
  }
}

async function renderAvatarCropToDataUrl(draft: ChatAvatarCropDraft, offset: Point, zoom: number) {
  const image = await loadImageElement(draft.imageUrl);
  const safeOffset = clampAvatarCropOffset(draft, offset, zoom);
  const metrics = getAvatarCropMetrics(draft, zoom);
  const outputSize = CHAT_AVATAR_IMAGE_MAX_EDGE;
  const outputScale = outputSize / AVATAR_CROP_VIEW_SIZE;
  const imageLeft = AVATAR_CROP_VIEW_SIZE / 2 + safeOffset.x - metrics.imageWidth / 2;
  const imageTop = AVATAR_CROP_VIEW_SIZE / 2 + safeOffset.y - metrics.imageHeight / 2;
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas context unavailable');
  }

  context.clearRect(0, 0, outputSize, outputSize);
  context.save();
  context.beginPath();
  context.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
  context.clip();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    imageLeft * outputScale,
    imageTop * outputScale,
    metrics.imageWidth * outputScale,
    metrics.imageHeight * outputScale,
  );
  context.restore();

  return canvas.toDataURL('image/png');
}

interface PetChatAvatarCropEditorProps {
  draft: ChatAvatarCropDraft;
  onCancel: () => void;
  onConfirm: (avatarUrl: string, target: ChatAvatarCropTarget) => void;
}

export function PetChatAvatarCropEditor({
  draft,
  onCancel,
  onConfirm,
}: PetChatAvatarCropEditorProps) {
  const dragStateRef = useRef<CropDragState | null>(null);
  const [cropOffset, setCropOffset] = useState<Point>({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const metrics = getAvatarCropMetrics(draft, cropZoom);
  const safeOffset = clampAvatarCropOffset(draft, cropOffset, cropZoom);
  const title = draft.target === 'pet' ? '裁剪桌宠头像' : '裁剪用户头像';

  useEffect(() => {
    setCropOffset({ x: 0, y: 0 });
    setCropZoom(1);
    setIsDragging(false);
    setIsSaving(false);
    setErrorMessage('');
  }, [draft.imageUrl]);

  const beginCropDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffset: safeOffset,
    };
    setIsDragging(true);
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const updateCropDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const nextOffset = {
      x: dragState.startOffset.x + event.clientX - dragState.startClientX,
      y: dragState.startOffset.y + event.clientY - dragState.startClientY,
    };

    setCropOffset(clampAvatarCropOffset(draft, nextOffset, cropZoom));
  };

  const finishCropDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    setIsDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const updateCropZoom = (value: number[]) => {
    const nextZoom = clampValue(value[0] ?? cropZoom, AVATAR_CROP_ZOOM_MIN, AVATAR_CROP_ZOOM_MAX);
    setCropZoom(nextZoom);
    setCropOffset((currentOffset) => clampAvatarCropOffset(draft, currentOffset, nextZoom));
  };

  const confirmCrop = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      const avatarUrl = await renderAvatarCropToDataUrl(draft, safeOffset, cropZoom);
      onConfirm(avatarUrl, draft.target);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '图片裁剪失败。');
      setIsSaving(false);
    }
  };

  return (
    <div
      className="space-y-3 rounded-sm border border-sky-100 bg-white p-3 text-sky-950 shadow-[0_14px_32px_rgba(12,74,110,0.12)]"
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Crop className="h-3.5 w-3.5 shrink-0 text-sky-700" />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-sky-950">{title}</div>
            <div className="truncate text-[10px] text-sky-700">{draft.fileName}</div>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCancel}
          disabled={isSaving}
          className="h-7 w-7 text-sky-700 hover:bg-sky-50 hover:text-sky-950"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div
        className={`relative mx-auto touch-none overflow-hidden rounded-full border border-sky-100 bg-sky-50 shadow-inner ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ height: AVATAR_CROP_VIEW_SIZE, width: AVATAR_CROP_VIEW_SIZE }}
        onPointerDown={beginCropDrag}
        onPointerMove={updateCropDrag}
        onPointerUp={finishCropDrag}
        onPointerCancel={finishCropDrag}
      >
        <img
          alt=""
          src={draft.imageUrl}
          draggable={false}
          className="absolute max-w-none select-none"
          style={{
            height: metrics.imageHeight,
            left: AVATAR_CROP_VIEW_SIZE / 2 + safeOffset.x,
            top: AVATAR_CROP_VIEW_SIZE / 2 + safeOffset.y,
            transform: 'translate(-50%, -50%)',
            width: metrics.imageWidth,
          }}
        />
        <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/95 ring-offset-2 ring-offset-white" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] text-sky-700">
          <Label className="text-[10px] font-bold uppercase tracking-widest text-sky-700">缩放</Label>
          <span>{Math.round(cropZoom * 100)}%</span>
        </div>
        <Slider
          value={[cropZoom]}
          min={AVATAR_CROP_ZOOM_MIN}
          max={AVATAR_CROP_ZOOM_MAX}
          step={0.01}
          onValueChange={updateCropZoom}
        />
      </div>

      {errorMessage && (
        <div className="rounded-sm border border-red-100 bg-red-50 px-3 py-2 text-[10px] text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-8 flex-1 rounded-full bg-sky-950 px-3 text-[10px] text-white hover:bg-sky-900"
          onClick={confirmCrop}
          disabled={isSaving}
        >
          <Check className="mr-1 h-3 w-3" />
          {isSaving ? '保存中' : '保存'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-8 flex-1 rounded-full border-sky-100 bg-white px-3 text-[10px] text-sky-800 hover:bg-sky-50"
          onClick={onCancel}
          disabled={isSaving}
        >
          取消
        </Button>
      </div>
    </div>
  );
}
