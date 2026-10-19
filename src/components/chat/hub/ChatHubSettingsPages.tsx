import { lazy, Suspense, type ReactNode } from 'react';
import { Check, Pin, PinOff, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Slider } from '../../../../components/ui/slider';
import {
  CHARACTER_MEMORY_KIND_LABELS,
  EMPTY_CHARACTER_MEMORY_STATE,
  type CharacterMemoryItem,
} from '../../../character-memory/characterMemoryTypes';
import {
  CHAT_FONT_SIZE_MAX,
  CHAT_FONT_SIZE_MIN,
  clampUiGlassTransparency,
  UI_GLASS_TRANSPARENCY_MAX,
  UI_GLASS_TRANSPARENCY_MIN,
} from '../../../chatAppearanceSettings';
import { listSharedUserMemory, removeSharedUserMemoryItems } from '../../../character-memory/sharedUserMemory';
import { applyDesktopPetModelSelection, applyDesktopPetSlotChanges, type DesktopPetSlot } from '../../../multiPetRoster';
import { listNeuralMemoryProposals } from '../../../neural-memory/neuralMemoryProposalConfig';
import { NeuralMemoryProposalPanel } from '../memory/NeuralMemoryProposalPanel';
import { useNeuralMemoryProposalActions } from '../memory/useNeuralMemoryProposalActions';
import { type PetConfig, type PetConfigUpdateHandler } from '../../../types';
import { SettingsToggleSwitch } from '../../settings/SettingsToggleSwitch';
import type { SettingsControlCenterPageId } from '../../settings/settingsControlCenterNavigation';
import { openSettingsPage } from './settingsPageRequest';

const SettingsExtensionHubTab = lazy(() => import('../../settings/SettingsExtensionHubTab')
  .then((module) => ({ default: module.SettingsExtensionHubTab })));

/**
 * 聊天 Hub 里的简洁设置页：常用项直接在 Hub 中修改并立即生效，
 * 只有点「高级设置」才打开完整的设置窗。
 */
