import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Move, Save, Trash2, UserRound, X } from 'lucide-react';
import { type PetConfig, type PetConfigUpdateHandler } from '../../types';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Slider } from '../../../components/ui/slider';
import { getDesktopPetSlot } from '../../multiPetRoster';
import {
  createChatAvatarCropDraft,
  PetChatAvatarCropEditor,
  type ChatAvatarCropDraft,
  type ChatAvatarCropTarget,
} from './PetChatAvatarCropEditor';
import {
  CHAT_AVATAR_DISPLAY_SIZE_MAX,
  CHAT_AVATAR_DISPLAY_SIZE_MIN,
  CHAT_BACKGROUND_IMAGE_SIZE_MAX,
  CHAT_BACKGROUND_IMAGE_SIZE_MIN,
  CHAT_BACKGROUND_IMAGE_VISIBILITY_MAX,
  CHAT_BACKGROUND_IMAGE_VISIBILITY_MIN,
} from '../../chatAppearanceSettings';
import {
  CHAT_BACKGROUND_IMAGE_MAX_EDGE,
  fileToChatImageDataUrl,
  resolveChatAvatarDisplaySize,
  resolveChatPetAvatarUrl,
  resolveChatUserAvatarUrl,
  resolveChatUserDisplayId,
  resolveChatUserDisplayName,
  updateChatAvatarDisplaySize,
  updateChatBackgroundImageUrl,
  updateChatBackgroundImageSize,
  updateChatBackgroundImageVisibility,
  updateChatPetAvatarUrl,
  updateChatUserIdentity,
} from './chatAppearanceUtils';

interface PetChatAppearanceMenuProps {
  activePetId: string;
  config: PetConfig;
  menuPosition: { x: number; y: number };
  onClose: () => void;
  onUpdateConfig?: PetConfigUpdateHandler;
}

const MENU_WIDTH = 344;
const MENU_HEIGHT_ESTIMATE = 568;

type MenuDragState = {
  offsetX: number;
  offsetY: number;
  pointerId: number;
  width: number;
  height: number;
};

type NoDragStyle = CSSProperties & {
  WebkitAppRegion?: 'no-drag';
};

function clampMenuPosition(x: number, y: number, width = MENU_WIDTH, height = MENU_HEIGHT_ESTIMATE) {
  const effectiveWidth = Math.min(width, Math.max(1, window.innerWidth - 16));
  const effectiveHeight = Math.min(height, Math.max(1, window.innerHeight - 16));

  return {
    x: Math.max(8, Math.min(x, window.innerWidth - effectiveWidth - 8)),
    y: Math.max(8, Math.min(y, window.innerHeight - effectiveHeight - 8)),
  };
}

async function readSingleImageFile(file: File, maxEdge: number) {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件。');
  }

  return fileToChatImageDataUrl(file, maxEdge);
}

