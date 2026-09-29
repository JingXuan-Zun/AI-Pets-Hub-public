import { AtSign, Bot, Globe, ImagePlus, Loader2, Mic, MicOff, Send, Slash, X } from 'lucide-react';
import {
  type ClipboardEvent,
  type ChangeEvent,
  type DragEvent,
  type HTMLAttributes,
  type MutableRefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { type ChatMessageImageAttachment, type DesktopPetChatMode, type PetConfig } from '../../types';
import { resolveChatPetAvatarUrl } from './chatAppearanceUtils';
import {
  createChatImageAttachmentsFromFiles,
  hasImageDataTransfer,
  hasImageFiles,
  MAX_CHAT_IMAGE_ATTACHMENTS,
  SUPPORTED_CHAT_IMAGE_ACCEPT,
} from './chatImageAttachmentUtils';
import { type ChatTargetOption } from './multiPetChat';

type BrowserSearchMode = 'allow' | 'block' | 'force';

type MentionTrigger = {
  endIndex: number;
  query: string;
  startIndex: number;
};

interface PetChatConversationComposerProps {
  chatMode: DesktopPetChatMode;
  commitInputValue: (nextValue: string) => void;
  composerClassName: string;
  composerProps?: HTMLAttributes<HTMLDivElement>;
  config: PetConfig;
  draftAttachments: ChatMessageImageAttachment[];
  draftValue: string;
  browserSearchMode: BrowserSearchMode | null;
  agentMode: boolean;
  flushAndSendMessage: (options?: { agentMode?: boolean; browserSearchMode?: BrowserSearchMode }) => void;
  inputSyncFrameRef: MutableRefObject<number | null>;
  isListening: boolean;
  onAddDraftAttachments: (attachments: ChatMessageImageAttachment[]) => void;
  onRemoveDraftAttachment: (attachmentId: string) => void;
  onToggleVoiceInput: () => void;
  petOptions: ChatTargetOption[];
  scheduleInputSync: (nextValue: string) => void;
  setBrowserSearchMode: (mode: BrowserSearchMode | null) => void;
  setAgentMode: (enabled: boolean) => void;
  setDraftValue: (nextValue: string) => void;
  activePetName: string;
  voiceInputEnabled: boolean;
}

export function PetChatConversationComposer({
  activePetName,
  chatMode,
  commitInputValue,
  composerClassName,
  composerProps,
  config,
  draftAttachments,
  draftValue,
  browserSearchMode,
  agentMode,
  flushAndSendMessage,
  inputSyncFrameRef,
  isListening,
  onAddDraftAttachments,
  onRemoveDraftAttachment,
  onToggleVoiceInput,
  petOptions,
  scheduleInputSync,
  setBrowserSearchMode,
  setDraftValue,
  setAgentMode,
  voiceInputEnabled,
}: PetChatConversationComposerProps) {
  const slashMenuRef = useRef<HTMLDivElement | null>(null);
  const mentionMenuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const imageDragDepthRef = useRef(0);
  const [mentionTrigger, setMentionTrigger] = useState<MentionTrigger | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [slashMenuPinnedOpen, setSlashMenuPinnedOpen] = useState(false);
  const [isReadingImage, setIsReadingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [isImageDragActive, setIsImageDragActive] = useState(false);
  const showSlashCommandMenu = draftValue.trim() === '/';
  const showSlashMenu = showSlashCommandMenu || slashMenuPinnedOpen;
  const canAddImage = draftAttachments.length < MAX_CHAT_IMAGE_ATTACHMENTS;
  const slashSwitchOptions = useMemo(() => ([
    { label: 'Agent', mode: 'agent' as const, icon: <Bot className="h-3 w-3" /> },
    { label: '本次查浏览器', mode: 'force' as const, icon: <Globe className="h-3 w-3" /> },
    { label: '不调用浏览器', mode: 'block' as const, icon: <Slash className="h-3 w-3" /> },
  ]), []);
  const activeSlashMode = agentMode
    ? slashSwitchOptions.find((item) => item.mode === 'agent') ?? null
    : slashSwitchOptions.find((item) => item.mode === browserSearchMode) ?? null;
  const mentionOptions = useMemo(() => {
    if (chatMode !== 'group' || !mentionTrigger) {
      return [];
    }

    const normalizedQuery = normalizeMentionText(mentionTrigger.query);
    return petOptions.filter((option) => {
      if (!normalizedQuery) {
        return true;
      }

      return normalizeMentionText(`${option.name} ${option.label}`).includes(normalizedQuery);
    });
  }, [chatMode, mentionTrigger, petOptions]);
  const showMentionMenu = chatMode === 'group' && Boolean(mentionTrigger) && mentionOptions.length > 0;

  useEffect(() => {
    if (!showSlashMenu) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!slashMenuRef.current?.contains(event.target as Node)) {
        if (showSlashCommandMenu) {
          setAgentMode(false);
          setBrowserSearchMode(null);
        }
        setSlashMenuPinnedOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [setAgentMode, setBrowserSearchMode, showSlashCommandMenu, showSlashMenu]);

  useEffect(() => {
    setActiveMentionIndex(0);
  }, [mentionTrigger?.startIndex, mentionTrigger?.query, mentionOptions.length]);

  useEffect(() => {
    if (!showMentionMenu) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const targetNode = event.target as Node;
      if (mentionMenuRef.current?.contains(targetNode) || inputRef.current === targetNode) {
        return;
      }

      setMentionTrigger(null);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [showMentionMenu]);

  useEffect(() => {
    if (!isImageDragActive) {
      return undefined;
    }

    const clearImageDragState = () => {
      imageDragDepthRef.current = 0;
      setIsImageDragActive(false);
    };

    window.addEventListener('dragend', clearImageDragState);
    window.addEventListener('drop', clearImageDragState);
    return () => {
      window.removeEventListener('dragend', clearImageDragState);
      window.removeEventListener('drop', clearImageDragState);
    };
  }, [isImageDragActive]);

  const updateMentionTrigger = (nextValue: string, caretIndex?: number | null) => {
    if (chatMode !== 'group') {
      setMentionTrigger(null);
      return;
    }

    setMentionTrigger(resolveMentionTrigger(nextValue, caretIndex ?? nextValue.length));
  };

  const insertMentionTarget = (option: ChatTargetOption) => {
    if (!mentionTrigger) {
      return;
    }

    const mentionText = `@${option.name} `;
    const nextValue = `${draftValue.slice(0, mentionTrigger.startIndex)}${mentionText}${draftValue.slice(mentionTrigger.endIndex)}`;
    const nextCaretIndex = mentionTrigger.startIndex + mentionText.length;

    setDraftValue(nextValue);
    scheduleInputSync(nextValue);
    setMentionTrigger(null);

    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCaretIndex, nextCaretIndex);
    });
  };

  const addImageFiles = async (files: FileList | File[] | null | undefined) => {
    const selectedFiles = Array.from(files ?? []);
    if (!hasImageFiles(selectedFiles) || isReadingImage) {
      return;
    }

    if (!canAddImage) {
      setImageError(`最多添加 ${MAX_CHAT_IMAGE_ATTACHMENTS} 张图片。`);
      return;
    }

    setIsReadingImage(true);
    setImageError('');

    try {
      const attachments = await createChatImageAttachmentsFromFiles(
        selectedFiles,
        draftAttachments.length,
      );
      if (attachments.length === 0) {
        setImageError('没有读取到可发送的图片。');
        return;
      }

      onAddDraftAttachments(attachments);
      if (selectedFiles.length > attachments.length) {
        setImageError(`最多添加 ${MAX_CHAT_IMAGE_ATTACHMENTS} 张图片。`);
      }
      window.requestAnimationFrame(() => inputRef.current?.focus());
    } catch (error) {
      setImageError(error instanceof Error ? error.message : '图片读取失败。');
    } finally {
      setIsReadingImage(false);
    }
  };

  const handleImageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files;
    void addImageFiles(files);
    event.currentTarget.value = '';
  };

  const handleInputPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const files = Array.from(event.clipboardData.files ?? []);
    if (!hasImageFiles(files)) {
      return;
    }

    event.preventDefault();
    void addImageFiles(files);
  };

  const resetImageDragState = () => {
    imageDragDepthRef.current = 0;
    setIsImageDragActive(false);
  };

  const acceptImageDragEvent = (event: DragEvent<HTMLDivElement>) => {
    if (!hasImageDataTransfer(event.dataTransfer)) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = canAddImage && !isReadingImage ? 'copy' : 'none';
    return true;
  };

  const handleComposerDragEnter = (event: DragEvent<HTMLDivElement>) => {
    composerProps?.onDragEnter?.(event);
    if (!acceptImageDragEvent(event)) {
      return;
    }

    imageDragDepthRef.current += 1;
    setIsImageDragActive(true);
  };

  const handleComposerDragOver = (event: DragEvent<HTMLDivElement>) => {
    composerProps?.onDragOver?.(event);
    if (acceptImageDragEvent(event)) {
      setIsImageDragActive(true);
    }
  };

  const handleComposerDragLeave = (event: DragEvent<HTMLDivElement>) => {
    composerProps?.onDragLeave?.(event);
    if (!acceptImageDragEvent(event)) {
      return;
    }

    imageDragDepthRef.current = Math.max(0, imageDragDepthRef.current - 1);
    if (imageDragDepthRef.current === 0) {
      setIsImageDragActive(false);
    }
  };

  const handleComposerDragEnd = (event: DragEvent<HTMLDivElement>) => {
    composerProps?.onDragEnd?.(event);
    resetImageDragState();
  };

  const handleComposerDrop = (event: DragEvent<HTMLDivElement>) => {
    composerProps?.onDrop?.(event);
    if (!acceptImageDragEvent(event)) {
      return;
    }

    resetImageDragState();
    void addImageFiles(event.dataTransfer.files);
  };

  return (
    <div
      {...composerProps}
      className={`relative flex-col ${composerClassName} ${isImageDragActive ? 'ring-2 ring-sky-300/80 ring-offset-0' : ''}`}
      onDragEnd={handleComposerDragEnd}
      onDragEnter={handleComposerDragEnter}
      onDragLeave={handleComposerDragLeave}
      onDragOver={handleComposerDragOver}
      onDrop={handleComposerDrop}
    >
      {isImageDragActive && (
        <div className="pointer-events-none absolute inset-2 z-40 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-sky-300 bg-white/82 px-4 text-[11px] font-semibold text-sky-900 shadow-inner backdrop-blur-sm">
          <ImagePlus className="h-4 w-4" />
          <span>{canAddImage ? '松手添加图片' : `最多 ${MAX_CHAT_IMAGE_ATTACHMENTS} 张图片`}</span>
        </div>
      )}
      {draftAttachments.length > 0 && (
        <div className="mb-2 flex w-full min-w-0 gap-2 overflow-x-auto pb-0.5 pl-11 pr-11">
          {draftAttachments.map((attachment) => (
            <div
              key={attachment.id}
              className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-sky-100 bg-white shadow-[0_8px_18px_rgba(148,163,184,0.12)]"
              title={attachment.name}
            >
              <img
                alt={attachment.name}
                src={attachment.dataUrl}
                className="h-full w-full object-cover"
                draggable={false}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => onRemoveDraftAttachment(attachment.id)}
                className="absolute right-1 top-1 h-5 w-5 rounded-full border border-white/80 bg-sky-950/78 text-white opacity-90 hover:bg-sky-900 hover:text-white"
                title="移除图片"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex w-full min-w-0 gap-2">
      <Button
        size="icon"
        variant="secondary"
        onClick={onToggleVoiceInput}
        disabled={!voiceInputEnabled}
        className={`h-9 w-9 shrink-0 rounded-full border border-sky-100 bg-white text-sky-800 hover:bg-sky-50 ${isListening ? '!border-red-300 !bg-red-50 !text-red-500' : ''}`}
        title={voiceInputEnabled ? '语音输入' : '语音输入已关闭'}
      >
        {isListening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
      </Button>
      <Button
        type="button"
        size="icon"
        variant="secondary"
        onClick={() => imageInputRef.current?.click()}
        disabled={isReadingImage || !canAddImage}
        className="h-9 w-9 shrink-0 rounded-full border border-sky-100 bg-white text-sky-800 hover:bg-sky-50"
        title={canAddImage ? '添加图片' : `最多添加 ${MAX_CHAT_IMAGE_ATTACHMENTS} 张图片`}
      >
        {isReadingImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
      </Button>
      <input
        ref={imageInputRef}
        type="file"
        accept={SUPPORTED_CHAT_IMAGE_ACCEPT}
        multiple
        hidden
        onChange={handleImageInputChange}
      />
      {activeSlashMode && (
        <Button
          type="button"
          variant="secondary"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => {
            setSlashMenuPinnedOpen((isOpen) => !isOpen);
          }}
          className={[
            'h-9 max-w-[150px] shrink-0 rounded-full border px-3 text-[11px] font-semibold shadow-sm',
            agentMode
              ? 'border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100'
              : browserSearchMode === 'force'
              ? 'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100'
              : browserSearchMode === 'block'
                ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                : 'border-sky-100 bg-white text-sky-800 hover:bg-sky-50',
          ].join(' ')}
          title={`当前发送选项：${activeSlashMode.label}`}
        >
          {activeSlashMode.icon}
          <span className="ml-1.5 truncate">{activeSlashMode.label}</span>
        </Button>
      )}
      <Input
        ref={inputRef}
        value={draftValue}
        onChange={(event) => {
          const nextValue = event.target.value;
          setDraftValue(nextValue);
          scheduleInputSync(nextValue);
          updateMentionTrigger(nextValue, event.target.selectionStart);
        }}
        onBlur={() => {
          if (inputSyncFrameRef.current !== null) {
            window.cancelAnimationFrame(inputSyncFrameRef.current);
            inputSyncFrameRef.current = null;
            commitInputValue(draftValue);
          }
        }}
        onClick={(event) => updateMentionTrigger(draftValue, event.currentTarget.selectionStart)}
        onPaste={handleInputPaste}
        onKeyDown={(event) => {
          if (showMentionMenu) {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveMentionIndex((currentIndex) => (currentIndex + 1) % mentionOptions.length);
              return;
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveMentionIndex((currentIndex) => (
                currentIndex - 1 + mentionOptions.length
              ) % mentionOptions.length);
              return;
            }

            if (event.key === 'Enter' || event.key === 'Tab') {
              event.preventDefault();
              insertMentionTarget(mentionOptions[activeMentionIndex] ?? mentionOptions[0]);
              return;
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              setMentionTrigger(null);
              return;
            }
          }

          if (event.key === 'Enter') {
            event.preventDefault();
            flushAndSendMessage();
          }
        }}
        onKeyUp={(event) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            updateMentionTrigger(draftValue, event.currentTarget.selectionStart);
          }
        }}
        placeholder={chatMode === 'single'
          ? `发消息给 ${activePetName}...`
          : chatMode === 'story' ? '描述你的行动、选择或对话...' : '发消息到桌宠群聊...'}
        className="h-9 min-w-0 flex-1 rounded-full border border-sky-100 bg-white px-4 text-xs text-sky-950 placeholder:text-sky-300 focus-visible:ring-sky-300"
      />
      <Button
        size="icon"
        onClick={() => flushAndSendMessage(agentMode || browserSearchMode ? {
          agentMode: agentMode || undefined,
          browserSearchMode: browserSearchMode ?? undefined,
        } : undefined)}
        className="h-9 w-9 shrink-0 rounded-full bg-sky-950 text-white hover:bg-sky-900"
      >
        <Send className="h-3 w-3" />
      </Button>
      </div>
      {imageError && (
        <div className="mt-2 max-w-full truncate pl-11 pr-11 text-[10px] font-medium text-rose-500" aria-live="polite">
          {imageError}
        </div>
      )}
      {showMentionMenu && (
        <div
          ref={mentionMenuRef}
          className="absolute bottom-[calc(100%+10px)] left-14 z-50 flex max-h-56 min-w-[240px] flex-col gap-1 overflow-y-auto rounded-2xl border border-sky-100 bg-white/95 p-2 shadow-[0_18px_42px_rgba(148,163,184,0.18)] backdrop-blur"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-2 px-2 pb-1 text-[10px] uppercase tracking-[0.18em] text-sky-700">
            <AtSign className="h-3 w-3 text-sky-700" />
            指定角色
          </div>
          {mentionOptions.map((option, index) => {
            const avatarUrl = resolveChatPetAvatarUrl(config, option.id);
            const fallbackText = Array.from(option.name.trim() || option.label.trim() || '?')[0];

            return (
              <Button
                key={option.id}
                type="button"
                variant="ghost"
                className={`h-10 justify-start rounded-xl px-2 text-left ${
                  activeMentionIndex === index
                    ? 'bg-sky-50 text-sky-950'
                    : 'text-sky-800 hover:bg-sky-50'
                }`}
                onMouseEnter={() => setActiveMentionIndex(index)}
                onClick={() => insertMentionTarget(option)}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sky-100 bg-white text-[10px] font-semibold text-sky-700">
                  {avatarUrl ? (
                    <img alt="" src={avatarUrl} className="size-full object-cover" draggable={false} />
                  ) : (
                    fallbackText
                  )}
                </span>
                <span className="ml-2 min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">@{option.name}</span>
                  <span className="block truncate text-[10px] font-medium text-sky-500">{option.label}</span>
                </span>
              </Button>
            );
          })}
        </div>
      )}
      {showSlashMenu && (
        <div
          ref={slashMenuRef}
          className="absolute bottom-[calc(100%+10px)] left-2 z-50 flex min-w-[240px] flex-col gap-1 rounded-2xl border border-sky-100 bg-white/95 p-2 shadow-[0_18px_42px_rgba(148,163,184,0.18)] backdrop-blur"
        >
          <div className="flex items-center gap-2 px-2 pb-1 text-[10px] uppercase tracking-[0.18em] text-sky-700">
            <Slash className="h-3 w-3 text-sky-700" />
            `/` 发送选项
          </div>
          <div className="mb-1 flex items-center justify-between gap-3 rounded-xl bg-sky-50/70 px-3 py-2 text-[11px] text-sky-800">
            <span className="font-medium">当前模式</span>
            <span className="truncate font-semibold">{activeSlashMode?.label ?? '正常发送'}</span>
          </div>
          {slashSwitchOptions.map((item) => {
            const checked = item.mode === 'agent'
              ? agentMode
              : browserSearchMode === item.mode;
            const checkedSwitchClassName = item.mode === 'agent'
              ? 'border-violet-300 bg-violet-400'
              : 'border-sky-300 bg-sky-400';

            return (
              <Button
                key={item.mode}
                type="button"
                variant="ghost"
                role="switch"
                aria-checked={checked}
                className={`h-11 justify-between rounded-xl px-3 text-left text-xs ${checked ? 'bg-sky-50 text-sky-950' : 'text-sky-800 hover:bg-sky-50'}`}
                onClick={() => {
                  if (item.mode === 'agent') {
                    setAgentMode(!checked);
                    if (!checked) {
                      setBrowserSearchMode(null);
                    }
                  } else {
                    setBrowserSearchMode(checked ? null : item.mode);
                    if (!checked) {
                      setAgentMode(false);
                    }
                  }
                  if (showSlashCommandMenu) {
                    setSlashMenuPinnedOpen(true);
                    setDraftValue('');
                    scheduleInputSync('');
                  }
                }}
              >
                <span className="flex min-w-0 items-center">
                  {item.icon}
                  <span className="ml-2 truncate">{item.label}</span>
                </span>
                <span
                  className={[
                    'relative ml-3 h-5 w-9 shrink-0 rounded-full border transition-colors',
                    checked ? checkedSwitchClassName : 'border-slate-200 bg-slate-100',
                  ].join(' ')}
                  aria-hidden="true"
                >
                  <span
                    className={[
                      'absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform',
                      checked ? 'translate-x-[18px]' : 'translate-x-0.5',
                    ].join(' ')}
                  />
                </span>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function normalizeMentionText(text: string) {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/\s+/g, '');
}

function resolveMentionTrigger(value: string, caretIndex: number): MentionTrigger | null {
  const safeCaretIndex = Math.max(0, Math.min(caretIndex, value.length));
  const prefix = value.slice(0, safeCaretIndex);
  const halfWidthAtIndex = prefix.lastIndexOf('@');
  const fullWidthAtIndex = prefix.lastIndexOf('＠');
  const startIndex = Math.max(halfWidthAtIndex, fullWidthAtIndex);

  if (startIndex < 0) {
    return null;
  }

  const query = prefix.slice(startIndex + 1);
  if (/[\s\r\n\t]/u.test(query) || query.includes('@') || query.includes('＠')) {
    return null;
  }

  return {
    endIndex: safeCaretIndex,
    query,
    startIndex,
  };
}
