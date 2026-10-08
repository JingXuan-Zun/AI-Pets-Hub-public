import { lazy, Suspense, useState, type CSSProperties, type ReactNode } from 'react';
import { Bot, Heart, LayoutGrid, Plus, Radio, Sparkles, Trash2 } from 'lucide-react';
import { type DesktopPetSlot } from '../../multiPetRoster';
import { type PetConfig, type PetVisualSize } from '../../types';
const PetVisualRenderer = lazy(() => import('../pet/PetVisualRenderer'));
import { Slider } from '../../../components/ui/slider';
import {
  getSettingsControlCenterModule,
  getSettingsControlCenterPage,
  SETTINGS_CONTROL_CENTER_MODULES,
  type SettingsControlCenterPageId,
} from './settingsControlCenterNavigation';
import { SettingsWorkspaceInspector } from './SettingsWorkspaceInspector';
import { SettingsWorkspaceLogViewer } from './SettingsWorkspaceLogViewer';
import { SettingsWorkspaceViewTabs } from './SettingsWorkspaceViewTabs';
import { type SettingsWorkspaceViewId } from './settingsWorkspaceView';

/**
 * Standalone (独立窗口) 控制中心的三栏布局外壳。
 * 布局参照 "控制中心 V3" 参考稿:
 *   ┌──────────┬─────────────────────┬─────────────────┐
 *   │ 左栏导航  │ 中栏设置区           │ 右栏工作区        │
 *   │ 品牌      │ 面包屑/状态条         │ 实时预览          │
 *   │ 竖排tab  │ 页内导航横条         │ 状态参数          │
 *   │ 宠物停靠  │ 设置内容(滚动)       │ 运行日志          │
 *   └──────────┴─────────────────────┴─────────────────┘
 */
export interface SettingsPanelStandaloneShellProps {
  activePetName: string;
  activePageId: SettingsControlCenterPageId;
  config: PetConfig;
  desktopPetSlots: DesktopPetSlot[];
  engineLabel: string;
  logs: string[];
  noDragRegionStyle?: CSSProperties;
  petVisualSize: PetVisualSize | null;
  selectedPetSlot: DesktopPetSlot;
  onSelectPetSlot: (slotId: string) => void;
  onAddPetSlot: () => void;
  onRemovePetSlot: (slotId: string) => void;
  onSetPetSlotAutoMovementEnabled: (slotId: string, enabled: boolean) => void;
  onSetPetSlotEnabled: (slotId: string, enabled: boolean) => void;
  onSetPetSlotModelVisible: (slotId: string, visible: boolean) => void;
  onSetPetSlotPointerLookEnabled: (slotId: string, enabled: boolean) => void;
  onSetActivePage: (pageId: SettingsControlCenterPageId) => void;
  onUpdateStat: (key: 'affection' | 'hunger' | 'fatigue', value: number | number[]) => void;
  renderTabContent: () => ReactNode;
}

const STAT_META = [
  { key: 'affection' as const, label: '亲密度', dotClass: 'bg-primary' },
  { key: 'hunger' as const, label: '饥饿度', dotClass: 'bg-warning' },
  { key: 'fatigue' as const, label: '疲劳度', dotClass: 'bg-info' },
];

