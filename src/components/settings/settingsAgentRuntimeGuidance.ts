export interface DeepSeekHarnessSetupValues {
  apiKey: string;
  dshHome: string;
  workspace: string;
}

export type DeepSeekHarnessSetupGapId = 'workspace' | 'dsh-home' | 'api-key';

export interface DeepSeekHarnessSetupGap {
  detail: string;
  id: DeepSeekHarnessSetupGapId;
  label: string;
}

export const NATIVE_RUNTIME_CHAT_USAGE = 'Native Runtime 是桌宠 Agent 的默认模式。它不需要额外配置；在桌宠聊天中切换到 Agent 后发送任务，即可使用现有的桌面、浏览器、MCP 和已启用 Skill 能力。';

export const DEEPSEEK_HARNESS_CHAT_USAGE = 'DeepSeek Harness 也在同一个桌宠聊天里执行，不会打开独立窗口。它适合让外部 SDK 读取和分析指定 Workspace 内的文本文件；当前受控桥接不提供桌面操作、浏览器、MCP、Skill、文件写入或角色记忆。';

const SETUP_GAPS: readonly DeepSeekHarnessSetupGap[] = [
  { detail: '选择允许 Harness 读取的工作目录；它不能访问目录以外的文件。', id: 'workspace', label: 'Workspace' },
  { detail: '选择一个专用配置目录；验证时会在其中写入受控 Profile。', id: 'dsh-home', label: 'DSH_HOME' },
  { detail: '仅本机保存，用于调用 DeepSeek 服务。', id: 'api-key', label: 'DeepSeek API Key' },
];

export function getDeepSeekHarnessSetupGaps(values: DeepSeekHarnessSetupValues) {
  return SETUP_GAPS.filter((item) => {
    if (item.id === 'workspace') return !values.workspace.trim();
    if (item.id === 'dsh-home') return !values.dshHome.trim();
    return !values.apiKey.trim();
  });
}