function AvatarPreview({
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
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-white font-semibold text-primary shadow-[0_8px_18px_rgba(148,163,184,0.14)]"
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

export function PetChatAppearanceMenu({
  activePetId,
  config,
  menuPosition,
  onClose,
  onUpdateConfig,
}: PetChatAppearanceMenuProps) {
  const activePetSlot = getDesktopPetSlot(config, activePetId);
  const activePetName = activePetSlot?.personality.name?.trim() || '桌宠';
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuDragStateRef = useRef<MenuDragState | null>(null);
  const userAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const petAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);
  const [userDisplayNameDraft, setUserDisplayNameDraft] = useState(resolveChatUserDisplayName(config));
  const [userDisplayIdDraft, setUserDisplayIdDraft] = useState(resolveChatUserDisplayId(config));
  const [menuCoordinates, setMenuCoordinates] = useState(() => clampMenuPosition(menuPosition.x, menuPosition.y));
  const [isMenuDragging, setIsMenuDragging] = useState(false);
  const [avatarCropDraft, setAvatarCropDraft] = useState<ChatAvatarCropDraft | null>(null);
  const [feedback, setFeedback] = useState('');

  const avatarDisplaySize = resolveChatAvatarDisplaySize(config);
  const backgroundImageSize = config.settings.chatBackgroundImageSize;
  const backgroundImageVisibility = config.settings.chatBackgroundImageVisibility;
  const currentUserAvatarUrl = resolveChatUserAvatarUrl(config);
  const currentPetAvatarUrl = resolveChatPetAvatarUrl(config, activePetId);
  const [avatarDisplaySizeDraft, setAvatarDisplaySizeDraft] = useState(avatarDisplaySize);
  const [backgroundImageSizeDraft, setBackgroundImageSizeDraft] = useState(backgroundImageSize);
  const [backgroundImageVisibilityDraft, setBackgroundImageVisibilityDraft] = useState(backgroundImageVisibility);

  useEffect(() => {
    setUserDisplayNameDraft(resolveChatUserDisplayName(config));
    setUserDisplayIdDraft(resolveChatUserDisplayId(config));
  }, [config.settings.chatUserDisplayId, config.settings.chatUserDisplayName]);

  useEffect(() => {
    setAvatarDisplaySizeDraft(avatarDisplaySize);
  }, [avatarDisplaySize]);

  useEffect(() => {
    setBackgroundImageSizeDraft(backgroundImageSize);
  }, [backgroundImageSize]);

  useEffect(() => {
    setBackgroundImageVisibilityDraft(backgroundImageVisibility);
  }, [backgroundImageVisibility]);

  useEffect(() => {
    const clampedPosition = clampMenuPosition(
      menuPosition.x,
      menuPosition.y,
      menuRef.current?.offsetWidth ?? MENU_WIDTH,
      menuRef.current?.offsetHeight ?? MENU_HEIGHT_ESTIMATE,
    );

    setMenuCoordinates(clampedPosition);
  }, [menuPosition.x, menuPosition.y]);

  useEffect(() => {
    const reclampMenuPosition = () => {
      setMenuCoordinates((currentPosition) => clampMenuPosition(
        currentPosition.x,
        currentPosition.y,
        menuRef.current?.offsetWidth ?? MENU_WIDTH,
        menuRef.current?.offsetHeight ?? MENU_HEIGHT_ESTIMATE,
      ));
    };

    window.addEventListener('resize', reclampMenuPosition);
    return () => window.removeEventListener('resize', reclampMenuPosition);
  }, []);

  useEffect(() => {
    const menuElement = menuRef.current;
    if (!menuElement || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => {
      setMenuCoordinates((currentPosition) => clampMenuPosition(
        currentPosition.x,
        currentPosition.y,
        menuElement.offsetWidth,
        menuElement.offsetHeight,
      ));
    });

    resizeObserver.observe(menuElement);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setFeedback(''), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  useEffect(() => {
    const imageUrl = avatarCropDraft?.imageUrl;

    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [avatarCropDraft?.imageUrl]);

  const beginMenuDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const targetElement = event.target as HTMLElement | null;
    if (targetElement?.closest('button, input, textarea, select, label')) {
      return;
    }

    const menuElement = menuRef.current;
    if (!menuElement) {
      return;
    }

    const menuRect = menuElement.getBoundingClientRect();
    menuDragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - menuRect.left,
      offsetY: event.clientY - menuRect.top,
      width: menuRect.width,
      height: menuRect.height,
    };
    setIsMenuDragging(true);
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const updateMenuDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = menuDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const nextWidth = menuRef.current?.offsetWidth ?? dragState.width;
    const nextHeight = menuRef.current?.offsetHeight ?? dragState.height;
    setMenuCoordinates(clampMenuPosition(
      event.clientX - dragState.offsetX,
      event.clientY - dragState.offsetY,
      nextWidth,
      nextHeight,
    ));
  };

  const finishMenuDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = menuDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    menuDragStateRef.current = null;
    setIsMenuDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const commitUserIdentity = () => {
    if (!onUpdateConfig) {
      return;
    }

    onUpdateConfig(updateChatUserIdentity(config, {
      avatarUrl: currentUserAvatarUrl,
      displayId: userDisplayIdDraft,
      displayName: userDisplayNameDraft,
    }), { persist: true });
    setFeedback('已保存');
  };

  const openAvatarCropEditor = async (files: FileList | null, target: ChatAvatarCropTarget) => {
    const file = files?.[0];
    if (!file || !onUpdateConfig) {
      return;
    }

    try {
      const cropDraft = await createChatAvatarCropDraft(file, target);
      setAvatarCropDraft(cropDraft);
      setFeedback('');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '图片读取失败。');
    }
  };

  const saveCroppedAvatar = (avatarUrl: string, target: ChatAvatarCropTarget) => {
    if (!onUpdateConfig) {
      return;
    }

    if (target === 'pet') {
      onUpdateConfig(updateChatPetAvatarUrl(config, activePetId, avatarUrl), { persist: true });
      setFeedback('已更新桌宠头像');
    } else {
      onUpdateConfig(updateChatUserIdentity(config, {
        avatarUrl,
        displayId: userDisplayIdDraft,
        displayName: userDisplayNameDraft,
      }), { persist: true });
      setFeedback('已更新用户头像');
    }

    setAvatarCropDraft(null);
  };

  const updateBackgroundImage = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !onUpdateConfig) {
      return;
    }

    try {
      const backgroundImageUrl = await readSingleImageFile(file, CHAT_BACKGROUND_IMAGE_MAX_EDGE);
      onUpdateConfig(updateChatBackgroundImageUrl(config, backgroundImageUrl), { persist: true });
      setFeedback('已更新聊天背景');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '图片读取失败。');
    }
  };

  const clearActivePetAvatar = () => {
    onUpdateConfig?.(updateChatPetAvatarUrl(config, activePetId, ''), { persist: true });
    setFeedback('已清除桌宠头像');
  };

  const clearUserAvatar = () => {
    onUpdateConfig?.(updateChatUserIdentity(config, {
      avatarUrl: '',
      displayId: userDisplayIdDraft,
      displayName: userDisplayNameDraft,
    }), { persist: true });
    setFeedback('已清除用户头像');
  };

  const clearBackgroundImage = () => {
    onUpdateConfig?.(updateChatBackgroundImageUrl(config, ''), { persist: true });
    setFeedback('已清除聊天背景');
  };

  const commitAvatarDisplaySize = (nextSize: number) => {
    onUpdateConfig?.(updateChatAvatarDisplaySize(config, nextSize), { persist: true });
  };

  const commitBackgroundImageSize = (nextSize: number) => {
    onUpdateConfig?.(updateChatBackgroundImageSize(config, nextSize), { persist: true });
  };

  const commitBackgroundImageVisibility = (nextVisibility: number) => {
    onUpdateConfig?.(updateChatBackgroundImageVisibility(config, nextVisibility), { persist: true });
  };

  const menuElement = (
    <div
      data-chat-appearance-menu="true"
      className="fixed z-max rounded-[15px] border border-border bg-white shadow-[0_18px_42px_rgba(148,163,184,0.24)]"
      ref={menuRef}
      style={{
        left: menuCoordinates.x,
        top: menuCoordinates.y,
        maxHeight: `calc(100vh - ${menuCoordinates.y + 8}px)`,
        overflowY: 'auto',
        width: `min(${MENU_WIDTH}px, calc(100vw - 16px))`,
        WebkitAppRegion: 'no-drag',
      } as NoDragStyle}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div
        className={`sticky top-0 z-20 flex touch-none items-center justify-between gap-3 border-b border-border bg-white p-3 pb-2 ${isMenuDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={beginMenuDrag}
        onPointerMove={updateMenuDrag}
        onPointerUp={finishMenuDrag}
        onPointerCancel={finishMenuDrag}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Move className="h-3.5 w-3.5 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-foreground">聊天外观</div>
            <div className="mt-1 text-xs text-primary">{activePetName}</div>
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 text-primary hover:bg-muted hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-3 p-3 pt-3">
        {avatarCropDraft && (
          <PetChatAvatarCropEditor
            draft={avatarCropDraft}
            onCancel={() => setAvatarCropDraft(null)}
            onConfirm={saveCroppedAvatar}
          />
        )}

        <div className="space-y-2 rounded-sm border border-border bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-2xs font-bold uppercase tracking-widest text-primary">桌宠头像</Label>
            <AvatarPreview avatarUrl={currentPetAvatarUrl} fallbackText={activePetName} size={avatarDisplaySizeDraft} />
          </div>
          <div className="flex gap-2">
            <input
              ref={petAvatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (event) => {
                await openAvatarCropEditor(event.target.files, 'pet');
                event.target.value = '';
              }}
            />
            <Button type="button" variant="outline" className="h-8 rounded-full border-border bg-white px-3 text-2xs text-primary hover:bg-muted" onClick={() => petAvatarInputRef.current?.click()}>
              <ImagePlus className="mr-1 h-3 w-3" />
              上传
            </Button>
            <Button type="button" variant="outline" className="h-8 rounded-full border-border bg-white px-3 text-2xs text-primary hover:bg-muted" onClick={clearActivePetAvatar}>
              <Trash2 className="mr-1 h-3 w-3" />
              清除
            </Button>
          </div>
        </div>

        <div className="space-y-2 rounded-sm border border-border bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-2xs font-bold uppercase tracking-widest text-primary">用户头像</Label>
            <AvatarPreview
              avatarUrl={currentUserAvatarUrl}
              fallbackText={userDisplayNameDraft || resolveChatUserDisplayName(config)}
              size={avatarDisplaySizeDraft}
            />
          </div>
          <div className="flex gap-2">
            <input
              ref={userAvatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (event) => {
                await openAvatarCropEditor(event.target.files, 'user');
                event.target.value = '';
              }}
            />
            <Button type="button" variant="outline" className="h-8 rounded-full border-border bg-white px-3 text-2xs text-primary hover:bg-muted" onClick={() => userAvatarInputRef.current?.click()}>
              <UserRound className="mr-1 h-3 w-3" />
              上传
            </Button>
            <Button type="button" variant="outline" className="h-8 rounded-full border-border bg-white px-3 text-2xs text-primary hover:bg-muted" onClick={clearUserAvatar}>
              <Trash2 className="mr-1 h-3 w-3" />
              清除
            </Button>
          </div>
          <div className="grid gap-2">
            <div className="grid gap-1">
              <Label className="text-2xs font-bold uppercase tracking-widest text-primary">昵称</Label>
              <Input
                value={userDisplayNameDraft}
                onChange={(event) => setUserDisplayNameDraft(event.target.value)}
                onBlur={commitUserIdentity}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitUserIdentity();
                  }
                }}
                className="h-8 rounded-sm border-border bg-white text-xs text-foreground focus-visible:ring-ring"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-2xs font-bold uppercase tracking-widest text-primary">ID</Label>
              <Input
                value={userDisplayIdDraft}
                onChange={(event) => setUserDisplayIdDraft(event.target.value)}
                onBlur={commitUserIdentity}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitUserIdentity();
                  }
                }}
                className="h-8 rounded-sm border-border bg-white text-xs text-foreground focus-visible:ring-ring"
              />
            </div>
            <Button type="button" variant="secondary" className="h-8 rounded-full border-primary bg-primary px-3 text-2xs text-white hover:bg-primary" onClick={commitUserIdentity}>
              <Save className="mr-1 h-3 w-3" />
              应用
            </Button>
          </div>
        </div>

        <div className="space-y-2 rounded-sm border border-border bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-2xs font-bold uppercase tracking-widest text-primary">聊天背景</Label>
            <div className="flex size-10 items-center justify-center overflow-hidden rounded-sm border border-border bg-white text-2xs text-primary">
              {config.settings.chatBackgroundImageEnabled && config.settings.chatBackgroundImageUrl ? (
                <img alt="" src={config.settings.chatBackgroundImageUrl} className="size-full object-cover" draggable={false} />
              ) : (
                <span>OFF</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <input
              ref={backgroundInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (event) => {
                await updateBackgroundImage(event.target.files);
                event.target.value = '';
              }}
            />
            <Button type="button" variant="outline" className="h-8 rounded-full border-border bg-white px-3 text-2xs text-primary hover:bg-muted" onClick={() => backgroundInputRef.current?.click()}>
              <ImagePlus className="mr-1 h-3 w-3" />
              上传
            </Button>
            <Button type="button" variant="outline" className="h-8 rounded-full border-border bg-white px-3 text-2xs text-primary hover:bg-muted" onClick={clearBackgroundImage}>
              <Trash2 className="mr-1 h-3 w-3" />
              清除
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-sm border border-border bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-2xs font-bold uppercase tracking-widest text-primary">图片尺寸</Label>
            <div className="text-2xs text-primary">
              头像 {avatarDisplaySizeDraft}px / 背景 {backgroundImageSizeDraft}%
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-2xs text-primary">
              <span>头像大小</span>
              <span>{avatarDisplaySizeDraft}px</span>
            </div>
            <Slider
              value={[avatarDisplaySizeDraft]}
              min={CHAT_AVATAR_DISPLAY_SIZE_MIN}
              max={CHAT_AVATAR_DISPLAY_SIZE_MAX}
              step={1}
              onValueChange={(value) => {
                setAvatarDisplaySizeDraft(value[0] ?? avatarDisplaySizeDraft);
              }}
              onValueCommit={(value) => commitAvatarDisplaySize(value[0] ?? avatarDisplaySizeDraft)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-2xs text-primary">
              <span>背景缩放</span>
              <span>{backgroundImageSizeDraft}%</span>
            </div>
            <Slider
              value={[backgroundImageSizeDraft]}
              min={CHAT_BACKGROUND_IMAGE_SIZE_MIN}
              max={CHAT_BACKGROUND_IMAGE_SIZE_MAX}
              step={1}
              onValueChange={(value) => {
                setBackgroundImageSizeDraft(value[0] ?? backgroundImageSizeDraft);
              }}
              onValueCommit={(value) => commitBackgroundImageSize(value[0] ?? backgroundImageSizeDraft)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-2xs text-primary">
              <span>背景清晰度</span>
              <span>{backgroundImageVisibilityDraft}%</span>
            </div>
            <Slider
              value={[backgroundImageVisibilityDraft]}
              min={CHAT_BACKGROUND_IMAGE_VISIBILITY_MIN}
              max={CHAT_BACKGROUND_IMAGE_VISIBILITY_MAX}
              step={1}
              onValueChange={(value) => {
                setBackgroundImageVisibilityDraft(value[0] ?? backgroundImageVisibilityDraft);
              }}
              onValueCommit={(value) => commitBackgroundImageVisibility(value[0] ?? backgroundImageVisibilityDraft)}
            />
          </div>
        </div>

        {feedback && (
          <div className="rounded-sm border border-border bg-muted px-3 py-2 text-2xs text-primary">
            {feedback}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(menuElement, document.body);
}
