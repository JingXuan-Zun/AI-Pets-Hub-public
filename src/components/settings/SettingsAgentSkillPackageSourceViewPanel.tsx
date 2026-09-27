import { Layers3 } from 'lucide-react';
import {
  createAgentSkillPackageSourceView,
  type AgentSkillPackageDraftLibrary,
  type AgentSkillPackageSourceKind,
} from '../../agent';

const SOURCE_CLASS: Record<AgentSkillPackageSourceKind, string> = {
  bundled: 'text-muted-foreground',
  'enabled-draft': 'text-primary',
  'saved-draft': 'text-amber-500',
};

export function SettingsAgentSkillPackageSourceViewPanel({
  library,
}: {
  library: AgentSkillPackageDraftLibrary;
}) {
  const sourceView = createAgentSkillPackageSourceView(library);

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <Layers3 className="h-3 w-3 text-primary" />
          Package sources
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          bundled {sourceView.summary.bundled} / drafts {sourceView.summary['saved-draft']} / enabled {sourceView.summary['enabled-draft']}
        </div>
      </div>
      <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
        {sourceView.rows.map((row) => (
          <div key={row.skillId} className="flex items-center justify-between gap-2 rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
            <div className="min-w-0">
              <div className="truncate font-mono text-3xs text-foreground">{row.skillId}</div>
              <div className="truncate text-3xs text-muted-foreground">
                {row.version} / {row.runtime} / {row.installStatus}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className={`font-mono text-3xs ${SOURCE_CLASS[row.primarySource]}`}>{row.primarySource}</div>
              <div className="font-mono text-3xs text-muted-foreground">
                {row.enabledDraftCount}/{row.draftCount}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
