import { ChevronDown } from 'lucide-react';
import { lazy, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { type DesktopPetSlot } from '../../multiPetRoster';
import { type PetConfig, type PetPersonality } from '../../types';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { SettingsGroupMemorySection } from './SettingsGroupMemorySection';
import { SettingsGroupTopicTimeline } from './SettingsGroupTopicTimeline';
import { SettingsDirectedRelationshipSection } from './SettingsDirectedRelationshipSection';
import { SettingsModelProviderTools } from './SettingsModelProviderTools';
import { SettingsOpenAIModelPicker } from './SettingsOpenAIModelPicker';
import { SettingsSocialEventTimeline } from './SettingsSocialEventTimeline';
import { SettingsSocialTrendPanel } from './SettingsSocialTrendPanel';
import { SettingsRelationshipEvidenceWindowPanel } from './SettingsRelationshipEvidenceWindowPanel';
import { SettingsGroupChatSpeed } from './SettingsGroupChatSpeed';
import { SettingsGroupSocialControls } from './SettingsGroupSocialControls';
import { DEFAULT_NEURAL_PERSONA_FEATURE_FLAGS } from '../../character-graph/neural-persona';
import { resolveNeuralPersonaSettingsPreviewEnabled } from './neuralPersonaPreviewGate';
import { NeuralMemoryChatToggle } from './NeuralMemoryChatToggle';
import { SettingsCharacterMemorySection } from './SettingsCharacterMemorySection';
import { inputClassName, selectClassName } from './settingsVoiceUtils';

const SettingsNeuralPersonaGraphSection = lazy(async () => {
  const module = await import('./SettingsNeuralPersonaGraphSection');
  return { default: module.SettingsNeuralPersonaGraphSection };
});

const NEURAL_PERSONA_FEEDBACK_PREVIEW_ENABLED = resolveNeuralPersonaSettingsPreviewEnabled(
  DEFAULT_NEURAL_PERSONA_FEATURE_FLAGS.feedbackEnabled,
  import.meta.env.VITE_NEURAL_PERSONA_FEEDBACK_PREVIEW,
);
const NEURAL_PERSONA_APPLICATION_PREVIEW_ENABLED = resolveNeuralPersonaSettingsPreviewEnabled(
  DEFAULT_NEURAL_PERSONA_FEATURE_FLAGS.learningApplicationEnabled,
  import.meta.env.VITE_NEURAL_PERSONA_APPLICATION_PREVIEW,
);
type CustomApiDraft = {
  modelName: string;
  apiUrl: string;
  apiKey: string;
};

type PersonalitySectionKey =
  | 'systemInstruction'
  | 'dialogueCompletionPreset'
  | 'beginDialogs'
  | 'customErrorMessage'
  | 'userMemory'
  | 'chatHistoryMemory'
  | 'knowledgeBase'
  | 'globalKnowledgeBase';

export type AiWorkspacePage = 'agent' | 'knowledge' | 'memory' | 'model' | 'prompt' | 'multi-agent';

const DEFAULT_EXPANDED_SECTIONS: Record<PersonalitySectionKey, boolean> = {
  systemInstruction: true,
  dialogueCompletionPreset: false,
  beginDialogs: false,
  customErrorMessage: false,
  userMemory: false,
  chatHistoryMemory: false,
  knowledgeBase: false,
  globalKnowledgeBase: false,
};

export interface SettingsPersonalityTabProps {
  customApiDraft: CustomApiDraft;
  customApiSaveFeedback: boolean;
  desktopPetSlots: DesktopPetSlot[];
  isCustomApiDirty: boolean;
  localConfig: PetConfig;
  noDragRegionStyle?: CSSProperties;
  onAddPetSlot: () => void;
  onApplyConfig: (config: PetConfig) => void;
  onCommitTraitsDraft: (value: string) => void;
  onRemovePetSlot: (slotId: string) => void;
  onSaveCustomApiSettings: () => void;
  onSelectPetSlot: (slotId: string) => void;
  onSetCustomApiDraft: Dispatch<SetStateAction<CustomApiDraft>>;
  onSetIsEditingTraits: (value: boolean) => void;
  onSetPetSlotAutoMovementEnabled: (slotId: string, enabled: boolean) => void;
  onSetPetSlotModelVisible: (slotId: string, visible: boolean) => void;
  onSetPetSlotPointerLookEnabled: (slotId: string, enabled: boolean) => void;
  onSetPetSlotEnabled: (slotId: string, enabled: boolean) => void;
  onSetTraitsDraft: (value: string) => void;
  onUpdatePersonality: (updates: Partial<PetPersonality>) => void;
  selectedPetSlot: DesktopPetSlot;
  selectedPetSlotId: string;
  traitsDraft: string;
  workspacePage?: AiWorkspacePage;
}

function memoryTextareaClassName() {
  return 'min-h-24 w-full rounded-sm border border-border bg-secondary p-3 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary';
}

function largeTextareaClassName() {
  return 'min-h-32 w-full rounded-sm border border-border bg-secondary p-3 font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary';
}

function buildUpdatedBeginDialogs(
  dialogs: PetPersonality['beginDialogs'],
  index: number,
  updates: Partial<PetPersonality['beginDialogs'][number]>,
) {
  return dialogs.map((dialog, dialogIndex) => (
    dialogIndex === index ? { ...dialog, ...updates } : dialog
  ));
}

function buildTextSummary(value: string) {
  const count = value.trim().length;
  return count > 0 ? `${count} 字` : '未设置';
}

function ClearMemoryButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className="h-7 rounded-full border border-border/70 px-3 text-2xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
    >
      一键清空
    </Button>
  );
}

