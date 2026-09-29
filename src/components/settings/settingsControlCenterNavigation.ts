import type { SettingsPanelTabValue } from './SettingsPanelTabSections';

export type SettingsControlCenterModuleId =
  | 'dashboard'
  | 'ai'
  | 'desktop'
  | 'platform'
  | 'advanced'
  | 'system';

export type SettingsControlCenterPageId =
  | 'overview'
  | 'ai-model'
  | 'ai-memory'
  | 'ai-knowledge'
  | 'ai-vision-model'
  | 'ai-voice-model'
  | 'ai-tools-web'
  | 'desktop-role'
  | 'desktop-model-library'
  | 'desktop-motion-expression'
  | 'desktop-knowledge-personality'
  | 'platform-mcp'
  | 'platform-workflow'
  | 'platform-skills-api'
  | 'extension-overview'
  | 'extension-plugins'
  | 'extension-deepseek-harness'
  | 'extension-personas'
  | 'extension-external'
  | 'extension-resources'
  | 'advanced-multi-agent'
  | 'advanced-game-companion'
  | 'advanced-desktop-awareness'
  | 'advanced-expression'
  | 'system-chat'
  | 'system-data';

export type SettingsPersonalityWorkspacePage = 'agent' | 'knowledge' | 'memory' | 'model' | 'prompt' | 'multi-agent';

export interface SettingsControlCenterPage {
  description: string;
  id: SettingsControlCenterPageId;
  label: string;
  personalityWorkspacePage?: SettingsPersonalityWorkspacePage;
  runtimeTab: SettingsPanelTabValue;
  workspaceTitle: string;
}

export interface SettingsControlCenterModule {
  description: string;
  headerMetrics: Array<{ label: string; value: string }>;
  id: SettingsControlCenterModuleId;
  label: string;
  pages: SettingsControlCenterPage[];
}

/**
 * 与 ui--------zs/app.js 同构的控制中心路由。
 * 每一个 page 都是一个单独的内容入口，runtimeTab 指向当前已存在的真实功能组件。
 */
