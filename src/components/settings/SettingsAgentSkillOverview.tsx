import { CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';
import type { AgentSkillManifest, AgentSkillManifestEntry } from '../../agent/agentSkillManifest';

const SKILL_COPY: Partial<Record<AgentSkillManifestEntry['id'], { description: string; title: string }>> = {
  'character.animation': { title: '角色动作', description: '让桌宠执行动作、舞蹈和表情。' },
  'desktop.observation': { title: '桌面观察', description: '查看窗口和屏幕内容，帮助理解当前桌面。' },
  'game.companion': { title: '游戏陪伴', description: '分析游戏画面并提供低频陪伴提示。' },
  'local.files': { title: '本地文件', description: '读取和查找你明确允许访问的本地文件。' },
  'memory.manage': { title: '记忆管理', description: '按你的要求读取、记住或忘记信息。' },
  'mcp.tool': { title: '外部工具调用', description: '在确认权限后使用已连接的外部工具。' },
  'platform.capability-router': { title: '能力调度', description: '根据需求选择合适的内置能力或外部工具。' },
  'voice.control': { title: '语音控制', description: '管理语音输入、朗读方式和本地语音状态。' },
};

function getSkillState(entry: AgentSkillManifestEntry) {
  if (entry.stage === 'future' || entry.package.installStatus === 'planned') {
    return { label: '规划中', ready: false };
  }
  if (entry.package.installStatus === 'external-required') {
    return { label: '需要配置', ready: false };
  }
  return { label: entry.defaultEnabled ? '已可用' : '未启用', ready: entry.defaultEnabled };
}

function getPermissionHint(entry: AgentSkillManifestEntry) {
  if (entry.risk === 'action') return '执行操作前会确认';
  if (entry.risk === 'visual') return '使用画面时会提示';
  return '只读访问';
}

function SkillCard({ entry }: { entry: AgentSkillManifestEntry }) {
  const copy = SKILL_COPY[entry.id] ?? { title: entry.title, description: entry.description };
  const state = getSkillState(entry);
  const StateIcon = state.ready ? CheckCircle2 : Clock3;

  return (
    <div className="rounded-sm border border-border bg-background/45 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-foreground">{copy.title}</div>
          <div className="mt-1 text-2xs leading-5 text-muted-foreground">{copy.description}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-2xs text-primary">
          <StateIcon className="h-3.5 w-3.5" />
          {state.label}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-3xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        {getPermissionHint(entry)}
      </div>
    </div>
  );
}

export function SettingsAgentSkillOverview({ manifest }: { manifest: AgentSkillManifest }) {
  return (
    <div className="space-y-3">
      <div className="rounded-sm border border-primary/20 bg-primary/5 px-3 py-2 text-2xs leading-5 text-muted-foreground">
        能力用于让桌宠完成具体任务。内置能力默认受权限保护；需要额外安装或配置的能力会单独提示。
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {manifest.entries.map((entry) => <SkillCard key={entry.id} entry={entry} />)}
      </div>
    </div>
  );
}