function CollapsibleSection({
  title,
  description,
  summary,
  expanded,
  onToggle,
  actions,
  children,
  noDragRegionStyle,
}: {
  title: string;
  description: string;
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  actions?: ReactNode;
  children: ReactNode;
  noDragRegionStyle?: CSSProperties;
}) {
  const toggleTitle = `${expanded ? '收起' : '展开'}${title}`;

  return (
    <section className="rounded-sm border border-border bg-secondary/20">
      <div className="flex items-start gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={toggleTitle}
          title={toggleTitle}
          style={noDragRegionStyle}
          className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
              {title}
            </div>
            <div className="mt-1 text-2xs leading-4 text-muted-foreground">
              {description}
            </div>
          </div>
          <span className="shrink-0 font-mono text-2xs text-primary">
            {summary}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={toggleTitle}
            title={toggleTitle}
            style={noDragRegionStyle}
            className="flex h-8 w-8 items-center justify-center rounded-sm border border-primary/60 bg-primary text-primary-foreground shadow-[0_0_14px_rgba(0,209,255,0.18)] transition-colors hover:bg-primary/85 hover:text-primary-foreground"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-border px-4 py-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function SettingsPersonalityTab({
  customApiDraft,
  customApiSaveFeedback,
  desktopPetSlots,
  isCustomApiDirty,
  localConfig,
  noDragRegionStyle,
  onAddPetSlot,
  onApplyConfig,
  onCommitTraitsDraft,
  onRemovePetSlot,
  onSaveCustomApiSettings,
  onSelectPetSlot,
  onSetCustomApiDraft,
  onSetIsEditingTraits,
  onSetPetSlotAutoMovementEnabled,
  onSetPetSlotModelVisible,
  onSetPetSlotPointerLookEnabled,
  onSetPetSlotEnabled,
  onSetTraitsDraft,
  onUpdatePersonality,
  selectedPetSlot,
  selectedPetSlotId,
  traitsDraft,
  workspacePage,
}: SettingsPersonalityTabProps) {
  const { settings } = localConfig;
  // 唯一的二级页签由控制中心中栏维护；内容组件只按外部页面状态渲染。
  const activeWorkspacePage = workspacePage ?? 'model';
  const [expandedSections, setExpandedSections] = useState(DEFAULT_EXPANDED_SECTIONS);
  const isWorkspacePage = (page: AiWorkspacePage) => activeWorkspacePage === page;

  const applySettings = (updates: Partial<PetConfig['settings']>) => {
    onApplyConfig({
      ...localConfig,
      settings: {
        ...settings,
        ...updates,
      },
    });
  };

  const toggleSection = (section: PersonalitySectionKey) => {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  return (
    <div className="m-0 space-y-6">
      {isWorkspacePage('agent') ? <NeuralMemoryChatToggle
        enabled={selectedPetSlot.personality.neuralPersonaChatEnabled === true}
        onChange={(enabled) => onUpdatePersonality({ neuralPersonaChatEnabled: enabled })}
        roleName={selectedPetSlot.personality.name}
      /> : null}
      {isWorkspacePage('agent') ? <SettingsNeuralPersonaGraphSection
        applicationEnabled={NEURAL_PERSONA_APPLICATION_PREVIEW_ENABLED}
        enabled
        feedbackEnabled={NEURAL_PERSONA_FEEDBACK_PREVIEW_ENABLED}
        onProviderSettingsUpdate={applySettings}
        personality={selectedPetSlot.personality}
        roleId={selectedPetSlotId}
        settings={settings}
      /> : null}

      {isWorkspacePage('multi-agent') ? <SettingsGroupChatSpeed
        config={localConfig}
        noDragRegionStyle={noDragRegionStyle}
        onApplyConfig={onApplyConfig}
      /> : null}
      {isWorkspacePage('multi-agent') ? <SettingsGroupSocialControls
        config={localConfig}
        noDragRegionStyle={noDragRegionStyle}
        onApplyConfig={onApplyConfig}
      /> : null}

      {isWorkspacePage('prompt') ? <div className="space-y-2">
        <Label htmlFor="name" className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          角色名称
        </Label>
        <Input
          id="name"
          className={inputClassName()}
          style={noDragRegionStyle}
          value={selectedPetSlot.personality.name}
          onChange={(event) => onUpdatePersonality({ name: event.target.value })}
        />
      </div> : null}

      {isWorkspacePage('prompt') ? <div className="rounded-sm border border-border bg-secondary/20 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            性格特征
          </Label>
          <span className="font-mono text-2xs text-primary">
            {selectedPetSlot.personality.traits.join(' / ') || '未设置'}
          </span>
        </div>
        <Input
          id="traits"
          className={inputClassName()}
          style={noDragRegionStyle}
          value={traitsDraft}
          onFocus={() => onSetIsEditingTraits(true)}
          onChange={(event) => onSetTraitsDraft(event.target.value)}
          onBlur={(event) => onCommitTraitsDraft(event.target.value)}
          placeholder="例如：安静、灵动、贪吃"
        />
      </div> : null}

      <div className="space-y-3">
        {isWorkspacePage('prompt') ? <CollapsibleSection
          title="人格提示词"
          description="对齐 AstrBot 的 Persona Instructions，这里是当前角色最高优先级的人格本体。"
          summary={buildTextSummary(selectedPetSlot.personality.systemInstruction)}
          expanded={expandedSections.systemInstruction}
          onToggle={() => toggleSection('systemInstruction')}
          noDragRegionStyle={noDragRegionStyle}
        >
          <textarea
            id="instruction"
            className="h-36 w-full rounded-sm border border-border bg-secondary p-3 font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
            style={noDragRegionStyle}
            value={selectedPetSlot.personality.systemInstruction}
            onChange={(event) => onUpdatePersonality({ systemInstruction: event.target.value })}
          />
        </CollapsibleSection> : null}

        {isWorkspacePage('prompt') ? <CollapsibleSection
          title="对话补全预设"
          description="类似 SillyTavern 的补全预设。每轮正式角色回复固定注入，不会被神经节点拆分或激活状态影响。"
          summary={buildTextSummary(selectedPetSlot.personality.dialogueCompletionPreset ?? '')}
          expanded={expandedSections.dialogueCompletionPreset}
          onToggle={() => toggleSection('dialogueCompletionPreset')}
          noDragRegionStyle={noDragRegionStyle}
        >
          <textarea
            id="dialogue-completion-preset"
            className="h-40 w-full rounded-sm border border-border bg-secondary p-3 font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
            style={noDragRegionStyle}
            value={selectedPetSlot.personality.dialogueCompletionPreset ?? ''}
            onChange={(event) => onUpdatePersonality({ dialogueCompletionPreset: event.target.value })}
            placeholder="例如：始终用第一人称回应；保持指定的输出格式；不要解释系统规则；每次回复都遵守这些固定协议。"
          />
          <div className="mt-2 text-2xs leading-4 text-muted-foreground">
            这部分只服务于角色正式回复，不会进入神经记忆图谱。
          </div>
        </CollapsibleSection> : null}

        {isWorkspacePage('prompt') ? <CollapsibleSection
          title="预设对话"
          description="作为开场示例插入上下文，帮助稳定角色语气、格式和回应方式。"
          summary={`${selectedPetSlot.personality.beginDialogs.length} 组`}
          expanded={expandedSections.beginDialogs}
          onToggle={() => toggleSection('beginDialogs')}
          noDragRegionStyle={noDragRegionStyle}
          actions={(
            <Button
              type="button"
              size="sm"
              onClick={() => onUpdatePersonality({
                beginDialogs: [
                  ...selectedPetSlot.personality.beginDialogs,
                  { user: '', assistant: '' },
                ],
              })}
              style={noDragRegionStyle}
              className="h-7 rounded-full px-3 text-2xs"
            >
              添加
            </Button>
          )}
        >
          {selectedPetSlot.personality.beginDialogs.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border bg-secondary/20 px-3 py-3 text-2xs leading-4 text-muted-foreground">
              还没有预设对话。可以补几组“用户怎么说 / 角色怎么回”的例子，用来稳定口吻和格式。
            </div>
          ) : (
            <div className="space-y-3">
              {selectedPetSlot.personality.beginDialogs.map((dialog, index) => (
                <div key={`${dialog.user}:${dialog.assistant}`} className="space-y-2 rounded-sm border border-border bg-secondary/20 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-2xs text-primary">EXAMPLE {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onUpdatePersonality({
                        beginDialogs: selectedPetSlot.personality.beginDialogs.filter((_, dialogIndex) => dialogIndex !== index),
                      })}
                      style={noDragRegionStyle}
                      className="h-7 rounded-full px-3 text-2xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      删除
                    </Button>
                  </div>
                  <textarea
                    className="min-h-16 w-full rounded-sm border border-border bg-secondary p-3 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
                    style={noDragRegionStyle}
                    value={dialog.user}
                    onChange={(event) => onUpdatePersonality({
                      beginDialogs: buildUpdatedBeginDialogs(
                        selectedPetSlot.personality.beginDialogs,
                        index,
                        { user: event.target.value },
                      ),
                    })}
                    placeholder="用户示例：过来陪我一会儿"
                  />
                  <textarea
                    className="min-h-16 w-full rounded-sm border border-border bg-secondary p-3 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
                    style={noDragRegionStyle}
                    value={dialog.assistant}
                    onChange={(event) => onUpdatePersonality({
                      beginDialogs: buildUpdatedBeginDialogs(
                        selectedPetSlot.personality.beginDialogs,
                        index,
                        { assistant: event.target.value },
                      ),
                    })}
                    placeholder="角色示例：（轻轻靠近）我在这里，不走。"
                  />
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection> : null}

        {isWorkspacePage('prompt') ? <CollapsibleSection
          title="自定义错误回复"
          description="请求失败时优先显示这句话，而不是直接把系统报错暴露出来。"
          summary={selectedPetSlot.personality.customErrorMessage.trim() ? '已设置' : '未设置'}
          expanded={expandedSections.customErrorMessage}
          onToggle={() => toggleSection('customErrorMessage')}
          noDragRegionStyle={noDragRegionStyle}
        >
          <textarea
            className={memoryTextareaClassName()}
            style={noDragRegionStyle}
            value={selectedPetSlot.personality.customErrorMessage}
            onChange={(event) => onUpdatePersonality({ customErrorMessage: event.target.value })}
            placeholder="例如：（有些慌张地低下头）刚刚好像没听清，可以再说一次吗？【小声】"
          />
        </CollapsibleSection> : null}

        {isWorkspacePage('memory') ? <CollapsibleSection
          title="角色记忆库"
          description="只属于当前角色的长期记忆，会跟随当前选中的角色单独保存。"
          summary={buildTextSummary(selectedPetSlot.personality.userMemory)}
          expanded={expandedSections.userMemory}
          onToggle={() => toggleSection('userMemory')}
          noDragRegionStyle={noDragRegionStyle}
          actions={(
            <ClearMemoryButton
              disabled={!selectedPetSlot.personality.userMemory.trim()}
              onClick={() => onUpdatePersonality({ userMemory: '' })}
            />
          )}
        >
          <textarea
            className={memoryTextareaClassName()}
            style={noDragRegionStyle}
            value={selectedPetSlot.personality.userMemory}
            onChange={(event) => onUpdatePersonality({ userMemory: event.target.value })}
            placeholder="例如：用户喜欢被叫作小夏；不喜欢太正式的回答；最近在准备某个项目。"
          />
        </CollapsibleSection> : null}

        {isWorkspacePage('memory') ? <CollapsibleSection
          title="聊天记录记忆"
          description="沉淀对话里形成的偏好、约定和阶段性上下文，方便角色延续状态。"
          summary={buildTextSummary(selectedPetSlot.personality.chatHistoryMemory)}
          expanded={expandedSections.chatHistoryMemory}
          onToggle={() => toggleSection('chatHistoryMemory')}
          noDragRegionStyle={noDragRegionStyle}
          actions={(
            <ClearMemoryButton
              disabled={!selectedPetSlot.personality.chatHistoryMemory.trim()}
              onClick={() => onUpdatePersonality({ chatHistoryMemory: '' })}
            />
          )}
        >
          <textarea
            className={memoryTextareaClassName()}
            style={noDragRegionStyle}
            value={selectedPetSlot.personality.chatHistoryMemory}
            onChange={(event) => onUpdatePersonality({ chatHistoryMemory: event.target.value })}
            placeholder="例如：上次聊到用户正在调整桌宠聊天 UI，希望回复更短、更像角色本人。"
          />
        </CollapsibleSection> : null}

        {isWorkspacePage('memory') ? <SettingsCharacterMemorySection
          noDragRegionStyle={noDragRegionStyle}
          onUpdatePersonality={onUpdatePersonality}
          personality={selectedPetSlot.personality}
          settings={settings}
        /> : null}

        {isWorkspacePage('knowledge') ? <CollapsibleSection
          title="角色知识库"
          description="写入世界观、专业资料、项目规则，或这个角色必须知道的设定。"
          summary={buildTextSummary(selectedPetSlot.personality.knowledgeBase)}
          expanded={expandedSections.knowledgeBase}
          onToggle={() => toggleSection('knowledgeBase')}
          noDragRegionStyle={noDragRegionStyle}
          actions={(
            <ClearMemoryButton
              disabled={!selectedPetSlot.personality.knowledgeBase.trim()}
              onClick={() => onUpdatePersonality({ knowledgeBase: '' })}
            />
          )}
        >
          <textarea
            className={largeTextareaClassName()}
            style={noDragRegionStyle}
            value={selectedPetSlot.personality.knowledgeBase}
            onChange={(event) => onUpdatePersonality({ knowledgeBase: event.target.value })}
            placeholder="例如：角色背景、作品设定、项目文档摘要、常用术语解释。"
          />
        </CollapsibleSection> : null}

        {isWorkspacePage('multi-agent') ? <SettingsGroupMemorySection
          repository={localConfig.groupMemoryRepository}
          relationshipRepository={localConfig.directedRelationshipRepository}
          slots={desktopPetSlots}
          onChange={(groupMemoryRepository) => onApplyConfig({
            ...localConfig,
            groupMemoryRepository,
          })}
          noDragRegionStyle={noDragRegionStyle}
        /> : null}

        {isWorkspacePage('multi-agent') ? <SettingsDirectedRelationshipSection
          repository={localConfig.directedRelationshipRepository}
          slots={desktopPetSlots}
          onChange={(directedRelationshipRepository) => onApplyConfig({
            ...localConfig,
            directedRelationshipRepository,
          })}
          noDragRegionStyle={noDragRegionStyle}
        /> : null}

        {isWorkspacePage('multi-agent') ? <SettingsGroupTopicTimeline
          repository={localConfig.groupTopicRepository}
          roleNames={Object.fromEntries(desktopPetSlots.map((slot) => [slot.id, slot.personality.name]))}
          noDragRegionStyle={noDragRegionStyle}
        /> : null}

        {isWorkspacePage('multi-agent') ? <SettingsSocialEventTimeline
          directedRelationshipRepository={localConfig.directedRelationshipRepository}
          groupMemoryRepository={localConfig.groupMemoryRepository}
          groupTopicRepository={localConfig.groupTopicRepository}
          roleNames={Object.fromEntries(desktopPetSlots.map((slot) => [slot.id, slot.personality.name]))}
          noDragRegionStyle={noDragRegionStyle}
        /> : null}

        {isWorkspacePage('multi-agent') ? <SettingsSocialTrendPanel
          groupMemoryRepository={localConfig.groupMemoryRepository}
          relationshipRepository={localConfig.directedRelationshipRepository}
          roleNames={Object.fromEntries(desktopPetSlots.map((slot) => [slot.id, slot.personality.name]))}
          noDragRegionStyle={noDragRegionStyle}
        /> : null}

        {isWorkspacePage('multi-agent') ? <SettingsRelationshipEvidenceWindowPanel
          groupMemoryRepository={localConfig.groupMemoryRepository}
          repository={localConfig.directedRelationshipRepository}
          roleNames={Object.fromEntries(desktopPetSlots.map((slot) => [slot.id, slot.personality.name]))}
          noDragRegionStyle={noDragRegionStyle}
        /> : null}

        {isWorkspacePage('knowledge') ? <CollapsibleSection
          title="全局共享知识库"
          description="这份知识会被主角色和所有副角色共同使用，只需要维护一份。"
          summary={buildTextSummary(settings.globalKnowledgeBase)}
          expanded={expandedSections.globalKnowledgeBase}
          onToggle={() => toggleSection('globalKnowledgeBase')}
          noDragRegionStyle={noDragRegionStyle}
          actions={(
            <ClearMemoryButton
              disabled={!settings.globalKnowledgeBase.trim()}
              onClick={() => applySettings({ globalKnowledgeBase: '' })}
            />
          )}
        >
          <textarea
            className={largeTextareaClassName()}
            style={noDragRegionStyle}
            value={settings.globalKnowledgeBase}
            onChange={(event) => applySettings({ globalKnowledgeBase: event.target.value })}
            placeholder="例如：所有角色都需要知道的世界观、项目资料、固定设定、常用术语、用户偏好或长期规则。"
          />
        </CollapsibleSection> : null}
      </div>

      {isWorkspacePage('memory') ? <div className="space-y-4 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            记忆深度
          </Label>
          <span className="font-mono text-2xs text-primary">{settings.memoryDepth} TOKENS</span>
        </div>
        <select
          value={settings.memoryDepth}
          onChange={(event) => applySettings({ memoryDepth: Number.parseInt(event.target.value, 10) })}
          className={selectClassName()}
          style={noDragRegionStyle}
        >
          <option value={4096}>4096 Tokens</option>
          <option value={8192}>8192 Tokens（推荐）</option>
          <option value={16384}>16384 Tokens</option>
          <option value={32768}>32768 Tokens</option>
        </select>
      </div> : null}

       {isWorkspacePage('model') ? <div className="space-y-4 border-t border-border pt-4">
         <div className="flex items-center justify-between">
           <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
             模型接口
           </Label>
           <span className="font-mono text-2xs text-primary">
             {settings.llmProvider === 'gemini' ? 'GEMINI' : 'OPENAI COMPATIBLE'}
           </span>
         </div>
         <select
           value={settings.llmProvider}
           onChange={(event) => applySettings({ llmProvider: event.target.value as 'gemini' | 'openai' })}
           className={selectClassName()}
           style={noDragRegionStyle}
         >
           <option value="gemini">Gemini 协议</option>
           <option value="openai">OpenAI 兼容协议</option>
         </select>
       </div> : null}

      {isWorkspacePage('model') ? <div className="space-y-4 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
              当前模型
            </Label>
            <div className="mt-1 font-mono text-2xs text-primary">
               {settings.llmProvider === 'gemini'
                 ? (settings.llmModel || '未设置模型')
                 : (customApiDraft.modelName || '未设置模型')}
            </div>
          </div>
          <SettingsModelProviderTools
            customApiDraft={customApiDraft}
            noDragRegionStyle={noDragRegionStyle}
            settings={settings}
            onApplySettings={applySettings}
            onSetCustomApiDraft={onSetCustomApiDraft}
          />
        </div>

         {settings.llmProvider === 'gemini' ? (
           <div className="space-y-3">
             <select
               value={settings.llmModel}
               onChange={(event) => applySettings({ llmModel: event.target.value })}
               className={selectClassName()}
               style={noDragRegionStyle}
             >
               <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
               <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
               <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash Exp</option>
               <option value="gemini-1.0-pro">Gemini 1.0 Pro</option>
             </select>
             <Input
               type="password"
               className={inputClassName()}
               style={noDragRegionStyle}
               value={settings.geminiApiKey}
               onChange={(event) => applySettings({ geminiApiKey: event.target.value })}
               placeholder="Gemini API Key（由用户填写）"
               autoComplete="off"
             />
             <div className="rounded-sm border border-border bg-background/30 px-3 py-2 text-2xs text-muted-foreground">
               当前使用 Gemini 协议。API Key 只保存在本机。
             </div>
           </div>
         ) : (
          <div className="space-y-3">
            <SettingsOpenAIModelPicker
              apiKey={customApiDraft.apiKey}
              apiUrl={customApiDraft.apiUrl}
              inputClassName={inputClassName()}
              modelName={customApiDraft.modelName}
              noDragRegionStyle={noDragRegionStyle}
              onModelNameChange={(modelName) => onSetCustomApiDraft((current) => ({ ...current, modelName }))}
            />
            <Input
              className={inputClassName()}
              style={noDragRegionStyle}
              value={customApiDraft.apiUrl}
              onChange={(event) => onSetCustomApiDraft((current) => ({
                ...current,
                apiUrl: event.target.value,
              }))}
              placeholder="接口地址"
            />
            <Input
              type="password"
              className={inputClassName()}
              style={noDragRegionStyle}
              value={customApiDraft.apiKey}
              onChange={(event) => onSetCustomApiDraft((current) => ({
                ...current,
                apiKey: event.target.value,
              }))}
              placeholder="API Key"
            />
            <div className="flex items-center justify-between gap-3 rounded-sm border border-border bg-background/30 px-3 py-2">
              <div className="text-2xs text-muted-foreground">
                {isCustomApiDirty
                  ? '接口参数有未保存的改动。'
                  : (customApiSaveFeedback ? '接口参数已保存。' : '填写完成后点击保存即可生效。')}
              </div>
              <Button
                type="button"
                onClick={onSaveCustomApiSettings}
                disabled={!isCustomApiDirty}
                className="h-8 rounded-sm bg-primary px-3 text-2xs uppercase tracking-widest text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCustomApiDirty ? '保存接口' : (customApiSaveFeedback ? '已保存' : '保存接口')}
              </Button>
            </div>
           </div>
         )}
       </div> : null}
    </div>
  );
}
