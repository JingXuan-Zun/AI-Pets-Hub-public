import type { AgentExternalSkillDefinition } from '../../agent/agentExternalSkillLibrary';
import type { AgentMcpServerDefinition } from '../../agent/agentMcpTypes';
import type { SettingsControlCenterPage, SettingsControlCenterPageId } from './settingsControlCenterNavigation';

export interface SettingsWorkspaceInspectorModuleGuide {
  affects: string[];
  note?: string;
  purpose: string;
  useCases: string[];
}

/**
 * 检查器的内容随控制中心当前页面切换。这里保存的是面向用户的说明，
 * 不参与设置写入或 Agent 权限判断。
 */
export const SETTINGS_WORKSPACE_INSPECTOR_MODULE_GUIDES: Record<
  SettingsControlCenterPageId,
  SettingsWorkspaceInspectorModuleGuide
> = {
  overview: {
    purpose: '查看桌宠软件的运行概况、版本和本地数据状态，快速确认当前环境是否正常。',
    useCases: ['首次使用时了解各功能入口', '遇到异常时先确认运行状态和版本'],
    affects: ['此页面以查看信息为主，不会直接改变桌宠行为'],
  },
  'ai-model': {
    purpose: '配置聊天所使用的 AI 服务商、模型和接口信息。',
    useCases: ['更换模型或服务商', '设置接口地址、密钥或模型名称'],
    affects: ['聊天回复的能力、速度和费用', '部分 Agent 与故事模式的推理质量'],
    note: '修改后请用一条普通聊天消息确认连接和回复是否正常。',
  },
  'ai-memory': {
    purpose: '管理桌宠在对话中保留多少上下文，以及如何使用角色记忆。',
    useCases: ['希望桌宠更连贯地记住前文', '需要减少上下文长度以节省模型消耗'],
    affects: ['连续对话的理解程度', '每次请求发送给模型的上下文量'],
  },
  'ai-knowledge': {
    purpose: '维护桌宠回答时可检索的角色知识和全局知识。',
    useCases: ['让桌宠了解设定、资料或工作规则', '更新过时知识后重新检索'],
    affects: ['回答引用的资料范围', '角色对特定主题的了解程度'],
  },
  'ai-vision-model': {
    purpose: '设置视觉识别使用的模型以及屏幕、图片等输入的处理方式。',
    useCases: ['让桌宠识别图片或屏幕内容', '调整视觉输入的模型和捕捉方式'],
    affects: ['图像理解质量和响应时间', '视觉输入的处理频率与资源消耗'],
  },
  'ai-voice-model': {
    purpose: '配置语音识别和语音合成，让桌宠可以听懂并说出内容。',
    useCases: ['切换 TTS 声音或语音服务', '启用麦克风语音输入'],
    affects: ['语音输入和播报的可用性', '声音风格、延迟与本地资源占用'],
  },
  'ai-tools-web': {
    purpose: '设置桌宠执行联网查询时使用的服务和请求方式。',
    useCases: ['配置搜索服务', '排查查询没有结果或连接失败'],
    affects: ['联网查询是否可用', '查询结果来源和响应速度'],
  },
  'desktop-role': {
    purpose: '编辑当前桌宠角色的基础资料、说话方式和人格提示。',
    useCases: ['创建或调整角色设定', '让桌宠用指定的语气、身份或关系回复'],
    affects: ['桌宠的聊天语气和角色表现', '故事模式中的角色行为倾向'],
  },
  'desktop-model-library': {
    purpose: '管理桌宠的模型预设，并导入或选择要显示的模型文件。',
    useCases: ['切换桌宠外观', '导入新的模型并保存为预设'],
    affects: ['桌宠显示的模型和外观', '模型资源的加载时间与内存占用'],
  },
  'desktop-motion-expression': {
    purpose: '设置桌宠动作、表情和对应资源的绑定关系。',
    useCases: ['给模型配置动作或表情文件', '调整回复时触发的动作表现'],
    affects: ['桌宠动作和表情的播放效果', '部分交互与回复的视觉反馈'],
  },
  'desktop-knowledge-personality': {
    purpose: '集中配置角色知识、记忆、人格和行为规划。',
    useCases: ['让角色长期保持设定', '调整角色在任务或故事中的决策倾向'],
    affects: ['角色理解上下文的方式', '对话、故事和 Agent 行为的角色一致性'],
  },
  'extension-overview': {
    purpose: '查看扩展能力的入口，了解可安装的插件、Skill 和外部连接。',
    useCases: ['寻找需要的扩展能力', '初步检查已安装扩展是否可用'],
    affects: ['此页面用于浏览和管理入口，不会自行启用外部能力'],
  },
  'extension-plugins': {
    purpose: '安装、启用、停用和管理平台插件。',
    useCases: ['添加新的桌宠功能', '排查插件造成的异常'],
    affects: ['插件提供的界面和能力是否加载', '可能影响启动时间和运行资源'],
  },
  'extension-deepseek-harness': {
    purpose: '配置 DeepSeek Harness 运行时，并选择在聊天中使用或打开独立工作区。',
    useCases: ['连接外部 Agent Runtime', '安装、查看和运行 Harness Agent'],
    affects: ['Harness Agent 的可用性和运行入口', '是否在桌宠聊天内执行或在独立面板操作'],
    note: '受控运行环境需要先完成运行时检查；独立工作区适合需要持续观察 Agent 状态的任务。',
  },
  'extension-personas': {
    purpose: '导入、分享和管理角色人格预设。',
    useCases: ['为桌宠套用一套完整角色设定', '保存并复用常用人格'],
    affects: ['角色的背景、语气和行为偏好'],
  },
  'extension-external': {
    purpose: '管理与 MCP、工作流和外部项目的连接方式。',
    useCases: ['接入外部工具或服务', '检查外部连接的状态'],
    affects: ['Agent 可发现和调用的外部能力', '外部服务是否可访问'],
  },
  'extension-resources': {
    purpose: '管理模型、声音、动作和视觉等资源包。',
    useCases: ['导入扩展资源', '整理或替换桌宠使用的资源'],
    affects: ['可选择的外观和媒体资源', '本地磁盘与加载资源占用'],
  },
  'platform-mcp': {
    purpose: '配置 MCP 服务，并查看服务提供的工具是否已发现。',
    useCases: ['接入文件、浏览器或其他外部工具', '排查 Agent 无法调用某个 MCP 工具'],
    affects: ['Agent 能使用的外部工具集合', '相关工具调用的连接状态'],
  },
  'platform-workflow': {
    purpose: '接入和管理 ComfyUI 等工作流服务。',
    useCases: ['让桌宠触发图像或自动化工作流', '检查工作流服务是否可连接'],
    affects: ['可运行的工作流和任务入口', '工作流执行的外部依赖'],
  },
  'platform-skills-api': {
    purpose: '导入、查看、启用和停用桌宠可用的 Skill。',
    useCases: ['从单个文件或压缩包安装 Skill', '检查已安装 Skill 的说明与来源'],
    affects: ['Agent 可以按需使用的专业能力', 'Skill 在当前桌宠上的启用状态'],
    note: '应用自带 Skill 不会作为桌宠单独安装项显示；检查器只补充当前桌宠安装的外部能力。',
  },
  'advanced-multi-agent': {
    purpose: '配置多人角色的关系、记忆和群聊行为。',
    useCases: ['让多个角色持续互动', '调整群聊中的角色关系和记忆'],
    affects: ['多角色对话的上下文与关系状态', '群聊中的发言和回应行为'],
  },
  'advanced-desktop-awareness': {
    purpose: '低频识别前台应用类别，并在合适时机触发桌宠主动互动。',
    useCases: ['浏览器或视频使用时发起闲聊', '长时间使用办公软件时提醒休息'],
    affects: ['桌宠主动互动的触发时机', '前台应用类别的本地只读感知'],
    note: '不读取网页正文、文档内容或屏幕画面。',
  },
  'advanced-game-companion': {
    purpose: '设置游戏陪玩时的观察频率和角色回应策略。',
    useCases: ['在游戏过程中让桌宠陪伴或提示', '降低游戏观察频率以减少资源消耗'],
    affects: ['游戏内容观察的频率', '陪玩回复的时机与内容'],
  },
  'advanced-expression': {
    purpose: '管理聊天表情包的回复比例、语义分类和图片资源。',
    useCases: ['调整表情包出现频率', '维护不同情绪使用的表情图片'],
    affects: ['聊天回复附带表情的概率', '表情图片与语义标签的匹配'],
  },
  'system-chat': {
    purpose: '调整桌宠聊天气泡中文字的颜色、大小和粗细。',
    useCases: ['提高文字可读性', '让聊天显示适配桌面主题或模型外观'],
    affects: ['聊天内容在桌面上的显示样式'],
  },
  'system-data': {
    purpose: '管理配置、资源和诊断数据，并执行备份或恢复操作。',
    useCases: ['迁移桌宠设置', '在修改前备份或排查数据问题'],
    affects: ['本地保存的配置和资源数据', '恢复操作会用备份内容覆盖对应数据'],
    note: '恢复前请确认备份来源和时间，避免覆盖刚修改的配置。',
  },
};

