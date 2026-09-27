import { Route } from 'lucide-react';
import type { AgentSkillManifest, AgentSkillManifestEntry } from '../../agent/agentSkillManifest';
import type { PetConfig } from '../../types';
import { SettingsAgentSkillInstallValidationPanel } from './SettingsAgentSkillInstallValidationPanel';
import { SettingsAgentSkillPackageExchangePreview } from './SettingsAgentSkillPackageExchangePreview';
import { SettingsAgentSkillScaffoldPreview } from './SettingsAgentSkillScaffoldPreview';
import { SettingsSkillMcpProgressPanel } from './SettingsSkillMcpProgressPanel';

const RISK_LABELS: Record<AgentSkillManifestEntry['risk'], string> = {
  action: 'action', read: 'read', visual: 'visual',
};

const STAGE_LABELS: Record<AgentSkillManifestEntry['stage'], string> = {
  foundation: 'foundation', future: 'future', mvp: 'mvp',
};

function formatCountSummary(counts: Record<string, number>) {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${key}:${count}`)
    .join(' / ') || 'none';
}

function CompactMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-sm border border-border/80 bg-background/35 px-2 py-2">
      <div className="text-3xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-[12px] text-foreground">{value}</div>
    </div>
  );
}

function formatList(values: string[], emptyLabel: string, limit: number) {
  if (!values.length) return emptyLabel;
  return values.slice(0, limit).join(', ') + (values.length > limit ? ` +${values.length - limit}` : '');
}

function SkillManifestEntryRow({ entry }: { entry: AgentSkillManifestEntry }) {
  const routes = entry.preferredToolRoutes.length
    ? entry.preferredToolRoutes.map((route) => route.name).join(', ')
    : 'local runtime';

  return (
    <div className="rounded-sm border border-border/80 bg-background/30 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-2xs font-medium text-foreground">{entry.title}</div>
          <div className="mt-1 truncate font-mono text-3xs text-muted-foreground">{entry.id}</div>
        </div>
        <div className="flex shrink-0 gap-1 font-mono text-3xs">
          <span className="rounded-sm border border-border/70 px-1.5 py-0.5 text-primary">{STAGE_LABELS[entry.stage]}</span>
          <span className="rounded-sm border border-border/70 px-1.5 py-0.5 text-muted-foreground">{RISK_LABELS[entry.risk]}</span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-3xs text-muted-foreground">
        <Route className="h-3 w-3 shrink-0 text-primary" />
        <span className="truncate">{entry.routeSummary}</span>
      </div>
      <div className="mt-1 truncate text-3xs text-muted-foreground">tools {routes} / input {formatList(entry.inputKeys, 'no input', 8)}</div>
      <div className="mt-1 truncate text-3xs text-muted-foreground">package {entry.package.version} / {entry.package.installStatus} / {entry.package.runtime}</div>
      <div className="mt-1 truncate text-3xs text-muted-foreground">assets {formatList(entry.package.assetRequirements, 'none', 4)}</div>
    </div>
  );
}

function ManifestMetrics({ manifest }: { manifest: AgentSkillManifest }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <CompactMetric label="enabled" value={manifest.summary.defaultEnabledCount} />
      <CompactMetric label="tool routes" value={manifest.summary.toolRoutedCount} />
      <CompactMetric label="install" value={formatCountSummary(manifest.summary.installStatusCounts)} />
      <CompactMetric label="runtime" value={formatCountSummary(manifest.summary.runtimeCounts)} />
      <CompactMetric label="stages" value={formatCountSummary(manifest.summary.stageCounts)} />
      <CompactMetric label="risk" value={formatCountSummary(manifest.summary.riskCounts)} />
      <CompactMetric label="assets" value={Object.keys(manifest.summary.assetRequirementCounts).length} />
      <CompactMetric label="runtime deps" value={Object.keys(manifest.summary.runtimeRequirementCounts).length} />
    </div>
  );
}

interface SettingsAgentSkillDeveloperViewProps {
  localConfig: PetConfig;
  manifest: AgentSkillManifest;
  selectedSkillId: string;
  showMcpProgress: boolean;
  onSelectSkillId: (skillId: string) => void;
}

export function SettingsAgentSkillDeveloperView(props: SettingsAgentSkillDeveloperViewProps) {
  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <div>
        <div className="text-xs font-semibold text-foreground">高级能力开发与包管理</div>
        <div className="mt-1 text-2xs text-muted-foreground">包含 Manifest、路由、脚手架、签名包和运行时诊断。</div>
      </div>
      {props.showMcpProgress ? <SettingsSkillMcpProgressPanel /> : null}
      <ManifestMetrics manifest={props.manifest} />
      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {props.manifest.entries.map((entry) => <SkillManifestEntryRow key={entry.id} entry={entry} />)}
      </div>
      <SettingsAgentSkillScaffoldPreview
        selectedSkillId={props.selectedSkillId}
        skills={props.manifest.entries}
        onSelectSkillId={props.onSelectSkillId}
      />
      <SettingsAgentSkillPackageExchangePreview selectedSkillId={props.selectedSkillId} />
      <SettingsAgentSkillInstallValidationPanel localConfig={props.localConfig} />
    </div>
  );
}