function HubSettingsPage({ title, description, advancedPageId, children }: {
  title: string;
  description: string;
  advancedPageId?: SettingsControlCenterPageId;
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/80 hub-glass-panel shadow-[0_18px_48px_rgba(158,84,140,0.16)]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/70 px-6 py-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => openSettingsPage(advancedPageId)}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-xs text-foreground hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          高级设置
        </button>
      </header>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
    </section>
  );
}

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/80 hub-glass-card px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground">{label}</div>
        {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/* ---------------- 记忆 ---------------- */

export function ChatHubMemoryPage({ config, slot, onUpdateConfig }: {
  config: PetConfig;
  slot: DesktopPetSlot;
  onUpdateConfig: PetConfigUpdateHandler;
}) {
  const memoryState = slot.personality.memoryState ?? EMPTY_CHARACTER_MEMORY_STATE;
  const items = [...memoryState.items].sort((left, right) => Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)) || right.updatedAt - left.updatedAt);
  const saveItems = (nextItems: CharacterMemoryItem[]) => {
    onUpdateConfig(applyDesktopPetSlotChanges(config, slot.id, {
      personality: { ...slot.personality, memoryState: { ...memoryState, items: nextItems } },
    }));
  };
  const proposalActions = useNeuralMemoryProposalActions({ config, onUpdateConfig });
  const proposals = listNeuralMemoryProposals(config, slot.id);
  const sharedItems = [...listSharedUserMemory(config)].sort((left, right) => right.updatedAt - left.updatedAt);

  return (
    <HubSettingsPage title="记忆" description={`${slot.personality.name} 记住的关于你的事`} advancedPageId="ai-memory">
      {proposals.length || proposalActions.message ? (
        <div className="mb-4 rounded-2xl border border-primary/30 hub-glass-card px-4 py-3">
          <NeuralMemoryProposalPanel
            busyProposalId={proposalActions.busyProposalId}
            message={proposalActions.message}
            proposals={proposals}
            onApprove={(proposal, content) => void proposalActions.approve(proposal, content)}
            onDismiss={proposalActions.dismiss}
          />
        </div>
      ) : null}
      {sharedItems.length ? (
        <div className="mb-4 rounded-2xl border border-white/80 hub-glass-card px-4 py-3">
          <div className="text-xs font-semibold text-primary">关于你 · 所有角色都知道</div>
          <ul className="mt-2 space-y-1.5">
            {sharedItems.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-foreground">{item.text}</p>
                <button
                  type="button"
                  onClick={() => onUpdateConfig(removeSharedUserMemoryItems(config, [item.id]))}
                  className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="让所有角色忘掉这条"
                  aria-label="删除这条共享记忆"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {memoryState.summary?.text ? (
        <div className="mb-4 rounded-2xl border border-white/80 hub-glass-card px-4 py-3">
          <div className="text-xs font-semibold text-primary">聊天摘要</div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{memoryState.summary.text}</p>
        </div>
      ) : null}
      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">还没有记忆。多聊几句，{slot.personality.name} 会自动记住重要的事。</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 rounded-2xl border border-white/80 hub-glass-card px-4 py-3">
              <span className="mt-0.5 shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-2xs text-primary">{CHARACTER_MEMORY_KIND_LABELS[item.kind]}</span>
              <p className="min-w-0 flex-1 text-sm leading-relaxed text-foreground">{item.text}</p>
              <button
                type="button"
                onClick={() => saveItems(memoryState.items.map((entry) => (entry.id === item.id ? { ...entry, pinned: !entry.pinned } : entry)))}
                className={`shrink-0 rounded-full p-1.5 hover:bg-primary/10 ${item.pinned ? 'text-primary' : 'text-muted-foreground'}`}
                title={item.pinned ? '取消置顶' : '置顶（始终记住）'}
                aria-label={item.pinned ? '取消置顶' : '置顶'}
              >
                {item.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => saveItems(memoryState.items.filter((entry) => entry.id !== item.id))}
                className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="忘掉这条"
                aria-label="删除这条记忆"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </HubSettingsPage>
  );
}

/* ---------------- 换装 ---------------- */

export function ChatHubOutfitPage({ config, slot, onUpdateConfig }: {
  config: PetConfig;
  slot: DesktopPetSlot;
  onUpdateConfig: PetConfigUpdateHandler;
}) {
  const presets = config.customModelPresets;
  return (
    <HubSettingsPage title="换装" description={`给 ${slot.personality.name} 换一个模型`} advancedPageId="desktop-model-library">
      {presets.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">模型库还是空的，点右上角「高级设置」导入模型。</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {presets.map((preset) => {
            const isActive = preset.url === slot.modelUrl && preset.type === slot.modelType;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onUpdateConfig(applyDesktopPetModelSelection(config, slot.id, { modelType: preset.type, modelUrl: preset.url }))}
                className={`flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
                  isActive ? 'border-primary/50 bg-primary/10' : 'border-white/80 hub-glass-card hover:bg-white/80'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">{preset.name}</span>
                  <span className="text-2xs text-muted-foreground">{preset.type === '3d' ? '3D 模型' : preset.renderKind === 'video' ? '视频' : '2D 模型'}</span>
                </span>
                {isActive ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </HubSettingsPage>
  );
}

/* ---------------- 插件 ---------------- */

export function ChatHubPluginsPage({ currentPetId }: { currentPetId: string }) {
  return (
    <HubSettingsPage title="插件" description="查看、安装与管理插件" advancedPageId="extension-plugins">
      <Suspense fallback={<p className="py-10 text-center text-sm text-muted-foreground">加载中…</p>}>
        <SettingsExtensionHubTab category="plugins" currentPetId={currentPetId} />
      </Suspense>
    </HubSettingsPage>
  );
}

/* ---------------- 设置（常用项） ---------------- */

export function ChatHubQuickSettingsPage({ config, onUpdateConfig }: {
  config: PetConfig;
  onUpdateConfig: PetConfigUpdateHandler;
}) {
  const { settings } = config;
  const update = (patch: Partial<PetConfig['settings']>) => onUpdateConfig({ ...config, settings: { ...settings, ...patch } });
  const glassTransparency = clampUiGlassTransparency(settings.uiGlassTransparency);
  const modelName = settings.llmProvider === 'openai' ? (settings.customModelName?.trim() || settings.llmModel) : settings.llmModel;

  return (
    <HubSettingsPage title="设置" description="常用设置，改动立即生效">
      <div className="space-y-2">
        <SettingRow label="AI 模型" hint={modelName ? `当前：${modelName}` : '还没有配置'}>
          <button
            type="button"
            onClick={() => openSettingsPage('ai-model')}
            className="rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-xs text-foreground hover:bg-white"
          >
            在高级设置中配置
          </button>
        </SettingRow>
        <SettingRow label="语音播报" hint="角色回复时读出来">
          <SettingsToggleSwitch checked={settings.voiceEnabled} onChange={(checked) => update({ voiceEnabled: checked })} label="语音播报" hideLabel />
        </SettingRow>
        <SettingRow label="语音输入" hint="用麦克风和角色说话">
          <SettingsToggleSwitch checked={settings.voiceInputEnabled} onChange={(checked) => update({ voiceInputEnabled: checked })} label="语音输入" hideLabel />
        </SettingRow>
        <SettingRow label="显示头像" hint="聊天里显示双方头像">
          <SettingsToggleSwitch checked={settings.chatAvatarsEnabled} onChange={(checked) => update({ chatAvatarsEnabled: checked })} label="显示头像" hideLabel />
        </SettingRow>
        <SettingRow label="聊天背景图" hint="在聊天窗背后显示背景图">
          <SettingsToggleSwitch checked={settings.chatBackgroundImageEnabled} onChange={(checked) => update({ chatBackgroundImageEnabled: checked })} label="聊天背景图" hideLabel />
        </SettingRow>
        <SettingRow label="文字大小" hint={`${settings.chatFontSize}px`}>
          <Slider
            className="w-40"
            value={[settings.chatFontSize]}
            min={CHAT_FONT_SIZE_MIN}
            max={Math.min(CHAT_FONT_SIZE_MAX, Math.max(24, settings.chatFontSize))}
            step={1}
            aria-label="文字大小"
            onValueChange={(value) => update({ chatFontSize: value[0] })}
          />
        </SettingRow>
        <SettingRow label="气泡透明度" hint={`${settings.chatBubbleTransparency}%`}>
          <Slider
            className="w-40"
            value={[settings.chatBubbleTransparency]}
            min={0}
            max={100}
            step={5}
            aria-label="气泡透明度"
            onValueChange={(value) => update({ chatBubbleTransparency: value[0] })}
          />
        </SettingRow>
        <SettingRow label="界面透明度" hint={`玻璃面板的通透程度：${glassTransparency}%`}>
          <Slider
            className="w-40"
            value={[glassTransparency]}
            min={UI_GLASS_TRANSPARENCY_MIN}
            max={UI_GLASS_TRANSPARENCY_MAX}
            step={5}
            aria-label="界面透明度"
            onValueChange={(value) => update({ uiGlassTransparency: value[0] })}
          />
        </SettingRow>
      </div>
    </HubSettingsPage>
  );
}