export function getSettingsWorkspaceInspectorModuleGuide(
  page: Pick<SettingsControlCenterPage, 'id'>,
): SettingsWorkspaceInspectorModuleGuide {
  return SETTINGS_WORKSPACE_INSPECTOR_MODULE_GUIDES[page.id];
}

export interface SettingsWorkspaceInspectorSkillItem {
  detail: string;
  id: string;
  status: string;
  title: string;
}

export interface SettingsWorkspaceInspectorMcpItem {
  id: string;
  status: string;
  title: string;
}

export function createSettingsWorkspaceInspectorSkillItems(
  skills: readonly Pick<AgentExternalSkillDefinition, 'id' | 'sourceName' | 'title'>[],
): SettingsWorkspaceInspectorSkillItem[] {
  return skills.map((skill) => ({
    detail: skill.sourceName,
    id: skill.id,
    status: '已启用 · 按需运行',
    title: skill.title,
  }));
}

export function createSettingsWorkspaceInspectorMcpItems(
  servers: readonly Pick<AgentMcpServerDefinition, 'id' | 'title' | 'tools'>[],
): SettingsWorkspaceInspectorMcpItem[] {
  return servers.map((server) => ({
    id: server.id,
    status: `已发现 · ${server.tools.length} 项工具`,
    title: server.title,
  }));
}
