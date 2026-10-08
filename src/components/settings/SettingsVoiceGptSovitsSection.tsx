import { type CSSProperties } from 'react';
import { type GptSovitsDevice, type GptSovitsHealth, type PetConfig } from '../../types';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { selectClassName } from './settingsVoiceUtils';
import { SettingsGptSovitsVoiceList } from './SettingsGptSovitsVoiceList';
import { type GptSovitsBusyAction, useSettingsGptSovitsState } from './useSettingsGptSovitsState';

type SettingsUpdater = (updates: Partial<PetConfig['settings']>) => void;

const STATUS_LABELS: Record<GptSovitsHealth['status'], string> = {
  idle: '尚未检测',
  ready: '服务运行中',
  stopped: '已安装，服务未启动',
  'missing-runtime': '未安装运行环境',
  'missing-dependencies': '依赖不完整',
  'missing-source': '推理组件缺失',
  'missing-model': '没有可用音色',
  'no-gpu': '未检测到显卡',
  error: '检测失败',
};

const BUSY_LABELS: Record<Exclude<GptSovitsBusyAction, null>, string> = {
  checking: '检测中…',
  installing: '安装中…（下载约 5–6GB，安装后占用约 10GB 磁盘，请保持网络畅通）',
  starting: '启动并加载模型中…（约 20–40 秒）',
};

function statusClass(status: GptSovitsHealth['status']) {
  if (status === 'ready') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700';
  if (status === 'stopped') return 'border-amber-500/40 bg-amber-500/10 text-amber-700';
  if (status === 'idle') return 'border-border bg-background/50 text-muted-foreground';
  return 'border-red-500/40 bg-red-500/10 text-red-700';
}

const NEEDS_INSTALL = new Set<GptSovitsHealth['status']>(['missing-runtime', 'missing-dependencies', 'missing-source']);
// Normal states already explained by the badge; repeating their message in red reads like a failure.
const QUIET_STATUSES = new Set<GptSovitsHealth['status']>(['idle', 'ready', 'stopped']);

export function SettingsVoiceGptSovitsSection({ settings, noDragRegionStyle, applySettings }: {
  settings: PetConfig['settings'];
  noDragRegionStyle?: CSSProperties;
  applySettings: SettingsUpdater;
}) {
  const state = useSettingsGptSovitsState(settings);
  if (settings.ttsProvider !== 'gpt-sovits') return null;
  const { health, busy } = state;
  const readyModels = health.models.filter((model) => model.ready);
  const brokenModels = health.models.filter((model) => !model.ready);
  const selectedModelId = health.modelId ?? settings.gptSovitsModelId;
  const progressLines = (busy === 'installing' ? state.installProgress?.messages : state.installResult?.messages) ?? [];

  return (
    <div className="space-y-4 rounded-sm border border-border bg-secondary/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="text-2xs font-bold uppercase tracking-widest text-primary">GPT-SoVITS 角色音色</div>
          <div className="text-2xs text-muted-foreground">
            用角色音色包播报，需要 NVIDIA 显卡。音色包放在应用目录的 local-models/voice/gpt-sovits/音色名/ 下，换一个音色包就换一个声音。
          </div>
        </div>
        <div className={'rounded-sm border px-2 py-1 text-2xs ' + statusClass(health.status)}>
          {busy ? BUSY_LABELS[busy] : STATUS_LABELS[health.status]}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">角色音色</Label>
          <select
            value={readyModels.some((model) => model.id === selectedModelId) ? selectedModelId : ''}
            onChange={(event) => applySettings({ gptSovitsModelId: event.target.value })}
            className={selectClassName()}
            style={noDragRegionStyle}
            disabled={readyModels.length === 0}
          >
            {readyModels.length === 0 && <option value="">暂无可用音色</option>}
            {readyModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}（{model.kind === 'lite' ? '轻量版' : '训练版'}）
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">运行设备</Label>
          <select
            value={settings.gptSovitsDevice}
            onChange={(event) => applySettings({ gptSovitsDevice: event.target.value as GptSovitsDevice })}
            className={selectClassName()}
            style={noDragRegionStyle}
          >
            <option value="auto">自动（优先显卡）</option>
            <option value="cuda">显卡</option>
            <option value="cpu">CPU（较慢，不适合实时对话）</option>
          </select>
        </div>
      </div>

      <SettingsGptSovitsVoiceList
        models={readyModels}
        settings={settings}
        selectedModelId={selectedModelId}
        noDragRegionStyle={noDragRegionStyle}
        applySettings={applySettings}
      />

      {brokenModels.length > 0 && (
        <div className="text-2xs text-amber-700">
          以下音色文件不完整，已跳过：{brokenModels.map((model) => model.name).join('、')}
        </div>
      )}
      {(state.actionError || (!QUIET_STATUSES.has(health.status) && health.error)) && (
        <div className="text-2xs text-red-700">{state.actionError ?? health.error}</div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void state.refresh()} style={noDragRegionStyle}>
          重新检测
        </Button>
        {NEEDS_INSTALL.has(health.status) && (
          <Button size="sm" disabled={Boolean(busy)} onClick={() => void state.install()} style={noDragRegionStyle}>
            安装运行环境
          </Button>
        )}
        {(health.status === 'stopped' || health.status === 'ready') && (
          <Button size="sm" disabled={Boolean(busy)} onClick={() => void state.startAndWarmup()} style={noDragRegionStyle}>
            {health.status === 'ready' ? '重新预热' : '启动并预热'}
          </Button>
        )}
      </div>

      {progressLines.length > 0 && (
        <div className="max-h-32 overflow-y-auto rounded-sm border border-border bg-background/50 p-2 text-2xs text-muted-foreground">
          {progressLines.slice(-6).map((line, index) => <div key={`${index}-${line}`}>{line}</div>)}
          {state.installResult?.error && <div className="text-red-700">{state.installResult.error}</div>}
        </div>
      )}
    </div>
  );
}
