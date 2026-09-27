/* @license SPDX-License-Identifier: Apache-2.0 */

import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useRef } from 'react';
import {
  Activity,
  Brain,
  Cpu,
  Database,
  GitBranch,
  Layout,
  Monitor,
  Share2,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react';
import PetContainer from '../PetContainer';
import { Slider } from '../../../components/ui/slider';
import { getDesktopPetSlots } from '../../multiPetRoster';
import { animateContentIn, animatePressDown, animatePressUp } from '../../uiMotionPresets';
import { type DesktopPetChatController } from '../../chatState';
import { type PetAction, type PetConfig, type PetConfigUpdateHandler } from '../../types';

export type AppWorkbenchTab = 'model' | 'personality' | 'behavior' | 'vision' | 'integration';

interface AppWorkbenchProps {
  activeScreenCaptureOptions?: DesktopPetCaptureOptionsLike | null;
  activeTab: AppWorkbenchTab;
  addLog: (msg: string) => void;
  config: PetConfig;
  handleStartScreenCapture: (options?: DesktopPetCaptureOptionsLike) => Promise<void> | void;
  handleStopScreenCapture: () => Promise<void> | void;
  handleUpdateConfig: PetConfigUpdateHandler;
  logs: string[];
  onChatControllerReady: (controller: DesktopPetChatController | null) => void;
  onInteractiveDialogueActiveChange?: (isActive: boolean) => void;
  onPreviewCaptureOptionsChange?: (options?: DesktopPetCaptureOptionsLike | null) => void;
  resetFolders: () => void;
  screenStream: MediaStream | null;
  setAction: (action: PetAction) => void;
  setActiveTab: Dispatch<SetStateAction<AppWorkbenchTab>>;
  setConfig: Dispatch<SetStateAction<PetConfig>>;
  setIsSettingsOpen: (isOpen: boolean) => void;
  isSettingsOpen: boolean;
}

const ACTION_OPTIONS: PetAction[] = ['IDLE', 'HAPPY', 'SAD', 'SLEEPING', 'WALKING', 'RUNNING', 'SWIMMING'];

const NAV_ITEMS: Array<{ value: AppWorkbenchTab; label: string; icon: typeof Layout }> = [
  { value: 'model', label: '模型', icon: Layout },
  { value: 'personality', label: '人格', icon: Workflow },
  { value: 'behavior', label: '行为', icon: GitBranch },
  { value: 'vision', label: '视觉', icon: Brain },
  { value: 'integration', label: '集成', icon: Share2 },
];

const STAT_META = [
  { key: 'affection' as const, label: '亲密度', dotClass: 'bg-primary' },
  { key: 'hunger' as const, label: '饥饿度', dotClass: 'bg-warning' },
  { key: 'fatigue' as const, label: '疲劳度', dotClass: 'bg-info' },
];

function resolveRenderEngineLabel(config: PetConfig) {
  if (config.settings.avatar3dRuntimeBackend === 'unity') {
    return 'Unity 3D Runtime';
  }
  return config.settings.engineType ?? 'Live2D';
}

function SectionCard({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SettingRow({ label, children, description }: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="text-sm text-foreground">{label}</div>
        {description ? <div className="mt-0.5 text-xs text-muted-foreground">{description}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function StatusDot({ className }: { className?: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${className ?? 'bg-success'}`} />;
}

function WorkbenchTabMotion({ activeTab, children }: { activeTab: AppWorkbenchTab; children: ReactNode }) {
  const motionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (motionRef.current) {
      animateContentIn(motionRef.current);
    }
  }, [activeTab]);

  return (
    <div ref={motionRef} className="min-w-0 space-y-6">
      {children}
    </div>
  );
}

function pressHandlers() {
  return {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (event.currentTarget instanceof HTMLElement) {
        animatePressDown(event.currentTarget);
      }
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      if (event.currentTarget instanceof HTMLElement) {
        animatePressUp(event.currentTarget);
      }
    },
    onPointerLeave: (event: React.PointerEvent<HTMLElement>) => {
      if (event.currentTarget instanceof HTMLElement) {
        animatePressUp(event.currentTarget);
      }
    },
  };
}

export default function AppWorkbench({
  activeScreenCaptureOptions = null,
  activeTab,
  addLog,
  config,
  handleStartScreenCapture,
  handleStopScreenCapture,
  handleUpdateConfig,
  logs,
  onChatControllerReady,
  onInteractiveDialogueActiveChange,
  onPreviewCaptureOptionsChange,
  resetFolders,
  screenStream,
  setAction,
  setActiveTab,
  setConfig,
  setIsSettingsOpen,
  isSettingsOpen,
}: AppWorkbenchProps) {
  const renderEngineLabel = resolveRenderEngineLabel(config);
  const petSlots = getDesktopPetSlots(config);
  const modelFileName = config.modelUrl ? config.modelUrl.split('/').pop() : '未选择模型';
  const captureConnected = Boolean(screenStream);

  const updateStat = (key: 'affection' | 'hunger' | 'fatigue', value: number | number[]) => {
    const nextValue = Array.isArray(value) ? value[0] : value;
    handleUpdateConfig({
      ...config,
      stats: { ...config.stats, [key]: nextValue },
    });
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground selection:bg-primary/20">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">AI Desktop Pet 工作台</div>
            <div className="text-xs text-muted-foreground">模型 · 人格 · 行为 · 视觉 · 集成</div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <StatusDot className={captureConnected ? 'bg-success' : 'bg-border'} />
            {captureConnected ? '桌面视觉已连接' : '桌面视觉未连接'}
          </span>
          <span className="h-4 w-px bg-border" />
          <span className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5" />
            {renderEngineLabel}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="工作台导航"
          className="flex w-48 shrink-0 flex-col gap-1 border-r border-border bg-card p-3"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setActiveTab(item.value)}
                aria-current={isActive ? 'page' : undefined}
                {...pressHandlers()}
                className={[
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                ].join(' ')}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            );
          })}

          <div className="mt-auto rounded-lg border border-border bg-muted/50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              宠物槽位
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">{petSlots.length} 只桌宠已启用</div>
          </div>
        </nav>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 p-6 lg:grid-cols-[minmax(320px,420px)_1fr]">
            <div className="lg:sticky lg:top-6 lg:self-start">
              <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">实时预览</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <StatusDot className="bg-success" />
                    {config.currentAction}
                  </span>
                </div>
                <div
                  className="relative aspect-square bg-muted/40"
                  style={{ backgroundImage: 'radial-gradient(#E4E7EB 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <PetContainer
                      config={config}
                      isSettingsOpen={isSettingsOpen}
                      settingsResetToken={0}
                      onSetSettingsOpen={setIsSettingsOpen}
                      onUpdateConfig={handleUpdateConfig}
                      addLog={addLog}
                      screenStream={screenStream}
                      screenCaptureOptions={activeScreenCaptureOptions}
                      onPreviewCaptureOptionsChange={onPreviewCaptureOptionsChange}
                      logs={logs}
                      onStartScreenCapture={handleStartScreenCapture}
                      onStopScreenCapture={handleStopScreenCapture}
                      onResetFolders={resetFolders}
                      onSetAction={setAction}
                      onChatControllerReady={onChatControllerReady}
                      onInteractiveDialogueActiveChange={onInteractiveDialogueActiveChange}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                  <span className="truncate pr-3">{modelFileName}</span>
                  <span className="shrink-0 font-mono">{renderEngineLabel}</span>
                </div>
              </div>

              <div className="mt-6">
                <SectionCard title="状态参数" description="拖动滑块调整当前宠物的即时状态">
                  <div className="divide-y divide-border">
                    {STAT_META.map((meta) => (
                      <div key={meta.key} className="py-2.5">
                        <div className="mb-2 flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <StatusDot className={meta.dotClass} />
                            {meta.label}
                          </span>
                          <span className="font-mono text-foreground">{Math.round(config.stats[meta.key])}%</span>
                        </div>
                        <Slider
                          value={[config.stats[meta.key]]}
                          max={100}
                          step={1}
                          aria-label={meta.label}
                          onValueChange={(value) => updateStat(meta.key, value)}
                        />
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
            </div>

            <WorkbenchTabMotion activeTab={activeTab}>
              {activeTab === 'model' && (
                <>
                  <SectionCard title="渲染引擎" description="选择桌面宠物的显示后端">
                    <SettingRow label="当前引擎" description={config.modelType === '3d' ? '3D 模型渲染' : '2D 模型渲染'}>
                      <span className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        <Zap className="h-3.5 w-3.5" />
                        {renderEngineLabel}
                      </span>
                    </SettingRow>
                    <SettingRow label="模型文件" description="当前槽位使用的模型资源">
                      <span className="max-w-56 truncate font-mono text-xs text-foreground">{modelFileName}</span>
                    </SettingRow>
                    <SettingRow label="物理模拟" description="为角色骨骼/头发启用动态物理">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(config.settings.physicsEnabled)}
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            settings: { ...prev.settings, physicsEnabled: !prev.settings.physicsEnabled },
                          }))
                        }
                        className={[
                          'relative h-6 w-11 rounded-full transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                          config.settings.physicsEnabled ? 'bg-primary' : 'bg-border',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                            config.settings.physicsEnabled ? 'translate-x-[22px]' : 'translate-x-0.5',
                          ].join(' ')}
                        />
                      </button>
                    </SettingRow>
                  </SectionCard>
                  <SectionCard title="记忆" description="控制注入对话的上下文深度">
                    <SettingRow label="记忆深度" description="单次对话携带的历史 token 上限">
                      <button
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            settings: { ...prev.settings, memoryDepth: prev.settings.memoryDepth === 4096 ? 8192 : 4096 },
                          }))
                        }
                        className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      >
                        {config.settings.memoryDepth} tokens
                      </button>
                    </SettingRow>
                  </SectionCard>
                </>
              )}

              {activeTab === 'personality' && (
                <>
                  <SectionCard title="基础人格" description="当前宠物槽位的人格设定">
                    <div className="flex flex-wrap gap-2">
                      {config.personality.traits.map((trait) => (
                        <span key={trait} className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          {trait}
                        </span>
                      ))}
                    </div>
                  </SectionCard>
                  <SectionCard title="大脑模型" description="驱动对话与行为的语言模型">
                    <SettingRow label="模型提供方">
                      <span className="text-sm text-foreground">
                        {config.settings.llmProvider === 'openai'
                          ? `OpenAI / ${config.settings.customModelName || '未命名模型'}`
                          : config.settings.llmModel}
                      </span>
                    </SettingRow>
                    <SettingRow label="当前情绪">
                      <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-xs uppercase tracking-wider text-foreground">
                        {config.currentAction}
                      </span>
                    </SettingRow>
                    <SettingRow label="对话头像" description="在聊天窗口显示宠物形象">
                      <span className="text-xs text-muted-foreground">
                        {config.settings.chatAvatarsEnabled ? '已开启' : '已关闭'}
                      </span>
                    </SettingRow>
                  </SectionCard>
                </>
              )}

              {activeTab === 'behavior' && (
                <>
                  <SectionCard title="快捷动作" description="立即触发一个宠物动作">
                    <div className="grid grid-cols-2 gap-2">
                      {ACTION_OPTIONS.map((action) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => setAction(action)}
                          {...pressHandlers()}
                          className={[
                            'rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                            config.currentAction === action
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-card text-foreground hover:bg-muted',
                          ].join(' ')}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </SectionCard>
                  <SectionCard title="自动行为" description="桌面壳模式下的自主移动策略">
                    <SettingRow label="自动移动" description="宠物在活动区域内自主走动">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <StatusDot className={petSlots.some((slot) => slot.autoMovementEnabled) ? 'bg-success' : 'bg-border'} />
                        {petSlots.some((slot) => slot.autoMovementEnabled) ? '运行中' : '已暂停'}
                      </span>
                    </SettingRow>
                    <SettingRow label="视线跟随" description="宠物注视鼠标指针">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <StatusDot className={petSlots.some((slot) => slot.pointerLookEnabled) ? 'bg-success' : 'bg-border'} />
                        {petSlots.some((slot) => slot.pointerLookEnabled) ? '已开启' : '已关闭'}
                      </span>
                    </SettingRow>
                  </SectionCard>
                </>
              )}

              {activeTab === 'vision' && (
                <>
                  <SectionCard title="桌面视觉" description="让宠物实时查看你的桌面内容">
                    <button
                      type="button"
                      onClick={() => void (captureConnected ? handleStopScreenCapture() : handleStartScreenCapture())}
                      className={[
                        'flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                        captureConnected
                          ? 'border-success/40 bg-success/10 text-success hover:bg-success/15'
                          : 'border-primary bg-primary text-primary-foreground hover:opacity-90',
                      ].join(' ')}
                    >
                      <Monitor className="h-4 w-4" />
                      {captureConnected ? '断开桌面连接' : '连接桌面'}
                    </button>
                  </SectionCard>
                  <SectionCard title="捕获源" description="当前视觉输入来源">
                    {captureConnected && activeScreenCaptureOptions ? (
                      <div className="text-sm text-foreground">
                        {activeScreenCaptureOptions.mode === 'area' && Array.isArray(activeScreenCaptureOptions.areaSources)
                          ? `跨屏区域 · ${activeScreenCaptureOptions.areaSources.length} 个显示器`
                          : activeScreenCaptureOptions.sourceName
                            ? `${activeScreenCaptureOptions.sourceType === 'window' ? '窗口' : '屏幕'} · ${activeScreenCaptureOptions.sourceName}`
                            : '真实桌面'}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">尚未连接桌面视觉。</div>
                    )}
                  </SectionCard>
                  <SectionCard title="已识别的文件夹" description="宠物在桌面上登记的文件夹">
                    {config.folders.length > 0 ? (
                      <ul className="divide-y divide-border">
                        {config.folders.map((folder) => (
                          <li key={folder.id} className="flex items-center gap-2 py-2 text-sm text-foreground">
                            <Database className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{folder.name}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-muted-foreground">还没有登记文件夹。</div>
                    )}
                  </SectionCard>
                </>
              )}

              {activeTab === 'integration' && (
                <>
                  <SectionCard title="宠物槽位" description="当前配置的桌宠列表">
                    <ul className="divide-y divide-border">
                      {petSlots.map((slot) => (
                        <li key={slot.id} className="flex items-center justify-between gap-3 py-2.5">
                          <span className="flex items-center gap-2 text-sm text-foreground">
                            <StatusDot className={slot.enabled ? 'bg-success' : 'bg-border'} />
                            {slot.personality.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {slot.modelType === '3d' ? '3D' : '2D'} · {slot.enabled ? '已启用' : '已停用'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </SectionCard>
                  <SectionCard title="本地文件系统" description="宠物 Agent 的本地能力">
                    <SettingRow label="文件管理 Agent" description="允许宠物读取与管理本地文件">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <StatusDot className="bg-success" />
                        已启用
                      </span>
                    </SettingRow>
                  </SectionCard>
                </>
              )}

              <SectionCard title="运行日志" description="最近的交互与系统事件">
                {logs.length > 0 ? (
                  <div className="custom-scrollbar max-h-64 overflow-y-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                    {logs.slice(-60).map((log, index) => (
                      <div key={`${index}-${log.length}`} className="border-l-2 border-border pl-2 [&:not(:last-child)]:mb-1">
                        {log}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    暂无日志。
                  </div>
                )}
              </SectionCard>
            </WorkbenchTabMotion>
          </div>
        </main>
      </div>

      <footer className="flex h-9 shrink-0 items-center gap-5 border-t border-border bg-card px-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <StatusDot className="bg-success" />
          系统正常
        </span>
        <span className="flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5" />
          {petSlots.length} 个宠物槽位
        </span>
        <span className="ml-auto">AI Desktop Pet v2.1.0</span>
      </footer>
    </div>
  );
}