function StatusDot({ className }: { className?: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${className ?? 'bg-success'}`} />;
}

export function SettingsPanelStandaloneShell({
  activePetName,
  activePageId,
  config,
  desktopPetSlots,
  engineLabel,
  logs,
  noDragRegionStyle,
  petVisualSize,
  selectedPetSlot,
  onSelectPetSlot,
  onAddPetSlot,
  onRemovePetSlot,
  onSetPetSlotAutoMovementEnabled,
  onSetPetSlotEnabled,
  onSetPetSlotModelVisible,
  onSetPetSlotPointerLookEnabled,
  onSetActivePage,
  onUpdateStat,
  renderTabContent,
}: SettingsPanelStandaloneShellProps) {
  const modelFileName = config.modelUrl ? config.modelUrl.split('/').pop() : '未选择模型';
  const selectedModelPreset = config.customModelPresets.find((preset) => (
    preset.type === selectedPetSlot.modelType && preset.url === selectedPetSlot.modelUrl
  )) ?? config.customModelPresets.find((preset) => preset.url === selectedPetSlot.modelUrl);
  const activeFeatureModule = getSettingsControlCenterModule(activePageId);
  const activeFeaturePage = getSettingsControlCenterPage(activePageId);
  const headerMetrics = activeFeatureModule.headerMetrics.map((metric) => {
    const value = metric.value === '$pet'
      ? activePetName
      : metric.value === '$aiModel'
        ? (config.settings.llmProvider === 'openai'
          ? (config.settings.customModelName?.trim() || config.settings.llmModel)
          : config.settings.llmModel)
        : metric.value === '$petModel'
          ? (selectedPetSlot.modelType === '3d' ? engineLabel : 'Live2D')
          : metric.value === '$action'
            ? config.currentAction
            : metric.value;
    return { ...metric, value };
  });
  const selectedSlotControls = [
    {
      label: '自动位移',
      value: selectedPetSlot.autoMovementEnabled,
      onChange: () => onSetPetSlotAutoMovementEnabled(selectedPetSlot.id, !selectedPetSlot.autoMovementEnabled),
    },
    {
      label: '视线追踪',
      value: selectedPetSlot.pointerLookEnabled,
      onChange: () => onSetPetSlotPointerLookEnabled(selectedPetSlot.id, !selectedPetSlot.pointerLookEnabled),
    },
    {
      label: '显示模型',
      value: selectedPetSlot.modelVisible,
      onChange: () => onSetPetSlotModelVisible(selectedPetSlot.id, !selectedPetSlot.modelVisible),
      locked: selectedPetSlot.isPrimary,
    },
    {
      label: '启用状态',
      value: selectedPetSlot.enabled,
      onChange: () => onSetPetSlotEnabled(selectedPetSlot.id, !selectedPetSlot.enabled),
      locked: selectedPetSlot.isPrimary,
    },
  ];
  const [workspaceView, setWorkspaceView] = useState<SettingsWorkspaceViewId>('workspace');

  return (
    <div
      className="grid min-h-0 flex-1 grid-cols-[282px_minmax(0,1fr)_420px] gap-3 p-4"
    >
      {/* ============ 左栏:导航 + 实体停靠 ============ */}
      <aside className="flex min-w-0 flex-col gap-3 overflow-hidden">
        {/* 品牌块 */}
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="text-sm font-bold text-foreground">控制中心</div>
            <div className="text-2xs text-muted-foreground">AI Pets Hub</div>
          </div>
        </div>

        {/* 竖排 tab 导航 */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <nav aria-label="一级功能导航" className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
            <div className="px-2 pb-1.5 pt-1 text-2xs font-bold uppercase tracking-[0.12em] text-muted-foreground/70">业务域</div>
            {SETTINGS_CONTROL_CENTER_MODULES.map((module) => {
              const isActive = module.id === activeFeatureModule.id;
              return (
                <button
                  key={module.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onSetActivePage(module.pages[0].id)}
                  className={[
                    'flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2.5 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                    isActive ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                  ].join(' ')}
                >
                  <span className={[
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-xs font-bold',
                    isActive ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-muted/60 text-muted-foreground',
                  ].join(' ')}>{module.label.slice(0, 1)}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{module.label}</span><span className="mt-0.5 block truncate text-2xs font-normal text-muted-foreground">{module.description}</span></span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* 实体停靠区:宠物槽位 */}
        <div className="flex max-h-[38%] shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              <LayoutGrid className="h-3.5 w-3.5 text-primary" />
              宠物槽位
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-2xs text-primary">{desktopPetSlots.length}</span>
              <button
                type="button"
                onClick={onAddPetSlot}
                aria-label="添加宠物槽位"
                title="添加宠物槽位"
                className="flex h-6 w-6 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="custom-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
            {desktopPetSlots.map((slot) => {
              const isActive = slot.id === selectedPetSlot.id;
              return (
                <div key={slot.id} className="space-y-1.5">
                <div
                  className={[
                    'group relative flex items-center gap-2.5 rounded-md border px-2.5 py-2 transition-colors',
                    isActive
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-background/40 hover:bg-muted',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => onSelectPetSlot(slot.id)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    <span className={[
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    ].join(' ')}>
                      {slot.personality.name.trim().slice(0, 1) || '宠'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-foreground">
                        {slot.personality.name}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-2xs text-muted-foreground">
                        <StatusDot className={slot.enabled ? 'bg-success' : 'bg-border'} />
                        {slot.enabled ? '已启用' : '已停用'} · {slot.modelType === '3d' ? '3D' : '2D'}
                      </span>
                    </span>
                  </button>
                  {!slot.isPrimary ? (
                    <button
                      type="button"
                      onClick={() => onRemovePetSlot(slot.id)}
                      aria-label={`删除${slot.label}`}
                      title={`删除${slot.label}`}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-destructive/30 text-destructive/70 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ============ 中栏:状态条 + 设置内容 ============ */}
      <main className="flex min-w-0 flex-col gap-3 overflow-hidden">
        {/* 页面总览：对齐参考控制中心的标题 + 简短状态信息区 */}
        <div className="grid shrink-0 grid-cols-[minmax(220px,1fr)_repeat(4,minmax(88px,1fr))] items-stretch gap-2 rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="flex min-w-0 flex-col justify-center px-1">
            <div className="flex items-center gap-2 text-2xs text-muted-foreground">
              <Radio className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate font-mono tracking-[0.08em]">{activeFeatureModule.label} / {activeFeaturePage.label} / {activePetName}</span>
            </div>
            <h1 className="mt-1 truncate text-2xl font-bold tracking-tight text-primary">{activeFeatureModule.label}</h1>
          </div>
          {headerMetrics.map((metric) => (
            <div key={metric.label} className="flex min-w-0 flex-col justify-center rounded-md border border-border bg-background/60 px-2.5 py-2">
              <span className="truncate text-2xs text-muted-foreground">{metric.label}</span>
              <strong className="mt-0.5 truncate text-xs text-foreground">{metric.value}</strong>
            </div>
          ))}
        </div>

        <div aria-label={`${activeFeatureModule.label}二级功能页`} className="flex shrink-0 items-center gap-2 overflow-x-auto rounded-lg border border-border bg-card px-2 py-1.5 shadow-sm">
          <span className="shrink-0 px-1 text-2xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{activeFeatureModule.label}</span>
          <div className="flex min-w-max gap-1.5">
            {activeFeatureModule.pages.map((page) => {
              const isActive = page.id === activePageId;
              return <button key={page.id} type="button" aria-current={isActive ? 'page' : undefined} onClick={() => onSetActivePage(page.id)} className={[
                'rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                isActive ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
              ].join(' ')}>{page.label}</button>;
            })}
          </div>
        </div>

        {/* 设置内容(滚动) */}
        <div
          className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-card p-4 shadow-sm"
          style={noDragRegionStyle}
        >
          {renderTabContent()}
        </div>
      </main>

      {/* ============ 右栏:工作区(预览 + 状态参数 + 日志) ============ */}
      <aside className="custom-scrollbar flex min-w-0 flex-col gap-3 overflow-y-auto">
        <header className="shrink-0 rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="text-2xs font-bold uppercase tracking-[0.12em] text-muted-foreground">工作区</div>
          <h2 className="mt-1 text-xl font-bold text-primary">{activeFeaturePage.workspaceTitle}</h2>
          <SettingsWorkspaceViewTabs value={workspaceView} onChange={setWorkspaceView} />
        </header>
        {workspaceView === 'workspace' ? <>
                {/* 当前桌宠快捷开关：独立于预览画布，避免遮挡模型 */}
        <div className="grid shrink-0 grid-cols-4 gap-1.5 rounded-lg border border-border bg-card p-1.5 shadow-sm" aria-label="当前桌宠快捷开关">
          {selectedSlotControls.map((control) => (
            <button
              key={control.label}
              type="button"
              disabled={control.locked}
              onClick={control.onChange}
              className={[
                'min-w-0 rounded-md border px-1.5 py-1.5 text-center text-[10px] font-semibold leading-tight shadow-sm transition-colors',
                control.value
                  ? 'border-primary bg-primary/10 text-primary hover:bg-primary/15'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted',
                control.locked ? 'cursor-not-allowed opacity-55' : 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              ].join(' ')}
            >
              <span className="block truncate">{control.label}</span>
              <span className="mt-0.5 block font-mono text-[9px]">{control.value ? 'ON' : 'OFF'}</span>
            </button>
          ))}
        </div>
        {/* 实时预览 */}
        <div className="shrink-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-2xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              实时预览
            </span>
            <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
              <StatusDot className="bg-success" />
              静态预览
            </span>
          </div>
          <div
            className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted/40"
            style={{ backgroundImage: 'radial-gradient(#E4E7EB 1px, transparent 1px)', backgroundSize: '20px 20px' }}
          >
            {selectedPetSlot.modelUrl ? (
              <div className="pointer-events-none absolute inset-0">
                <Suspense fallback={<div className="flex h-full w-full items-center justify-center text-2xs text-muted-foreground">模型加载中…</div>}>
                  <PetVisualRenderer
                    key={`${selectedPetSlot.id}:${selectedPetSlot.modelType}:${selectedPetSlot.modelUrl}`}
                    action="IDLE"
                    avatar3dRuntimeBackend="three"
                    debugPetId={`settings-preview:${selectedPetSlot.id}`}
                    fitToPreview
                    isMoving={false}
                    modelType={selectedPetSlot.modelType}
                    modelUrl={selectedPetSlot.modelUrl}
                    renderKind={selectedModelPreset?.renderKind}
                    scale={1}
                    staticPreview
                    updatePriority="companion"
                    // 右侧是配置预览，不复用桌面端的显示/启用开关。
                    // 只要槽位配有模型，预览始终展示该模型，方便检查配置。
                    visible
                  />
                </Suspense>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                  <Bot className="h-7 w-7 text-primary" />
                </div>
                <div className="px-3 text-xs font-semibold text-foreground">{activePetName}</div>
                <div className="px-3 font-mono text-2xs text-muted-foreground">未选择模型</div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-2xs text-muted-foreground">
            <span className="truncate pr-2">{modelFileName}</span>
            <span className="shrink-0 font-mono">{engineLabel}</span>
          </div>
        </div>

        {/* 状态参数 */}
        <div className="shrink-0 rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="mb-1.5 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
            <Heart className="h-3.5 w-3.5 text-primary" />
            状态参数
          </div>
          <div className="divide-y divide-border">
            {STAT_META.map((meta) => (
              <div key={meta.key} className="py-1.5">
                <div className="mb-1 flex items-center justify-between text-2xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <StatusDot className={meta.dotClass} />
                    {meta.label}
                  </span>
                  <span className="font-mono text-foreground">
                    {Math.round(selectedPetSlot.stats[meta.key])}%
                  </span>
                </div>
                <Slider
                  value={[selectedPetSlot.stats[meta.key]]}
                  max={100}
                  step={1}
                  aria-label={meta.label}
                  onValueChange={(value) => onUpdateStat(meta.key, value)}
                />
              </div>
            ))}
          </div>
        </div>

        </> : null}

        {workspaceView === 'inspector' ? (
          <SettingsWorkspaceInspector
            module={activeFeatureModule}
            page={activeFeaturePage}
            petId={selectedPetSlot.id}
          />
        ) : null}

        {workspaceView === 'logs' ? <SettingsWorkspaceLogViewer logs={logs} /> : null}
      </aside>
    </div>
  );
}
