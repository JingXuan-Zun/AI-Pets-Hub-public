import { useEffect, useRef, useState } from 'react';
import { type PetConfig } from '../../types';
import { normalizePetConfig } from '../../petConfigNormalization';
import {
  getModelUsageSnapshot,
  getSoftwareRuntimeSnapshot,
  loadSoftwareRuntimeSnapshot,
  subscribeToModelUsage,
  type ModelUsageSnapshot,
  type SoftwareRuntimeSnapshot,
} from '../../controlCenterUsage';
import { downloadJsonTextFile } from './settingsDownloadUtils';

declare const __APP_VERSION__: string;

const PRIVATE_EXPORT_KIND = 'ai-desktop-pet-private-data';
const PRIVATE_EXPORT_VERSION = 1;

type PrivateDataExport = {
  appVersion: string;
  config: PetConfig;
  exportedAt: string;
  kind: typeof PRIVATE_EXPORT_KIND;
  version: typeof PRIVATE_EXPORT_VERSION;
};

const SECRET_SETTING_KEYS = [
  'braveSearchApiKey',
  'browserTtsApiKey',
  'customApiKey',
  'geminiApiKey',
  'customSpeechApiKey',
  'customVoiceApiKey',
  'customWebSearchApiKey',
  'serperApiKey',
  'tavilyApiKey',
  'visionCustomApiKey',
] as const;

function formatDuration(durationMs: number) {
  const totalSeconds = Math.floor(Math.max(0, durationMs) / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  if (days > 0) return `${days}天 ${hours}小时`;
  if (hours > 0) return `${hours}小时 ${minutes}分钟`;
  return `${minutes}分钟`;
}

function redactSecrets(config: PetConfig): PetConfig {
  const settings = { ...config.settings };
  for (const key of SECRET_SETTING_KEYS) {
    settings[key] = '';
  }
  return { ...config, settings };
}

function preserveLocalSecrets(importedConfig: PetConfig, currentConfig: PetConfig): PetConfig {
  const settings = { ...importedConfig.settings };
  for (const key of SECRET_SETTING_KEYS) {
    settings[key] = currentConfig.settings[key];
  }
  return { ...importedConfig, settings };
}

function buildPrivateDataExport(config: PetConfig): PrivateDataExport {
  return {
    appVersion: __APP_VERSION__,
    config: redactSecrets(normalizePetConfig(config)),
    exportedAt: new Date().toISOString(),
    kind: PRIVATE_EXPORT_KIND,
    version: PRIVATE_EXPORT_VERSION,
  };
}

function parsePrivateDataExport(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('文件不是有效的私人数据备份。');
  const payload = value as Partial<PrivateDataExport>;
  if (payload.kind !== PRIVATE_EXPORT_KIND || payload.version !== PRIVATE_EXPORT_VERSION || !payload.config) {
    throw new Error('备份格式或版本不受支持。');
  }
  return normalizePetConfig(payload.config);
}

function useOverviewMetrics() {
  const [modelUsage, setModelUsage] = useState<ModelUsageSnapshot>(() => getModelUsageSnapshot());
  const [runtime, setRuntime] = useState<SoftwareRuntimeSnapshot>(() => getSoftwareRuntimeSnapshot());

  useEffect(() => {
    const refresh = () => setModelUsage(getModelUsageSnapshot());
    const refreshRuntime = () => {
      void loadSoftwareRuntimeSnapshot().then(setRuntime);
    };
    const unsubscribe = subscribeToModelUsage(refresh);
    const timer = window.setInterval(() => {
      refreshRuntime();
    }, 30_000);
    refreshRuntime();
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, []);

  return { modelUsage, runtime };
}

export interface SettingsOverviewDashboardProps {
  config: PetConfig;
  onImportConfig: (config: PetConfig) => void;
}

export function SettingsOverviewDashboard({ config, onImportConfig }: SettingsOverviewDashboardProps) {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [feedback, setFeedback] = useState('私人数据只保存在本机；导出文件不包含 API Key 等密钥。');
  const { modelUsage, runtime } = useOverviewMetrics();

  const exportPrivateData = () => {
    const payload = buildPrivateDataExport(config);
    downloadJsonTextFile(`ai-desktop-pet-private-data-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2));
    setFeedback('已导出本机配置、角色和记忆数据；API Key 等密钥已排除。');
  };

  const importPrivateData = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      const configToImport = preserveLocalSecrets(
        parsePrivateDataExport(JSON.parse(await file.text())),
        config,
      );
      onImportConfig(configToImport);
      setFeedback('私人数据已导入并保存到本机；当前设备已有的 API Key 已保留。');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '导入失败：无法读取备份文件。');
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const cards = [
    {
      label: '真实 Tokens',
      value: modelUsage.reportedRequestCount > 0 ? modelUsage.totalTokens.toLocaleString() : '暂无数据',
      detail: modelUsage.reportedRequestCount > 0
        ? `${modelUsage.reportedRequestCount} 次接口返回 usage${modelUsage.lastModel ? ` · ${modelUsage.lastModel}` : ''}`
        : '等待模型接口返回 usage 字段',
    },
    { label: '软件总运行', value: formatDuration(runtime.totalMs), detail: `本次运行 ${formatDuration(runtime.sessionMs)}` },
    { label: '当前版本', value: `v${__APP_VERSION__}`, detail: '当前安装包构建版本' },
    { label: '私人数据', value: '导入 / 导出', detail: '配置、角色、记忆与本机偏好' },
    { label: '数据边界', value: '密钥不导出', detail: 'API Key 和第三方访问凭证始终留在本机' },
  ];

  return (
    <section className="space-y-4" aria-label="控制台总览">
      <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { void importPrivateData(event.target.files); }} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <article key={card.label} className="min-h-28 rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="text-2xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{card.label}</div>
            <div className="mt-2 truncate text-lg font-bold text-primary" title={card.value}>{card.value}</div>
            <p className="mt-2 text-2xs leading-4 text-muted-foreground">{card.detail}</p>
          </article>
        ))}
      </div>

      <article className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-foreground">私人数据管理</div>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">导出和导入本机配置、桌宠角色、记忆、知识库与偏好。导出文件不包含 API Key、搜索服务密钥或语音服务密钥；导入时也会保留当前设备已有的密钥。</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={exportPrivateData} className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20">导出私人数据</button>
            <button type="button" onClick={() => importInputRef.current?.click()} className="rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted">导入私人数据</button>
          </div>
        </div>
        <p className="mt-4 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-2xs text-muted-foreground">{feedback}</p>
      </article>
    </section>
  );
}
