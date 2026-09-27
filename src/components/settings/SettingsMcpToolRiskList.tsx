import { CheckCircle2, ShieldAlert } from 'lucide-react';
import {
  createAgentMcpPolicyLine,
  parseAgentMcpPolicyConfig,
} from '../../agent/agentMcpPolicy';
import {
  type AgentMcpToolRisk,
  summarizeAgentMcpToolRisk,
} from '../../agent/agentMcpRiskSummary';

interface SettingsMcpToolRiskListProps {
  config?: Record<string, unknown>;
  tools: DesktopPetMcpToolLike[];
}

function getApprovalLabel(approvalMode: 'confirm' | 'silent') {
  return approvalMode === 'silent' ? '静默' : '需确认';
}

function getRiskLabel(risk: AgentMcpToolRisk) {
  if (risk === 'destructive-like') {
    return '类破坏';
  }

  return risk === 'read' ? '只读' : '可逆写';
}

function getSourceLabel(source: 'external' | 'platform') {
  return source === 'platform' ? '平台' : '外部';
}

export function SettingsMcpToolRiskList({ config = {}, tools }: SettingsMcpToolRiskListProps) {
  if (!tools.length) {
    return (
      <div className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
        未检测到外部 MCP 工具。刷新后会显示来源、风险和审批方式。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tools.map((tool) => {
        const summary = summarizeAgentMcpToolRisk(tool);
        const policy = createAgentMcpPolicyLine(parseAgentMcpPolicyConfig(config), tool);
        const Icon = summary.approvalMode === 'silent' ? CheckCircle2 : ShieldAlert;
        const signalText = summary.schemaSignals.slice(0, 2).join(' / ');

        return (
          <div
            key={`${tool.serverId}/${tool.name}`}
            className="flex items-start gap-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2"
          >
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-2xs text-foreground">
                {tool.serverId}/{tool.name}
              </div>
              <div className="truncate text-2xs text-muted-foreground">{tool.title}</div>
              <div className="truncate text-3xs text-muted-foreground">
                {summary.riskReason}{signalText ? ` · ${signalText}` : ''}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1 text-3xs text-muted-foreground">
              <span>{getSourceLabel(summary.source)}</span>
              <span>{getRiskLabel(summary.risk)}</span>
              <span>{getApprovalLabel(summary.approvalMode)}</span>
              <span>{policy}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
