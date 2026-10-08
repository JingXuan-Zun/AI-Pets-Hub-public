import { useEffect, useRef, useState } from 'react';
import { type PetConfig, type PetModelPreset } from '../../types';
import {
  VIDEO_EMOTION_ACTIONS,
  resolveVideoEmotionFolderNames,
} from '../../pet-runtime/video2d/videoLibraryEmotionFolders';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';

type LibraryFolder = { name: string; videoCount: number };

const EMOTION_LABELS = { EATING: '吃东西', HAPPY: '开心', SAD: '伤心', SLEEPING: '睡觉' } as const;

interface Props {
  config: PetConfig;
  onApplyConfig: (config: PetConfig) => void;
  preset: PetModelPreset;
}

export function SettingsVideoLibraryPanel({ config, onApplyConfig, preset }: Props) {
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [feedback, setFeedback] = useState('');
  const requestIdRef = useRef(0);
  const configRef = useRef(config);
  configRef.current = config;
  const rootPath = preset.videoLibraryRootPath ?? '';

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setFolders([]);
    if (!rootPath || !window.desktopPetShell?.inspect2DVideoLibrary) return;
    void window.desktopPetShell.inspect2DVideoLibrary({ rootPath }).then((result) => {
      if (requestId !== requestIdRef.current) return;
      setFolders(result.ok ? result.folders ?? [] : []);
      setFeedback(result.ok ? '' : result.error ?? '角色视频根目录无法读取');
    }).catch((error) => {
      if (requestId === requestIdRef.current) setFeedback(String(error));
    });
  }, [rootPath]);

  const updatePreset = (patch: Partial<PetModelPreset>) => {
    const currentConfig = configRef.current;
    onApplyConfig({
      ...currentConfig,
      customModelPresets: currentConfig.customModelPresets.map((item) => (
        item.id === preset.id ? { ...item, ...patch } : item
      )),
    });
  };

  const handleChooseRoot = async () => {
    if (!window.desktopPetShell?.choose2DVideoLibrary) {
      setFeedback('请在桌面版选择角色视频根目录。');
      return;
    }
    try {
      const result = await window.desktopPetShell.choose2DVideoLibrary();
      if (result.cancelled) return;
      if (!result.ok || !result.rootPath) throw new Error(result.error || '角色视频根目录选择失败');
      updatePreset({ randomVideoPlaybackEnabled: true, videoLibraryRootPath: result.rootPath });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '角色视频根目录选择失败');
    }
  };

  const folderNames = new Set(folders.map((folder) => folder.name.trim().toLowerCase()));
  const emotionMatches = VIDEO_EMOTION_ACTIONS.map((action) => ({
    action,
    folder: resolveVideoEmotionFolderNames(action, preset.videoEmotionFolderAliases)
      .find((name) => folderNames.has(name.trim().toLowerCase())) ?? null,
  }));

  return (
    <div className="mt-3 space-y-2 rounded-sm border border-border/70 bg-background/20 px-2 py-2 text-2xs">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-foreground">角色视频根目录（每个子文件夹是一组动画）</span>
        <button type="button" className="rounded border border-border px-2 py-1 text-primary hover:bg-primary/10"
          onClick={() => { void handleChooseRoot(); }}>
          {rootPath ? '更换根目录' : '选择根目录'}
        </button>
      </div>
      {rootPath ? (
        <code className="block break-all select-text font-mono text-3xs text-muted-foreground">{rootPath}</code>
      ) : null}
      {folders.length > 0 ? (
        <p className="text-muted-foreground">
          子文件夹：{folders.map((folder) => `${folder.name}（${folder.videoCount}）`).join('、')}
        </p>
      ) : null}
      {rootPath ? (
        <p className="text-muted-foreground">
          情绪动画：{emotionMatches.map(({ action, folder }) => (
            `${EMOTION_LABELS[action]} → ${folder ?? '未找到'}`
          )).join('；')}
        </p>
      ) : null}
      <SettingsToggleSwitch
        label="待机时随机挑选子文件夹轮流播放"
        checked={preset.randomVideoPlaybackEnabled === true}
        disabled={!rootPath}
        onChange={(enabled) => updatePreset({ randomVideoPlaybackEnabled: enabled })}
      />
      {feedback ? <p role="status" className="text-muted-foreground">{feedback}</p> : null}
    </div>
  );
}
