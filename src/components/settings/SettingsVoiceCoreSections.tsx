import { type CSSProperties } from 'react';
import { type BrowserTtsHealth, type BrowserTtsInstallProgress, type BrowserTtsInstallResult, type LocalVoiceAssets, type LocalVoiceHealth, type LocalVoiceInstallProgress, type LocalVoiceInstallResult, type PetConfig } from '../../types';
import { DEFAULT_BROWSER_TTS_VOICE } from '../../constants';
import {
  clampSpeechPlaybackRate,
  formatSpeechPlaybackRate,
  MAX_SPEECH_PLAYBACK_RATE,
  MIN_SPEECH_PLAYBACK_RATE,
} from '../../voice/speechPlaybackRate';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Slider } from '../../../components/ui/slider';
import {
  getDeviceLabel,
  getBrowserTtsInstallFeedbackClass,
  getBrowserTtsStatusClass,
  getBrowserTtsStatusLabel,
  getInstallFeedbackClass,
  getLocalVoiceStatusClass,
  getLocalVoiceStatusLabel,
  getRuntimeTypeHint,
  getRuntimeTypeLabel,
  inputClassName,
  selectClassName,
  toggleButtonClass,
} from './settingsVoiceUtils';

type SettingsUpdater = (updates: Partial<PetConfig['settings']>) => void;

const EDGE_TTS_VOICE_OPTIONS = [
  { value: 'xiaoxiao', label: 'xiaoxiao - 中文女声，常用' },
  { value: 'xiaoyi', label: 'xiaoyi - 中文女声' },
  { value: 'yunjian', label: 'yunjian - 中文男声' },
  { value: 'yunxi', label: 'yunxi - 中文男声' },
  { value: 'yunxia', label: 'yunxia - 中文男孩声' },
  { value: 'yunyang', label: 'yunyang - 中文男声' },
  { value: 'jenny', label: 'jenny - 英文女声' },
  { value: 'aria', label: 'aria - 英文女声' },
  { value: 'guy', label: 'guy - 英文男声' },
  { value: 'nanami', label: 'nanami - 日文女声' },
  { value: 'keita', label: 'keita - 日文男声' },
] as const;