export const SETTINGS_CONTROL_CENTER_MODULES: SettingsControlCenterModule[] = [
  {
    id: 'dashboard', label: '总览', description: '系统总览',
    headerMetrics: [
      { label: '当前桌宠', value: '$pet' },
      { label: 'AI', value: '在线' },
      { label: '运行时', value: '健康' },
      { label: '警告', value: '0' },
    ],
    pages: [
      { id: 'overview', label: '软件总览', description: '调用、运行、版本与私人数据', runtimeTab: 'system', workspaceTitle: '软件概览' },
    ],
  },
  {
    id: 'ai', label: 'AI', description: '智能中枢',
    headerMetrics: [
      { label: '模型', value: '$aiModel' },
      { label: 'Agent', value: '运行中' },
      { label: '记忆', value: '开启' },
      { label: '知识库', value: '开启' },
    ],
    pages: [
      { id: 'ai-model', label: '模型', description: '供应商、模型和接口', runtimeTab: 'personality', personalityWorkspacePage: 'model', workspaceTitle: 'AI 工作区' },
      { id: 'ai-memory', label: '记忆', description: '角色与聊天上下文', runtimeTab: 'personality', personalityWorkspacePage: 'memory', workspaceTitle: '记忆工作区' },
      { id: 'ai-knowledge', label: '知识库', description: '角色知识与全局知识', runtimeTab: 'personality', personalityWorkspacePage: 'knowledge', workspaceTitle: '知识库工作区' },
      { id: 'ai-vision-model', label: '视觉模型', description: '视觉模型路由与捕捉', runtimeTab: 'vision', workspaceTitle: '视觉模型工作区' },
      { id: 'ai-voice-model', label: '语音模型', description: 'TTS、STT 与本地语音', runtimeTab: 'voice', workspaceTitle: '语音工作区' },
      { id: 'ai-tools-web', label: '联网查询', description: '查询方式与联网服务', runtimeTab: 'system', workspaceTitle: '联网查询工作区' },
    ],
  },
  {
    id: 'desktop', label: '桌宠', description: '桌宠管理',
    headerMetrics: [
      { label: 'Pet', value: '$pet' },
      { label: '模型', value: '$petModel' },
      { label: '动作', value: '$action' },
      { label: 'Vision', value: 'ON' },
    ],
    pages: [
      { id: 'desktop-role', label: '角色', description: '角色基本状态与人格入口', runtimeTab: 'personality', personalityWorkspacePage: 'prompt', workspaceTitle: '角色工作区' },
      { id: 'desktop-model-library', label: '模型库', description: '模型预设与导入', runtimeTab: 'model', workspaceTitle: '模型库工作区' },
      { id: 'desktop-motion-expression', label: '动作表情', description: '动作绑定与表情文件', runtimeTab: 'motion-expression', workspaceTitle: '动作表情工作区' },
      { id: 'desktop-knowledge-personality', label: '知识记忆人格', description: '知识、记忆、人格与行为规划', runtimeTab: 'personality', personalityWorkspacePage: 'agent', workspaceTitle: '知识记忆人格工作区' },
    ],
  },
  {
    id: 'platform', label: '扩展', description: '插件、人格、外部接入与资源',
    headerMetrics: [
      { label: '插件', value: '市场筹备' },
      { label: '人格', value: '可分享' },
      { label: '外部接入', value: '按需连接' },
      { label: '资源包', value: '持续扩展' },
    ],
    pages: [
      { id: 'extension-overview', label: '扩展总览', description: '发现、安装与管理平台扩展', runtimeTab: 'system', workspaceTitle: '扩展中心' },
      { id: 'extension-plugins', label: '插件', description: '查看、安装与管理平台插件', runtimeTab: 'system', workspaceTitle: '插件扩展' },
      { id: 'extension-deepseek-harness', label: 'DeepSeek Harness', description: '配置外部 Agent Runtime 适配器', runtimeTab: 'system', workspaceTitle: 'DeepSeek Harness 工作区' },
      { id: 'extension-personas', label: '人格分享', description: '发现和导入角色人格预设', runtimeTab: 'system', workspaceTitle: '人格分享' },
      { id: 'extension-external', label: '外部接入', description: '连接 MCP、工作流与外部项目', runtimeTab: 'system', workspaceTitle: '外部接入' },
      { id: 'extension-resources', label: '资源包', description: '模型、声音、动作与视觉资源', runtimeTab: 'system', workspaceTitle: '资源包' },
      { id: 'platform-mcp', label: 'MCP 管理', description: '连接工具来源并查看是否可用', runtimeTab: 'system', workspaceTitle: 'MCP 管理' },
      { id: 'platform-workflow', label: '工作流管理', description: 'ComfyUI 工作流接入', runtimeTab: 'system', workspaceTitle: 'ComfyUI 工作流管理' },
      { id: 'platform-skills-api', label: 'Skills', description: '导入、启用和管理 Skill', runtimeTab: 'system', workspaceTitle: 'Skills' },
    ],
  },
  {
    id: 'advanced', label: '高级', description: '高级配置',
    headerMetrics: [
      { label: '功能页', value: '3' },
      { label: '表情库', value: '可管理' },
      { label: '文件服务', value: '已接入' },
      { label: '目录模式', value: '2 种' },
    ],
    pages: [
      { id: 'advanced-multi-agent', label: '多人系统', description: '群体记忆、关系与群聊', runtimeTab: 'personality', personalityWorkspacePage: 'multi-agent', workspaceTitle: '多人关系工作区' },
      { id: 'advanced-desktop-awareness', label: '桌面感知', description: '识别前台应用类别并主动互动', runtimeTab: 'system', workspaceTitle: '桌面活动感知' },
      { id: 'advanced-game-companion', label: '陪玩', description: '游戏观察频率与角色回应', runtimeTab: 'system', workspaceTitle: '游戏陪玩工作区' },
      { id: 'advanced-expression', label: '表情包', description: '回复比例、分类语义与图片库', runtimeTab: 'system', workspaceTitle: '表情包工作区' },
    ],
  },
  {
    id: 'system', label: '系统', description: '系统运行',
    headerMetrics: [
      { label: '运行时', value: '健康' },
      { label: 'FPS', value: '60' },
      { label: '内存', value: '512 MB' },
      { label: '日志', value: '实时' },
    ],
    pages: [
      { id: 'system-chat', label: '聊天显示', description: '聊天文字颜色、大小与粗细', runtimeTab: 'system', workspaceTitle: '聊天显示工作区' },
      { id: 'system-data', label: '数据与备份', description: '配置、资源与诊断数据', runtimeTab: 'system', workspaceTitle: '数据工作区' },
    ],
  },
];

export const DEFAULT_SETTINGS_CONTROL_CENTER_PAGE_ID: SettingsControlCenterPageId = 'overview';

export function getSettingsControlCenterPage(pageId: SettingsControlCenterPageId) {
  for (const module of SETTINGS_CONTROL_CENTER_MODULES) {
    const page = module.pages.find((candidate) => candidate.id === pageId);
    if (page) return page;
  }
  return SETTINGS_CONTROL_CENTER_MODULES[0].pages[0];
}

export function getSettingsControlCenterModule(pageId: SettingsControlCenterPageId) {
  return SETTINGS_CONTROL_CENTER_MODULES.find((module) => module.pages.some((page) => page.id === pageId))
    ?? SETTINGS_CONTROL_CENTER_MODULES[0];
}
