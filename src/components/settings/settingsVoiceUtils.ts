import { type BrowserTtsHealth, type BrowserTtsInstallResult, type LocalVoiceHealth, type LocalVoiceInstallResult } from '../../types';

export function selectClassName() {
  return 'h-9 w-full rounded-sm border border-border bg-secondary px-2 text-2xs outline-none focus:border-primary';
}

export function inputClassName() {
  return 'h-9 rounded-sm border-border bg-secondary text-xs focus-visible:ring-primary';
}

export function toggleButtonClass(enabled: boolean) {
  return 'h-9 rounded-sm border px-3 text-2xs font-medium transition-colors ' + (
    enabled
      ? 'border-primary bg-primary/10 text-primary hover:bg-primary/15'
      : 'border-border bg-secondary/40 text-muted-foreground hover:border-primary/40 hover:text-primary'
  );
}

export function clampLocalTtsVoiceToneStability(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function getLocalTtsVoiceToneStabilityLabel(strength: number) {
  if (strength <= 0) {
    return '已关闭';
  }
  if (strength < 35) {
    return '轻度稳定';
  }
  if (strength < 70) {
    return '中等稳定';
  }
  return '强力稳定';
}

export function normalizeLocalTtsRandomSeedInput(value: string) {
  return value.replace(/\D+/g, '').slice(0, 10);
}

export function buildRandomLocalTtsSeed() {
  const min = 100000000;
  const max = 2147483646;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

export function getLocalVoiceStatusLabel(health: LocalVoiceHealth) {
  switch (health.status) {
    case 'idle':
      return '尚未检测';
    case 'ready':
      return '本地语音可用';
    case 'missing-runtime':
      return '缺少运行环境';
    case 'missing-dependencies':
      return '缺少本地依赖';
    case 'missing-assets':
      return '模型配置未完成';
    case 'error':
    default:
      return '本地语音检测失败';
  }
}

export function getLocalVoiceStatusClass(health: LocalVoiceHealth) {
  switch (health.status) {
    case 'idle':
      return 'border-border bg-background/50 text-muted-foreground';
    case 'ready':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700';
    case 'missing-runtime':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-700';
    case 'missing-dependencies':
      return 'border-orange-500/40 bg-orange-500/10 text-orange-700';
    case 'missing-assets':
      return 'border-primary/40 bg-primary/10 text-primary';
    case 'error':
    default:
      return 'border-red-500/40 bg-red-500/10 text-red-700';
  }
}

export function getBrowserTtsStatusLabel(health: BrowserTtsHealth) {
  switch (health.status) {
    case 'idle':
      return '尚未检测';
    case 'ready':
      return health.started ? '服务已启动' : '服务可用';
    case 'stopped':
      return '服务未启动';
    case 'missing-runtime':
      return '缺少 Python';
    case 'missing-dependencies':
      return '缺少 Edge-TTS';
    case 'error':
    default:
      return '检测失败';
  }
}

export function getBrowserTtsStatusClass(health: BrowserTtsHealth) {
  switch (health.status) {
    case 'idle':
      return 'border-border bg-background/50 text-muted-foreground';
    case 'ready':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700';
    case 'stopped':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-700';
    case 'missing-runtime':
    case 'missing-dependencies':
      return 'border-orange-500/40 bg-orange-500/10 text-orange-700';
    case 'error':
    default:
      return 'border-red-500/40 bg-red-500/10 text-red-700';
  }
}

export function getBrowserTtsInstallFeedbackClass(result: BrowserTtsInstallResult | null, isRunning = false) {
  if (isRunning) {
    return 'border-primary/40 bg-primary/10 text-primary';
  }
  if (!result) {
    return 'border-border bg-background/50 text-muted-foreground';
  }
  return result.ok
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
    : 'border-red-500/40 bg-red-500/10 text-red-700';
}

export function getDeviceLabel(device: LocalVoiceHealth['device']) {
  switch (device) {
    case 'cuda':
      return 'GPU';
    case 'cpu':
      return 'CPU';
    default:
      return '未知';
  }
}

export function getInstallFeedbackClass(result: LocalVoiceInstallResult | null, isRunning = false) {
  if (isRunning) {
    return 'border-primary/40 bg-primary/10 text-primary';
  }
  if (!result) {
    return 'border-border bg-background/50 text-muted-foreground';
  }
  return result.ok
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
    : 'border-red-500/40 bg-red-500/10 text-red-700';
}

export function getRuntimeTypeLabel(runtimeLabel: LocalVoiceHealth['runtimeLabel']) {
  switch (runtimeLabel) {
    case 'isolated':
      return '独立环境';
    case 'project':
      return '项目内 Python';
    case 'portable':
      return '程序目录 Python';
    case 'bundled':
      return '程序自带 Python';
    case 'manual':
      return '手动指定 Python';
    case 'system':
      return '系统 / 共享 Python';
    default:
      return '未识别';
  }
}

export function getRuntimeTypeHint(runtimeLabel: LocalVoiceHealth['runtimeLabel']) {
  switch (runtimeLabel) {
    case 'isolated':
      return '当前已经在独立环境中运行。首次加载模型会慢一些，后续会复用已加载模型。';
    case 'project':
    case 'portable':
    case 'bundled':
    case 'manual':
      return '当前环境可以正常使用。安装本地依赖主要是做隔离、减少冲突，不是单靠换 Python 就能明显提速。';
    case 'system':
      return '当前仍在使用系统 / 共享 Python。安装本地依赖主要是创建独立环境、降低冲突风险，不是单靠换 Python 就能明显提速。';
    default:
      return '首次加载模型会慢一些，加载完成后会尽量复用已加载模型。';
  }
}