export function SettingsVoiceGeneralSection({
  noDragRegionStyle,
  settings,
  applySettings,
}: {
  noDragRegionStyle?: CSSProperties;
  settings: PetConfig['settings'];
  applySettings: SettingsUpdater;
}) {
  const speechPlaybackRate = clampSpeechPlaybackRate(settings.speechPlaybackRate);

  return (
    <div className="rounded-sm border border-border bg-secondary/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="text-2xs font-bold uppercase tracking-widest text-primary">语音开关</div>
          <div className="text-2xs text-muted-foreground">
            语音播报和语音输入分开控制，关闭播报后仍可继续打字聊天。
          </div>
        </div>
        <button
          type="button"
          onClick={() => applySettings({ voiceEnabled: !settings.voiceEnabled })}
          className={toggleButtonClass(settings.voiceEnabled)}
        >
          {settings.voiceEnabled ? '播报已开启' : '播报已关闭'}
        </button>
      </div>

      <div className={settings.ttsProvider === 'browser' ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-2 gap-3'}>
        <button
          type="button"
          onClick={() => applySettings({ voiceInputEnabled: !settings.voiceInputEnabled })}
          className={toggleButtonClass(settings.voiceInputEnabled)}
        >
          语音输入
        </button>
        <button
          type="button"
          onClick={() => applySettings({ autoSpeakResponses: !settings.autoSpeakResponses })}
          className={toggleButtonClass(settings.autoSpeakResponses)}
        >
          自动播报
        </button>
      </div>

      <button
        type="button"
        onClick={() => applySettings({ speechSkipBracketContent: !settings.speechSkipBracketContent })}
        className={toggleButtonClass(settings.speechSkipBracketContent)}
      >
        {settings.speechSkipBracketContent ? '朗读忽略括号内容' : '朗读保留括号内容'}
      </button>
      <div className="text-2xs text-muted-foreground">
        开启后，像“（动作）”“（旁白）”这类括号内文字只显示，不会被语音读出来。
      </div>

      <button
        type="button"
        onClick={() => applySettings({ speechExpressivePunctuationEnabled: !settings.speechExpressivePunctuationEnabled })}
        className={toggleButtonClass(settings.speechExpressivePunctuationEnabled)}
      >
        {settings.speechExpressivePunctuationEnabled ? '语气符号增强已开启' : '语气符号增强已关闭'}
      </button>
      <div className="text-2xs text-muted-foreground">
        开启后会在播报前把角色文本里的拖音、停顿和强调类符号转换成更适合 TTS 朗读的文本。
      </div>

      <div className="mt-3 rounded-sm border border-border bg-background/30 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">播报语速</div>
            <div className="text-2xs text-muted-foreground">控制语音播放快慢，对 Edge-TTS、API 语音和本地语音都生效。</div>
          </div>
          <div className="font-mono text-2xs text-primary">{formatSpeechPlaybackRate(speechPlaybackRate)}</div>
        </div>
        <div className="space-y-2" style={noDragRegionStyle}>
          <Slider
            value={[speechPlaybackRate]}
            min={MIN_SPEECH_PLAYBACK_RATE}
            max={MAX_SPEECH_PLAYBACK_RATE}
            step={0.05}
            markers={[MIN_SPEECH_PLAYBACK_RATE, 1, MAX_SPEECH_PLAYBACK_RATE]}
            onValueChange={(value) => applySettings({ speechPlaybackRate: clampSpeechPlaybackRate(value[0]) })}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-3xs text-muted-foreground">
          <span>{formatSpeechPlaybackRate(MIN_SPEECH_PLAYBACK_RATE)}</span>
          <span>正常 {formatSpeechPlaybackRate(1)}</span>
          <span>{formatSpeechPlaybackRate(MAX_SPEECH_PLAYBACK_RATE)}</span>
        </div>
      </div>
    </div>
  );
}

export function SettingsVoiceSourcesSection({
  settings,
  noDragRegionStyle,
  voiceNamePlaceholder,
  applySettings,
}: {
  settings: PetConfig['settings'];
  noDragRegionStyle?: CSSProperties;
  voiceNamePlaceholder: string;
  applySettings: SettingsUpdater;
}) {
  return (
    <div className="space-y-4 rounded-sm border border-border bg-secondary/20 p-4">
      <div className="text-2xs font-bold uppercase tracking-widest text-primary">输入与播报来源</div>

      <div className="space-y-2">
        <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">播报来源</Label>
        <select
          value={settings.ttsProvider}
          onChange={(event) => applySettings({ ttsProvider: event.target.value as 'browser' | 'api' | 'local' })}
          className={selectClassName()}
          style={noDragRegionStyle}
        >
          <option value="browser">Edge-TTS 本地</option>
          <option value="api">API 语音</option>
          <option value="local">本地语音模型</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">识别来源</Label>
        <select
          value={settings.sttProvider}
          onChange={(event) => applySettings({ sttProvider: event.target.value as 'browser' | 'api' | 'local' })}
          className={selectClassName()}
          style={noDragRegionStyle}
        >
          <option value="browser">浏览器识别</option>
          <option value="api">API 识别</option>
          <option value="local">本地识别模型</option>
        </select>
      </div>

      <div className={settings.ttsProvider === 'browser' ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-2 gap-3'}>
        <Input
          className={inputClassName()}
          style={noDragRegionStyle}
          value={settings.speechRecognitionLang}
          onChange={(event) => applySettings({ speechRecognitionLang: event.target.value })}
          placeholder="识别语言，例如 zh-CN"
        />
        {settings.ttsProvider !== 'browser' && (
          <Input
            className={inputClassName()}
            style={noDragRegionStyle}
            value={settings.voiceName}
            onChange={(event) => applySettings({ voiceName: event.target.value })}
            placeholder={voiceNamePlaceholder}
          />
        )}
      </div>

      {settings.ttsProvider === 'api' && (
        <div className="text-2xs text-muted-foreground">
          API 播报会使用上面的音色名称。OpenAI 常见音色可填 alloy，Gemini 常见音色可填 Kore。
        </div>
      )}
    </div>
  );
}

export function SettingsVoiceBrowserTtsSection({
  browserTtsHealth,
  browserTtsHealthLoading,
  browserTtsInstallProgress,
  browserTtsInstallFeedback,
  browserTtsInstallRunning,
  noDragRegionStyle,
  settings,
  onInstallBrowserTtsDependencies,
  onRefreshBrowserTtsHealth,
  onStartBrowserTtsService,
  applySettings,
}: {
  browserTtsHealth: BrowserTtsHealth;
  browserTtsHealthLoading: boolean;
  browserTtsInstallProgress: BrowserTtsInstallProgress | null;
  browserTtsInstallFeedback: BrowserTtsInstallResult | null;
  browserTtsInstallRunning: boolean;
  noDragRegionStyle?: CSSProperties;
  settings: PetConfig['settings'];
  onInstallBrowserTtsDependencies: () => void;
  onRefreshBrowserTtsHealth: () => void;
  onStartBrowserTtsService: () => void;
  applySettings: SettingsUpdater;
}) {
  if (settings.ttsProvider !== 'browser') {
    return null;
  }

  const installMessages = browserTtsInstallRunning
    ? (browserTtsInstallProgress?.messages ?? [])
    : (browserTtsInstallFeedback?.messages ?? []);
  const installCurrentStep = browserTtsInstallRunning
    ? (browserTtsInstallProgress?.currentStep ?? null)
    : (installMessages.length > 0 ? installMessages[installMessages.length - 1] : null);
  const installExecutable = browserTtsInstallRunning
    ? (browserTtsInstallProgress?.executable ?? browserTtsInstallFeedback?.executable ?? null)
    : (browserTtsInstallFeedback?.executable ?? browserTtsInstallProgress?.executable ?? null);
  const installError = browserTtsInstallRunning
    ? (browserTtsInstallProgress?.error ?? browserTtsInstallFeedback?.error ?? null)
    : (browserTtsInstallFeedback?.error ?? browserTtsInstallProgress?.error ?? null);
  const installMissingPackages = browserTtsInstallRunning
    ? (browserTtsInstallProgress?.missingPackages ?? browserTtsInstallFeedback?.missingPackages ?? [])
    : (browserTtsInstallFeedback?.missingPackages ?? browserTtsInstallProgress?.missingPackages ?? []);
  const selectedEdgeTtsVoice = settings.voiceName.trim() || DEFAULT_BROWSER_TTS_VOICE;
  const hasCustomEdgeTtsVoice = !EDGE_TTS_VOICE_OPTIONS.some((option) => option.value === selectedEdgeTtsVoice);

  return (
    <div className="space-y-4 rounded-sm border border-border bg-secondary/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="text-2xs font-bold uppercase tracking-widest text-primary">Edge-TTS 本地配置</div>
          <div className="text-2xs text-muted-foreground">
            当前播报使用本地 Edge-TTS HTTP 服务，音色可从下拉列表选择。
          </div>
        </div>
        <div className={'rounded-sm border px-2 py-1 text-2xs ' + getBrowserTtsStatusClass(browserTtsHealth)}>
          {getBrowserTtsStatusLabel(browserTtsHealth)}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">服务地址</Label>
        <Input
          className={inputClassName()}
          style={noDragRegionStyle}
          value={settings.browserTtsApiUrl}
          onChange={(event) => applySettings({ browserTtsApiUrl: event.target.value })}
          placeholder="http://127.0.0.1:9880"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">API Key</Label>
        <Input
          type="password"
          className={inputClassName()}
          style={noDragRegionStyle}
          value={settings.browserTtsApiKey}
          onChange={(event) => applySettings({ browserTtsApiKey: event.target.value })}
          placeholder="留空则不发送认证头"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">音色</Label>
          <select
            value={selectedEdgeTtsVoice}
            onChange={(event) => applySettings({ voiceName: event.target.value })}
            className={selectClassName()}
            style={noDragRegionStyle}
          >
            {hasCustomEdgeTtsVoice && (
              <option value={selectedEdgeTtsVoice}>自定义：{selectedEdgeTtsVoice}</option>
            )}
            {EDGE_TTS_VOICE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">语言</Label>
          <select
            value={settings.browserTtsLanguage}
            onChange={(event) => applySettings({ browserTtsLanguage: event.target.value })}
            className={selectClassName()}
            style={noDragRegionStyle}
          >
            <option value="Auto">Auto（自动识别）</option>
            <option value="zh-CN">zh-CN</option>
            <option value="en-US">en-US</option>
            <option value="ja-JP">ja-JP</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={onRefreshBrowserTtsHealth}
          disabled={browserTtsHealthLoading || browserTtsInstallRunning}
          className="h-8 rounded-sm bg-primary px-3 text-2xs text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {browserTtsHealthLoading ? '检测中...' : '检测服务'}
        </Button>
        <Button
          type="button"
          onClick={onStartBrowserTtsService}
          disabled={browserTtsHealthLoading || browserTtsInstallRunning || browserTtsHealth.status === 'ready'}
          className="h-8 rounded-sm border border-primary/40 bg-primary/10 px-3 text-2xs text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {browserTtsHealthLoading ? '启动中...' : '启动服务'}
        </Button>
        <Button
          type="button"
          onClick={onInstallBrowserTtsDependencies}
          disabled={browserTtsInstallRunning}
          className="h-8 rounded-sm border border-primary/40 bg-primary/10 px-3 text-2xs text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {browserTtsInstallRunning ? '安装中...' : '安装 Edge-TTS 依赖'}
        </Button>
      </div>

      <div className="rounded-sm border border-border bg-background/30 p-3 text-2xs text-muted-foreground">
        <div>服务地址：{browserTtsHealth.url || settings.browserTtsApiUrl || 'http://127.0.0.1:9880'}</div>
        <div>运行环境：{browserTtsHealth.executable || '未检测到'}</div>
        {typeof browserTtsHealth.voicesCount === 'number' && browserTtsHealth.voicesCount > 0 && (
          <div>可用音色：{browserTtsHealth.voicesCount} 个</div>
        )}
        {browserTtsHealth.missingPackages.length > 0 && (
          <div>缺少依赖：{browserTtsHealth.missingPackages.join(', ')}</div>
        )}
        {browserTtsHealth.error && <div>状态说明：{browserTtsHealth.error}</div>}
        <div className="mt-2 border-t border-border/60 pt-2">
          这里的“音色”不是语音包文件路径。下载的模型包需要走“本地语音模型”，Edge-TTS 音色使用服务支持的 speaker 名称。
        </div>
      </div>

      {browserTtsInstallRunning && browserTtsInstallProgress && (
        <div className={'space-y-2 rounded-sm border p-3 text-2xs ' + getBrowserTtsInstallFeedbackClass(null, true)}>
          <div className="font-bold tracking-widest">正在安装 Edge-TTS 依赖...</div>
          {installCurrentStep && <div>当前步骤：{installCurrentStep}</div>}
          {installExecutable && <div>运行环境：{installExecutable}</div>}
          {installError && <div>{installError}</div>}
          {installMissingPackages.length > 0 && <div>仍缺少：{installMissingPackages.join(', ')}</div>}
          {installMessages.length > 0 && (
            <div className="space-y-1 border-t border-current/20 pt-2">
              {installMessages.slice(-8).map((message, index) => (
                <div key={'browser-tts-progress-' + index + '-' + message}>- {message}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {browserTtsInstallFeedback && (
        <div className={'space-y-2 rounded-sm border p-3 text-2xs ' + getBrowserTtsInstallFeedbackClass(browserTtsInstallFeedback)}>
          <div className="font-bold tracking-widest">
            {browserTtsInstallFeedback.ok ? 'Edge-TTS 依赖安装完成' : 'Edge-TTS 依赖安装失败'}
          </div>
          {browserTtsInstallFeedback.error && <div>{browserTtsInstallFeedback.error}</div>}
          {browserTtsInstallFeedback.executable && <div>运行环境：{browserTtsInstallFeedback.executable}</div>}
          {browserTtsInstallFeedback.missingPackages.length > 0 && (
            <div>仍缺少：{browserTtsInstallFeedback.missingPackages.join(', ')}</div>
          )}
          {browserTtsInstallFeedback.messages.length > 0 && (
            <div className="space-y-1 border-t border-current/20 pt-2">
              {browserTtsInstallFeedback.messages.slice(-8).map((message, index) => (
                <div key={'browser-tts-feedback-' + index + '-' + message}>- {message}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SettingsLocalVoiceEnvironmentSection({
  localVoiceAssets,
  localVoiceHealth,
  localVoiceHealthLoading,
  localVoiceInstallProgress,
  localVoiceInstallFeedback,
  localVoiceInstallRunning,
  noDragRegionStyle,
  settings,
  usingLocalVoice,
  installMessages,
  installCurrentStep,
  installExecutable,
  installError,
  installMissingPackages,
  onInstallLocalVoiceDependencies,
  onRefreshLocalVoiceHealth,
  applySettings,
}: {
  localVoiceAssets: LocalVoiceAssets;
  localVoiceHealth: LocalVoiceHealth;
  localVoiceHealthLoading: boolean;
  localVoiceInstallProgress: LocalVoiceInstallProgress | null;
  localVoiceInstallFeedback: LocalVoiceInstallResult | null;
  localVoiceInstallRunning: boolean;
  noDragRegionStyle?: CSSProperties;
  settings: PetConfig['settings'];
  usingLocalVoice: boolean;
  installMessages: string[];
  installCurrentStep: string | null;
  installExecutable: string | null;
  installError: string | null;
  installMissingPackages: string[];
  onInstallLocalVoiceDependencies: () => void;
  onRefreshLocalVoiceHealth: () => void;
  applySettings: SettingsUpdater;
}) {
  return (
    <div className="space-y-4 rounded-sm border border-border bg-secondary/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="text-2xs font-bold uppercase tracking-widest text-primary">本地语音环境</div>
          <div className="text-2xs text-muted-foreground">
            用于本地 TTS / STT 的运行环境、依赖和模型状态检查。
          </div>
        </div>
        <div className={'rounded-sm border px-2 py-1 text-2xs ' + getLocalVoiceStatusClass(localVoiceHealth)}>
          {getLocalVoiceStatusLabel(localVoiceHealth)}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={onRefreshLocalVoiceHealth}
          disabled={localVoiceHealthLoading || localVoiceInstallRunning}
          className="h-8 rounded-sm bg-primary px-3 text-2xs text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {localVoiceHealthLoading ? '检测中...' : '重新检测'}
        </Button>
        <Button
          type="button"
          onClick={onInstallLocalVoiceDependencies}
          disabled={localVoiceInstallRunning}
          className="h-8 rounded-sm border border-primary/40 bg-primary/10 px-3 text-2xs text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {localVoiceInstallRunning ? '安装中...' : '安装本地依赖'}
        </Button>
      </div>

      <div className="rounded-sm border border-border bg-background/30 p-3 text-2xs text-muted-foreground">
        <div>本地语音目录：{localVoiceAssets.rootPath || '未检测到 local-models/voice'}</div>
        <div>检测到 TTS {localVoiceAssets.ttsModels.length} 组 / STT {localVoiceAssets.sttModels.length} 组 / 参考音频 {localVoiceAssets.references.length} 组</div>
        <div>环境类型：{getRuntimeTypeLabel(localVoiceHealth.runtimeLabel)}</div>
        <div>运行环境：{localVoiceHealth.executable || '未找到'}</div>
        <div>Python 版本：{localVoiceHealth.pythonVersion || '未检测到'}</div>
        <div>推理设备：{getDeviceLabel(localVoiceHealth.device)}</div>
        {localVoiceHealth.missingPackages.length > 0 && (
          <div>缺少依赖：{localVoiceHealth.missingPackages.join(', ')}</div>
        )}
        <div className="mt-2 border-t border-border/60 pt-2">{getRuntimeTypeHint(localVoiceHealth.runtimeLabel)}</div>
        {localVoiceHealth.status === 'idle' && (
          <div className="pt-2">还没有执行检测，点击“重新检测”可查看本地语音状态。</div>
        )}
        {localVoiceHealth.messages.length > 0 && (
          <div className="mt-2 space-y-1 pt-2">
            {localVoiceHealth.messages.slice(0, 8).map((message) => (
              <div key={message}>- {message}</div>
            ))}
          </div>
        )}
      </div>

      {localVoiceInstallRunning && localVoiceInstallProgress && (
        <div className={'space-y-2 rounded-sm border p-3 text-2xs ' + getInstallFeedbackClass(null, true)}>
          <div className="font-bold tracking-widest">正在安装本地语音依赖...</div>
          {installCurrentStep && <div>当前步骤：{installCurrentStep}</div>}
          <div className="text-primary/80">
            首次安装 torch 和语音依赖时可能会停留几分钟，只要这里的步骤在刷新，通常就是正常运行。
          </div>
          {installExecutable && <div>运行环境：{installExecutable}</div>}
          {installError && <div>{installError}</div>}
          {installMissingPackages.length > 0 && <div>仍缺少：{installMissingPackages.join(', ')}</div>}
          {installMessages.length > 0 && (
            <div className="space-y-1 border-t border-current/20 pt-2">
              {installMessages.slice(-8).map((message, index) => (
                <div key={'progress-' + index + '-' + message}>- {message}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {localVoiceInstallFeedback && (
        <div className={'space-y-2 rounded-sm border p-3 text-2xs ' + getInstallFeedbackClass(localVoiceInstallFeedback)}>
          <div className="font-bold tracking-widest">
            {localVoiceInstallFeedback.ok ? '本地依赖安装完成' : '本地依赖安装失败'}
          </div>
          {localVoiceInstallFeedback.error && <div>{localVoiceInstallFeedback.error}</div>}
          {localVoiceInstallFeedback.executable && <div>运行环境：{localVoiceInstallFeedback.executable}</div>}
          {localVoiceInstallFeedback.missingPackages.length > 0 && (
            <div>仍缺少：{localVoiceInstallFeedback.missingPackages.join(', ')}</div>
          )}
          {localVoiceInstallFeedback.messages.length > 0 && (
            <div className="space-y-1 border-t border-current/20 pt-2">
              {localVoiceInstallFeedback.messages.slice(-8).map((message, index) => (
                <div key={String(index) + '-' + message}>- {message}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {usingLocalVoice && (
        <div className="space-y-3 rounded-sm border border-border bg-background/30 p-3">
          <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">本地运行设置</Label>
          <Input
            className={inputClassName()}
            style={noDragRegionStyle}
            value={settings.localVoiceRuntimePath}
            onChange={(event) => applySettings({ localVoiceRuntimePath: event.target.value })}
            placeholder="可选：手动填写 python.exe 路径，不填则自动检测"
          />
          <div className="text-2xs text-muted-foreground">
            第一次运行本地语音会慢一些；模型加载完成后会常驻复用，连续播报和识别会更快。
          </div>
        </div>
      )}
    </div>
  );
}
