import { useEffect, useMemo, useState } from 'react';
import { listExternalAgentMcpRegistry } from '../../agent/agentExternalMcpBridge';
import { loadEnabledAgentImportedSkills } from '../../agent/agentImportedSkillRuntime';
import type { AgentMcpServerDefinition } from '../../agent/agentMcpTypes';
import type { SettingsControlCenterModule, SettingsControlCenterPage } from './settingsControlCenterNavigation';
import {
  createSettingsWorkspaceInspectorMcpItems,
  createSettingsWorkspaceInspectorSkillItems,
  getSettingsWorkspaceInspectorModuleGuide,
} from './settingsWorkspaceInspectorContent';

export function SettingsWorkspaceInspector(props: {
  module: Pick<SettingsControlCenterModule, 'description' | 'label'>;
  page: SettingsControlCenterPage;
  petId: string;
}) {
  const skills = useMemo(
    () => loadEnabledAgentImportedSkills({ petId: props.petId }),
    [props.petId],
  );
  const [mcpServers, setMcpServers] = useState<AgentMcpServerDefinition[]>([]);
  useEffect(() => {
    let cancelled = false;
    void listExternalAgentMcpRegistry()
      .then((snapshot) => { if (!cancelled) setMcpServers(snapshot.servers); })
      .catch(() => { if (!cancelled) setMcpServers([]); });
    return () => { cancelled = true; };
  }, []);

  const skillItems = createSettingsWorkspaceInspectorSkillItems(skills);
  const mcpItems = createSettingsWorkspaceInspectorMcpItems(mcpServers);
  const guide = getSettingsWorkspaceInspectorModuleGuide(props.page);
  return (
    <section className="shrink-0 rounded-lg border border-border bg-card p-3 shadow-sm" aria-label="工作区检查器">
      <div className="text-2xs font-bold uppercase tracking-[0.12em] text-muted-foreground">工作区检查器</div>
      <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-2.5">
        <div className="text-2xs text-muted-foreground">{props.module.label} / {props.page.label}</div>
        <div className="mt-1 text-sm font-semibold text-foreground">模块说明</div>
        <p className="mt-1 text-2xs leading-5 text-muted-foreground">{guide.purpose}</p>
      </div>
      <InspectorGuideSection title="适合什么情况" items={guide.useCases} />
      <InspectorGuideSection title="会影响什么" items={guide.affects} />
      {guide.note ? <p className="mt-3 rounded-md border border-warning/25 bg-warning/10 px-2.5 py-2 text-2xs leading-5 text-foreground">提示：{guide.note}</p> : null}
      {skillItems.length ? (
        <section className="mt-3 border-t border-border pt-3" aria-label="当前桌宠已启用的外部 Skill">
          <div className="mb-1.5 text-2xs font-semibold text-foreground">当前桌宠已启用的外部 Skill</div>
          <div className="space-y-1.5">
            {skillItems.map((skill) => <InspectorItem key={skill.id} title={skill.title} detail={skill.detail} status={skill.status} />)}
          </div>
        </section>
      ) : null}
      {mcpItems.length ? (
        <section className="mt-3 border-t border-border pt-3" aria-label="已发现的外部 MCP">
          <div className="mb-1.5 text-2xs font-semibold text-foreground">外部 MCP</div>
          <div className="space-y-1.5">
            {mcpItems.map((server) => <InspectorItem key={server.id} title={server.title} detail={server.id} status={server.status} />)}
          </div>
        </section>
      ) : null}
      {!skillItems.length && !mcpItems.length ? <p className="mt-3 border-t border-border pt-3 text-2xs leading-5 text-muted-foreground">当前桌宠没有已接入的外部 Skill 或 MCP；上方内容会随你选择的设置模块更新。</p> : null}
    </section>
  );
}

function InspectorGuideSection(props: { items: string[]; title: string }) {
  return (
    <section className="mt-3" aria-label={props.title}>
      <div className="mb-1 text-2xs font-semibold text-foreground">{props.title}</div>
      <ul className="space-y-1 text-2xs leading-5 text-muted-foreground">
        {props.items.map((item) => <li key={item} className="flex gap-1.5"><span className="text-primary">•</span><span>{item}</span></li>)}
      </ul>
    </section>
  );
}

function InspectorItem(props: { detail: string; status: string; title: string }) {
  return (
    <div className="rounded-md border border-border bg-background/50 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-2xs font-semibold text-foreground">{props.title}</span>
        <span className="shrink-0 text-2xs text-primary">{props.status}</span>
      </div>
      <div className="mt-1 truncate font-mono text-2xs text-muted-foreground" title={props.detail}>{props.detail}</div>
    </div>
  );
}
