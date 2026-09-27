import { useEffect, useState } from 'react';
import { type PetConfig, type PetConfigUpdateHandler } from '../../types';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { Input } from '../../../components/ui/input';
import { Slider } from '../../../components/ui/slider';
import { ChatBubbleTransparencyControl } from './ChatBubbleTransparencyControl';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';
import {
  CHAT_FONT_SIZE_MAX,
  CHAT_FONT_SIZE_MIN,
  CHAT_FONT_WEIGHT_MAX,
  CHAT_FONT_WEIGHT_MIN,
} from '../../chatAppearanceSettings';
import { SettingsMcpSection } from './SettingsMcpSection';
import { toggleButtonClass, inputClassName, selectClassName } from './settingsVoiceUtils';

export type RealWorldTimeSnapshot = {
  dateText: string;
  timeText: string;
  timezone: string;
  dayPeriod: string;
};

export interface SettingsSystemTabProps {
  localConfig: PetConfig;
  logs: string[];
  onApplyConfig: (config: PetConfig) => void;
  realWorldTimeSnapshot: RealWorldTimeSnapshot;
  timeAwarenessEnabled: boolean;
  onlyWebSearch?: boolean;
  onlyChatDisplay?: boolean;
  onUpdateConfig?: PetConfigUpdateHandler;
}

const TEXT_NONE = '\u6682\u65E0';
const TEXT_ENABLED = '\u5DF2\u5F00\u542F';
const TEXT_DISABLED = '\u5DF2\u5173\u95ED';
const TEXT_SYSTEM_TITLE = '\u73B0\u5B9E\u4E16\u754C\u65F6\u95F4\u611F\u77E5';
const TEXT_SYSTEM_DESC = '\u8BA9\u684C\u5BA0\u7ED3\u5408\u4F60\u7535\u8111\u5F53\u524D\u7684\u672C\u5730\u65E5\u671F\u548C\u65F6\u95F4\uFF0C\u7406\u89E3\u201C\u4ECA\u5929\u201D\u201C\u660E\u5929\u201D\u201C\u73B0\u5728\u201D\u8FD9\u7C7B\u65F6\u95F4\u8868\u8FBE\u3002';
const TEXT_DATE = '\u65E5\u671F';
const TEXT_TIME = '\u65F6\u95F4';
const TEXT_TIMEZONE = '\u65F6\u533A';
const TEXT_DAY_PERIOD = '\u65F6\u95F4\u6BB5';
const TEXT_TIME_ENABLED_NOTE = '\u5F53\u524D\u73B0\u5B9E\u65F6\u95F4\u4F1A\u6CE8\u5165\u5230 AI \u7684\u4EBA\u683C\u63D0\u793A\u8BCD\u4E2D\u3002';
const TEXT_TIME_DISABLED_NOTE = '\u73B0\u5B9E\u4E16\u754C\u65F6\u95F4\u611F\u77E5\u76EE\u524D\u5904\u4E8E\u5173\u95ED\u72B6\u6001\u3002';
const TEXT_RUNTIME_TITLE = 'Avatar Runtime \u72B6\u6001';
const TEXT_RUNTIME_DESC = '\u7528\u4E8E\u5FEB\u901F\u67E5\u770B\u6BCF\u53EA\u684C\u5BA0\u7684 3D runtime \u5C31\u7EEA\u72B6\u6001\u3001\u6700\u8FD1\u4E8B\u4EF6\u3001\u52A8\u4F5C\u8868\u60C5\u548C\u6027\u80FD\u6458\u8981\u3002';
const TEXT_RUNTIME_EMPTY = '\u5F53\u524D\u8FD8\u6CA1\u6709\u53EF\u5C55\u793A\u7684 Avatar Runtime \u72B6\u6001\u3002';
const TEXT_STATUS_LOGS = '\u8FD0\u884C\u65E5\u5FD7';
const TEXT_STATUS_LOGS_DESC = '\u5305\u542B\u524D\u7AEF\u64CD\u4F5C\u3001IPC \u8BF7\u6C42\u3001\u540E\u7AEF\u5904\u7406\u548C\u8BED\u97F3\u5B89\u88C5\u8FDB\u5EA6\uFF0C\u65B9\u4FBF\u4F60\u67E5\u770B\u95EE\u9898\u5361\u5728\u54EA\u4E00\u6B65\u3002';
const TEXT_LOGS_EMPTY = '\u6682\u65E0\u65E5\u5FD7\u3002';
const TEXT_LAST_EVENT = '\u6700\u8FD1\u4E8B\u4EF6';
const TEXT_LAST_UPDATE = '\u6700\u8FD1\u66F4\u65B0\u65F6\u95F4';
const TEXT_BOUNDS_SOURCE = '\u8FB9\u754C\u6765\u6E90';
const TEXT_LAST_READY = '\u6700\u8FD1 ready';
const TEXT_CURRENT_MOTION = '\u5F53\u524D\u52A8\u4F5C';
const TEXT_CURRENT_EXPRESSION = '\u5F53\u524D\u8868\u60C5';
const TEXT_PERF_SUMMARY = '\u6027\u80FD\u6458\u8981';
const TEXT_LAST_ERROR = '\u6700\u8FD1\u9519\u8BEF';
const TEXT_FPS_NONE = 'FPS \u6682\u65E0';
const TEXT_FRAME_INTERVAL_NONE = '\u5E27\u95F4\u9694\u6682\u65E0';
const FULLWIDTH_COLON = '\uFF1A';

