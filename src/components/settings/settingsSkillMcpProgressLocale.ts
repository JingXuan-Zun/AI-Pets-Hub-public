import type {
  SettingsSkillMcpProgressArea,
  SettingsSkillMcpProgressImportedSummary,
  SettingsSkillMcpProgressItem,
} from './settingsSkillMcpProgress';

const AREA_LABELS: Record<SettingsSkillMcpProgressArea, string> = {
  'mcp-foundation': 'MCP 基础能力',
  'mcp-safety': 'MCP 安全与可见性',
  'role-skill-performance': '角色 Skill 演出',
  'skill-foundation': 'Skill 基础能力',
};

const STATUS_LABELS: Record<SettingsSkillMcpProgressItem['status'], string> = {
  'near-complete': '接近完成',
  partial: '部分完成',
};

const BLOCKER_LABELS: Record<SettingsSkillMcpProgressArea, string> = {
  'mcp-foundation': '官方打包版只读覆盖仍是 0/2；非 exe 打包主进程 harness 已通过，但不能替代正式打包证据。',
  'mcp-safety': '核心安全链路已较完整，剩余主要是长时间会话恢复和体验打磨。',
  'role-skill-performance': '完整多轨编辑、多角色编排和更深入的音频同步工具还没完成。',
  'skill-foundation': '外部包代码执行和市场级安装/更新仍不进入当前收尾范围。',
};

const EVIDENCE_LABELS: Record<SettingsSkillMcpProgressArea, string> = {
  'mcp-foundation': '已有 MCP facade、stdio 运行时、配置 UI、生命周期/历史、真实 filesystem 与 memory soak、策略一致性、生命周期硬化、31 分钟打包长跑报告、非 exe harness 对比等证据。',
  'mcp-safety': '已有审批门、风险摘要、执行回执、取消、策略预设、历史保留、诊断、批量策略和会话池可见性。',
  'role-skill-performance': '已有角色动画路由、时间线调度、音频同步、表情 cue、编辑器控件，以及 Unity/3D/Live2D 合约 smoke。',
  'skill-foundation': '已有 manifest、包元数据、安装门禁、签名保护、禁用沙箱报告、本地 resolver handler dry-run 等证据。',
};

const NEXT_STEP_LABELS: Record<SettingsSkillMcpProgressArea, string> = {
  'mcp-foundation': '先处理打包版 child-process 启动和官方只读覆盖，再考虑上调 MCP 基础进度。',
  'mcp-safety': '结合打包长跑证据判断是否还需要继续加固后端失败恢复。',
  'role-skill-performance': '继续用小切片推进时间线编辑能力，并保持 smoke 覆盖。',
  'skill-foundation': '当前阶段按受控集成收尾；外部包执行要等沙箱、loader 隔离、回滚和签名更新证据齐全。',
};

export function formatSettingsSkillMcpAreaLabel(area: SettingsSkillMcpProgressArea) {
  return AREA_LABELS[area];
}

export function formatSettingsSkillMcpStatusLabel(status: SettingsSkillMcpProgressItem['status']) {
  return STATUS_LABELS[status];
}

export function formatSettingsSkillMcpBlocker(item: SettingsSkillMcpProgressItem) {
  return BLOCKER_LABELS[item.area] ?? item.blocker;
}

export function formatSettingsSkillMcpEvidence(item: SettingsSkillMcpProgressItem) {
  return EVIDENCE_LABELS[item.area] ?? item.evidence;
}

export function formatSettingsSkillMcpNextStep(item: SettingsSkillMcpProgressItem) {
  return NEXT_STEP_LABELS[item.area] ?? item.nextStep;
}

export function formatSettingsSkillMcpSummaryStatus(summary: SettingsSkillMcpProgressImportedSummary) {
  const statusCounts = summary.statusText
    .replace('near-complete', '接近完成')
    .replace('partial', '部分完成');

  return `${summary.itemCount} 个领域 / ${statusCounts}`;
}

export function formatSettingsSkillMcpImportDetail(summary: SettingsSkillMcpProgressImportedSummary) {
  return summary.currentMatch
    ? '导入的进度证据与当前内置进度一致。'
    : `${summary.mismatchCount} 个进度领域与当前内置进度不一致。`;
}