type BrowserSearchDetectionResult = {
  ok?: boolean;
  browserLabel?: string;
  resolvedPath?: string;
  candidates?: Array<{
    browserLabel?: string;
    exists?: boolean;
    path?: string;
    source?: string;
  }>;
  scannedRootCount?: number;
  detectedCount?: number;
  error?: string;
};

type BrowserSearchResult = {
  ok?: boolean;
  browserLabel?: string;
  error?: string;
  text?: string;
};

type AppRuntimeInfo = {
  appVersion?: string;
  buildId?: string;
  builtAt?: string | null;
  sessionMs?: number;
  totalMs?: number;
} | null;

function getWebSearchProviderLabel(provider: PetConfig['settings']['webSearchProvider']) {
  switch (provider) {
    case 'browser':
      return '本机浏览器';
    case 'gemini':
      return 'Gemini 内置搜索';
    case 'tavily':
      return 'Tavily API';
    case 'serper':
      return 'Serper API';
    case 'brave':
      return 'Brave API';
    case 'custom':
      return '自定义接口';
    default:
      return '未设置';
  }
}

function formatRuntimeTimestamp(timestamp: number | null) {
  if (!timestamp) {
    return TEXT_NONE;
  }

  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatPerfStatsText(
  perfStats: { fps?: number | null; frameIntervalMs?: number | null } | null | undefined,
) {
  if (!perfStats) {
    return TEXT_NONE;
  }

  const fpsText = perfStats.fps ? `${perfStats.fps} FPS` : TEXT_FPS_NONE;
  const frameText = perfStats.frameIntervalMs ? `${perfStats.frameIntervalMs} ms` : TEXT_FRAME_INTERVAL_NONE;
  return `${fpsText} / ${frameText}`;
}

function withLabel(label: string, value: string) {
  return `${label}${FULLWIDTH_COLON}${value}`;
}

function ChatDisplaySettingsSection({
  localConfig,
  onApplyConfig,
  onUpdateConfig,
}: {
  localConfig: PetConfig;
  onApplyConfig: (config: PetConfig) => void;
  onUpdateConfig?: PetConfigUpdateHandler;
}) {
  const applySettings = (updates: Partial<PetConfig['settings']>) => {
    const nextConfig = {
      ...localConfig,
      settings: { ...localConfig.settings, ...updates },
    };
    onApplyConfig(nextConfig);
    // The chat window is a separate renderer. Publish the draft immediately
    // without persisting it; closing without saving still restores the base.
    onUpdateConfig?.(nextConfig, { persist: false });
  };

  return (
    <div className="rounded-sm border border-border bg-secondary/20 p-4">
      <div className="mb-4 space-y-1">
        <div className="text-2xs font-bold uppercase tracking-widest text-primary">聊天显示</div>
        <div className="text-2xs leading-5 text-muted-foreground">调整聊天文字的颜色、大小、粗细和气泡背景透明度。</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid grid-cols-[auto_1fr] items-center gap-3 sm:col-span-3">
          <Input
            type="color"
            value={localConfig.settings.chatBracketOuterTextColor}
            onChange={(event) => applySettings({ chatBracketOuterTextColor: event.target.value })}
            className="h-10 w-14 cursor-pointer rounded-sm border-border bg-background p-1"
          />
          <div className="space-y-2">
            <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">括号外文字颜色</div>
            <Input
              value={localConfig.settings.chatBracketOuterTextColor}
              onChange={(event) => applySettings({ chatBracketOuterTextColor: event.target.value })}
              className="h-9 rounded-sm border-border bg-secondary text-xs focus-visible:ring-primary"
              placeholder="#0f766e"
            />
          </div>
        </div>
        <label className="grid gap-1.5 text-2xs font-semibold text-muted-foreground">
          <span className="flex items-center justify-between gap-2"><span>字体大小</span><output className="font-mono text-primary">{localConfig.settings.chatFontSize}px</output></span>
          <Slider
            aria-label="聊天字体大小"
             min={CHAT_FONT_SIZE_MIN}
             max={CHAT_FONT_SIZE_MAX}
            step={1}
            value={[localConfig.settings.chatFontSize]}
            onValueChange={(value) => {
              const next = value[0];
              if (next !== undefined) applySettings({ chatFontSize: next });
            }}
          />
        </label>
        <label className="grid gap-1.5 text-2xs font-semibold text-muted-foreground">
          <span className="flex items-center justify-between gap-2"><span>字体粗细</span><output className="font-mono text-primary">{localConfig.settings.chatFontWeight}</output></span>
          <Slider
            aria-label="聊天字体粗细"
             min={CHAT_FONT_WEIGHT_MIN}
             max={CHAT_FONT_WEIGHT_MAX}
            step={1}
            value={[localConfig.settings.chatFontWeight]}
            onValueChange={(value) => {
              const next = value[0];
              if (next !== undefined) applySettings({ chatFontWeight: next });
            }}
          />
        </label>
        <div className="flex items-center rounded-sm border border-dashed border-border bg-background/30 px-3 py-2 text-2xs text-muted-foreground">
          当前预览：{localConfig.settings.chatFontSize}px / {localConfig.settings.chatFontWeight}
        </div>
        <ChatBubbleTransparencyControl value={localConfig.settings.chatBubbleTransparency}
          onChange={(value) => applySettings({ chatBubbleTransparency: value })} />
        <div className="space-y-2 sm:col-span-3">
          <SettingsToggleSwitch label="显示桌宠头顶聊天气泡" checked={localConfig.settings.chatBubbleEnabled !== false}
            onChange={(enabled) => applySettings({ chatBubbleEnabled: enabled })} />
          <p className="text-2xs text-muted-foreground">关闭后只隐藏桌宠头顶气泡，不影响聊天窗口里的消息。</p>
        </div>
        <div className="space-y-2 sm:col-span-3">
          <SettingsToggleSwitch label="流式输出" checked={localConfig.settings.chatStreamingEnabled !== false}
            onChange={(enabled) => applySettings({ chatStreamingEnabled: enabled })} />
          <p className="text-2xs text-muted-foreground">统一用于私聊、群聊和故事正文。开启后逐步显示，关闭后整段显示；从下一次回复生效，点击保存后保留。</p>
        </div>
      </div>
    </div>
  );
}

export function SettingsSystemTab({
  localConfig,
  logs,
  onApplyConfig,
  realWorldTimeSnapshot,
  timeAwarenessEnabled,
  onlyWebSearch = false,
  onlyChatDisplay = false,
  onUpdateConfig,
}: SettingsSystemTabProps) {
  const [browserSearchFeedback, setBrowserSearchFeedback] = useState('');
  const [browserSearchBusy, setBrowserSearchBusy] = useState(false);
  const [browserPathCandidates, setBrowserPathCandidates] = useState<Array<{ label: string; path: string }>>([]);
  const [appRuntimeInfo, setAppRuntimeInfo] = useState<AppRuntimeInfo>(null);
  const [resetFeedback, setResetFeedback] = useState('');
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    void window.desktopPetShell?.getAppRuntimeInfo?.()
      .then((info) => setAppRuntimeInfo(info ?? null))
      .catch(() => setAppRuntimeInfo(null));
  }, []);
  const applySettings = (updates: Partial<PetConfig['settings']>) => {
    onApplyConfig({
      ...localConfig,
      settings: {
        ...localConfig.settings,
        ...updates,
      },
    });
  };
  const browserSearchSettings = {
    browserSearchBrowserPath: localConfig.settings.browserSearchBrowserPath,
    browserSearchDebugPort: localConfig.settings.browserSearchDebugPort,
    browserSearchEngine: localConfig.settings.browserSearchEngine,
    browserSearchUrlTemplate: localConfig.settings.browserSearchUrlTemplate,
  };

  const detectBrowserSearch = async () => {
    setBrowserSearchBusy(true);
    setBrowserSearchFeedback('正在检测本机 Edge / Chrome...');

    try {
      const result = await desktopPetShellRuntime.detectBrowserSearch({
        settings: browserSearchSettings,
      }) as BrowserSearchDetectionResult;

      if (result.ok && result.resolvedPath) {
        applySettings({ browserSearchBrowserPath: result.resolvedPath });
        setBrowserPathCandidates(
          (result.candidates ?? [])
            .filter((candidate) => candidate.exists && candidate.path)
            .map((candidate) => ({
              label: `${candidate.browserLabel || 'Browser'} · ${candidate.source || ''}`,
              path: candidate.path || '',
            }))
            .filter((candidate) => candidate.path),
        );
        setBrowserSearchFeedback(`已找到 ${result.browserLabel || '浏览器'}：${result.resolvedPath}`);
        return;
      }

      setBrowserSearchFeedback(result.error || '没有自动找到 Edge / Chrome，请手动填写浏览器 exe 路径。');
    } catch (error) {
      setBrowserSearchFeedback(error instanceof Error ? error.message : '检测浏览器失败。');
    } finally {
      setBrowserSearchBusy(false);
    }
  };

  const testBrowserSearch = async () => {
    setBrowserSearchBusy(true);
    setBrowserSearchFeedback('正在启动浏览器并测试读取搜索页...');

    try {
      const result = await desktopPetShellRuntime.browserSearch({
        query: 'AI Desktop Pet browser search test',
        settings: browserSearchSettings,
      }) as BrowserSearchResult;

      if (result.ok) {
        setBrowserSearchFeedback(`测试成功：已通过 ${result.browserLabel || '浏览器'} 读取到 ${result.text?.length ?? 0} 字符。`);
        return;
      }

      setBrowserSearchFeedback(result.error || '测试失败：浏览器没有返回可用文本。');
    } catch (error) {
      setBrowserSearchFeedback(error instanceof Error ? error.message : '测试浏览器查询失败。');
    } finally {
      setBrowserSearchBusy(false);
    }
  };

  const resetUserDataAndRelaunch = async () => {
    const firstConfirmation = window.confirm(
      '将清除本机桌宠的所有设置、角色、聊天记录、导入素材和缓存，并立即重启。确定继续吗？',
    );
    if (!firstConfirmation) return;

    const secondConfirmation = window.confirm(
      '此操作不可恢复。请再次确认：清除全部本机桌宠数据并重启。',
    );
    if (!secondConfirmation) return;

    setResetBusy(true);
    setResetFeedback('正在清除本机数据并重启…');
    try {
      const result = await window.desktopPetShell?.resetUserDataAndRelaunch?.();
      if (!result?.ok) {
        setResetFeedback(result?.error || '清除失败，未执行重启。');
        setResetBusy(false);
      }
    } catch (error) {
      setResetFeedback(error instanceof Error ? error.message : '清除失败，未执行重启。');
      setResetBusy(false);
    }
  };

  return (
    <div className="m-0 space-y-6">
      {onlyChatDisplay ? <ChatDisplaySettingsSection localConfig={localConfig} onApplyConfig={onApplyConfig} onUpdateConfig={onUpdateConfig} /> : null}
      {!onlyWebSearch && !onlyChatDisplay ? (
        <>
      <div className="rounded-sm border border-border bg-secondary/20 p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-2xs font-bold uppercase tracking-widest text-primary">{TEXT_SYSTEM_TITLE}</div>
            <div className="text-2xs leading-5 text-muted-foreground">{TEXT_SYSTEM_DESC}</div>
          </div>
          <button
            type="button"
            onClick={() => onApplyConfig({
              ...localConfig,
              settings: {
                ...localConfig.settings,
                timeAwarenessEnabled: !timeAwarenessEnabled,
              },
            })}
            className={`${toggleButtonClass(timeAwarenessEnabled)} shrink-0 tracking-widest`}
          >
            {timeAwarenessEnabled ? TEXT_ENABLED : TEXT_DISABLED}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-sm border border-border bg-background/40 p-3">
            <div className="text-3xs tracking-widest text-muted-foreground">{TEXT_DATE}</div>
            <div className="mt-1 text-xs font-medium text-foreground">{realWorldTimeSnapshot.dateText}</div>
          </div>
          <div className="rounded-sm border border-border bg-background/40 p-3">
            <div className="text-3xs tracking-widest text-muted-foreground">{TEXT_TIME}</div>
            <div className="mt-1 font-mono text-xs font-medium text-foreground">{realWorldTimeSnapshot.timeText}</div>
          </div>
          <div className="rounded-sm border border-border bg-background/40 p-3">
            <div className="text-3xs tracking-widest text-muted-foreground">{TEXT_TIMEZONE}</div>
            <div className="mt-1 text-xs font-medium text-foreground">{realWorldTimeSnapshot.timezone}</div>
          </div>
          <div className="rounded-sm border border-border bg-background/40 p-3">
            <div className="text-3xs tracking-widest text-muted-foreground">{TEXT_DAY_PERIOD}</div>
            <div className="mt-1 text-xs font-medium text-foreground">{realWorldTimeSnapshot.dayPeriod}</div>
          </div>
        </div>

        <div className="mt-4 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2 text-2xs leading-5 text-muted-foreground">
          {timeAwarenessEnabled ? TEXT_TIME_ENABLED_NOTE : TEXT_TIME_DISABLED_NOTE}
        </div>
      </div>
      <div className="rounded-sm border border-border bg-secondary/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-2xs font-bold uppercase tracking-widest text-primary">当前构建</div>
            <div className="font-mono text-xs text-foreground">
              {appRuntimeInfo?.buildId || '构建号读取中…'}
            </div>
            <div className="text-2xs text-muted-foreground">
              版本 {appRuntimeInfo?.appVersion || '未知'}
              {appRuntimeInfo?.builtAt ? ` · ${new Date(appRuntimeInfo.builtAt).toLocaleString('zh-CN')}` : ''}
            </div>
          </div>
          <button
            type="button"
            disabled={resetBusy}
            onClick={() => void resetUserDataAndRelaunch()}
            className="h-9 rounded-sm border border-destructive/60 bg-destructive/10 px-3 text-2xs font-bold text-destructive transition-colors hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resetBusy ? '正在重置…' : '清除本机数据并重启'}
          </button>
        </div>
        <div className="mt-3 rounded-sm border border-dashed border-destructive/35 bg-background/30 px-3 py-2 text-2xs leading-5 text-muted-foreground">
          仅清除本应用的数据：设置、聊天、角色、导入素材、缓存和本地服务状态。不会删除其他软件文件。
        </div>
        {resetFeedback ? <div className="mt-2 text-2xs text-muted-foreground">{resetFeedback}</div> : null}
      </div>
        </>
      ) : null}

      {!onlyChatDisplay ? <div className="rounded-sm border border-border bg-secondary/20 p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-2xs font-bold uppercase tracking-widest text-primary">联网查询</div>
            <div className="text-2xs leading-5 text-muted-foreground">
              系统级联网能力。开启后，桌宠会按所选方式查询外部信息；选择本机浏览器时，会启动专用 Chrome/Edge 调试实例并读取搜索页文本。
            </div>
          </div>
          <button
            type="button"
            onClick={() => applySettings({
              webSearchEnabled: !localConfig.settings.webSearchEnabled,
            })}
            className={`${toggleButtonClass(localConfig.settings.webSearchEnabled)} shrink-0 tracking-widest`}
          >
            {localConfig.settings.webSearchEnabled ? TEXT_ENABLED : TEXT_DISABLED}
          </button>
        </div>

        <div className="rounded-sm border border-border bg-background/40 px-3 py-2 text-2xs text-muted-foreground">
          当前方式：{getWebSearchProviderLabel(localConfig.settings.webSearchProvider)}
        </div>

        <div className="mt-4 space-y-3">
          <select
            value={localConfig.settings.webSearchProvider}
            onChange={(event) => applySettings({
              webSearchProvider: event.target.value as PetConfig['settings']['webSearchProvider'],
            })}
            className={selectClassName()}
          >
            <option value="browser">本机 Chrome / Edge 浏览器</option>
            <option value="gemini">Gemini 内置 Google Search</option>
            <option value="tavily">Tavily Search API</option>
            <option value="serper">Serper Google Search API</option>
            <option value="brave">Brave Search API</option>
            <option value="custom">自定义搜索接口</option>
          </select>

          {localConfig.settings.webSearchProvider === 'browser' ? (
            <div className="space-y-3">
              <Input
                className={inputClassName()}
                value={localConfig.settings.browserSearchBrowserPath}
                onChange={(event) => applySettings({ browserSearchBrowserPath: event.target.value })}
                placeholder="浏览器 exe 路径，可留空自动查找 Edge / Chrome"
              />
              {browserPathCandidates.length ? (
                <select
                  className={selectClassName()}
                  value={localConfig.settings.browserSearchBrowserPath}
                  onChange={(event) => applySettings({ browserSearchBrowserPath: event.target.value })}
                >
                  <option value="">从检测到的浏览器里选择</option>
                  {browserPathCandidates.map((candidate) => (
                    <option key={candidate.path} value={candidate.path}>
                      {candidate.label}
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={toggleButtonClass(!browserSearchBusy)}
                  disabled={browserSearchBusy}
                  onClick={() => void detectBrowserSearch()}
                >
                  自动检测浏览器
                </button>
                <button
                  type="button"
                  className={toggleButtonClass(!browserSearchBusy)}
                  disabled={browserSearchBusy}
                  onClick={() => void testBrowserSearch()}
                >
                  测试浏览器查询
                </button>
              </div>
              <div className="grid grid-cols-[1fr_92px] gap-2">
                <select
                  className={selectClassName()}
                  value={localConfig.settings.browserSearchEngine}
                  onChange={(event) => applySettings({
                    browserSearchEngine: event.target.value as PetConfig['settings']['browserSearchEngine'],
                  })}
                >
                  <option value="auto">跟随电脑地区自动选择</option>
                  <option value="baidu">百度搜索</option>
                  <option value="google">Google Search</option>
                  <option value="bing">Bing 搜索</option>
                  <option value="sogou">搜狗搜索</option>
                  <option value="custom">高级自定义 URL</option>
                </select>
                <Input
                  className={inputClassName()}
                  type="number"
                  min={1024}
                  max={65535}
                  value={localConfig.settings.browserSearchDebugPort}
                  onChange={(event) => applySettings({ browserSearchDebugPort: Number.parseInt(event.target.value, 10) })}
                  placeholder="端口"
                />
              </div>
              <div className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2 text-2xs leading-5 text-muted-foreground">
                当前搜索引擎会直接在面板里生效：自动模式下中文电脑优先百度，其他地区按浏览器类型使用 Google / Bing；也可以固定选择百度、Google、Bing 或搜狗。
              </div>
              {localConfig.settings.browserSearchEngine === 'custom' ? (
              <div className="grid grid-cols-[1fr_92px] gap-2">
                <Input
                  className={inputClassName()}
                  value={localConfig.settings.browserSearchUrlTemplate}
                  onChange={(event) => applySettings({ browserSearchUrlTemplate: event.target.value })}
                  placeholder="留空按浏览器默认：Chrome 用 Google，Edge 用 Bing"
                />
                <Input
                  className={inputClassName()}
                  type="number"
                  min={1024}
                  max={65535}
                  value={localConfig.settings.browserSearchDebugPort}
                  onChange={(event) => applySettings({ browserSearchDebugPort: Number.parseInt(event.target.value, 10) })}
                  placeholder="端口"
                />
              </div>
              ) : null}
              <div className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2 text-2xs leading-5 text-muted-foreground">
                浏览器会用独立用户数据目录启动，不读取你日常浏览器里的已有标签页。查询时桌宠头顶会显示正在调用的浏览器和关键词。
              </div>
              <div className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2 text-2xs leading-5 text-muted-foreground">
                已检测到 {browserPathCandidates.length} 个可选浏览器路径。
              </div>
              {browserSearchFeedback ? (
                <div className="rounded-sm border border-border bg-background/40 px-3 py-2 text-2xs leading-5 text-muted-foreground">
                  {browserSearchFeedback}
                </div>
              ) : null}
            </div>
          ) : null}

          {localConfig.settings.webSearchProvider === 'tavily' ? (
            <Input
              type="password"
              className={inputClassName()}
              value={localConfig.settings.tavilyApiKey}
              onChange={(event) => applySettings({ tavilyApiKey: event.target.value })}
              placeholder="Tavily API Key"
            />
          ) : null}
          {localConfig.settings.webSearchProvider === 'serper' ? (
            <Input
              type="password"
              className={inputClassName()}
              value={localConfig.settings.serperApiKey}
              onChange={(event) => applySettings({ serperApiKey: event.target.value })}
              placeholder="Serper API Key"
            />
          ) : null}
          {localConfig.settings.webSearchProvider === 'brave' ? (
            <Input
              type="password"
              className={inputClassName()}
              value={localConfig.settings.braveSearchApiKey}
              onChange={(event) => applySettings({ braveSearchApiKey: event.target.value })}
              placeholder="Brave Search API Key"
            />
          ) : null}
          {localConfig.settings.webSearchProvider === 'custom' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={localConfig.settings.customWebSearchMethod}
                  onChange={(event) => applySettings({ customWebSearchMethod: event.target.value as 'get' | 'post' })}
                  className={selectClassName()}
                >
                  <option value="get">GET ?q=...</option>
                  <option value="post">POST JSON</option>
                </select>
                <Input
                  className={inputClassName()}
                  value={localConfig.settings.customWebSearchQueryParam}
                  onChange={(event) => applySettings({ customWebSearchQueryParam: event.target.value })}
                  placeholder="query param, e.g. q"
                />
              </div>
              <Input
                className={inputClassName()}
                value={localConfig.settings.customWebSearchUrl}
                onChange={(event) => applySettings({ customWebSearchUrl: event.target.value })}
                placeholder="Search endpoint URL"
              />
              <Input
                type="password"
                className={inputClassName()}
                value={localConfig.settings.customWebSearchApiKey}
                onChange={(event) => applySettings({ customWebSearchApiKey: event.target.value })}
                placeholder="Search API Key (optional)"
              />
            </div>
          ) : null}
        </div>
      </div> : null}

      {!onlyWebSearch && !onlyChatDisplay ? (
        <>
      <SettingsMcpSection />

      <div className="rounded-sm border border-border bg-secondary/20 p-4">
        <div className="mb-3 text-2xs font-bold uppercase tracking-widest text-primary">{TEXT_STATUS_LOGS}</div>
        <div className="mb-3 text-2xs text-muted-foreground">{TEXT_STATUS_LOGS_DESC}</div>
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1 text-2xs">
          {logs.length ? logs.map((log, index) => (
            <div key={`${log}-${index}`} className="whitespace-pre-wrap rounded-sm border-l border-primary/30 bg-background/40 px-2 py-1 font-mono text-muted-foreground">
              {log}
            </div>
          )) : (
            <div className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-4 text-center text-2xs text-muted-foreground">
              {TEXT_LOGS_EMPTY}
            </div>
          )}
        </div>
      </div>
        </>
      ) : null}
    </div>
  );
}
