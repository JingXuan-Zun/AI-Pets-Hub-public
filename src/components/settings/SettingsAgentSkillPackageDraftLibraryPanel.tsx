import { Archive, Power, PowerOff, Trash2, XCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  createAgentSkillPackageDraftReview,
  type AgentSkillPackageDraft,
  type AgentSkillPackageDraftLibrary,
} from '../../agent';

const STATUS_CLASS = {
  blocked: 'text-red-400',
  ready: 'text-primary',
  warning: 'text-amber-500',
} as const;

function formatWarnings(warnings: string[]) {
  return warnings.length ? `warnings ${warnings.length}` : 'no warnings';
}

export function SettingsAgentSkillPackageDraftLibraryPanel({
  drafts,
  library,
  onClear,
  onRemove,
  onSetEnabled,
}: {
  drafts: AgentSkillPackageDraft[];
  library: AgentSkillPackageDraftLibrary;
  onClear: () => void;
  onRemove: (draftId: string) => void;
  onSetEnabled: (draftId: string, enabled: boolean) => void;
}) {
  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-secondary/20 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <Archive className="h-3 w-3 text-primary" />
          Draft library
        </div>
        <div className="flex items-center gap-1">
          <span className="font-mono text-3xs text-primary">{drafts.length}</span>
          <Button type="button" variant="ghost" size="icon-xs" title="Clear package drafts" disabled={!drafts.length} onClick={onClear}>
            <XCircle className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
        {drafts.length ? drafts.map((draft) => {
          const review = createAgentSkillPackageDraftReview(library, draft.id);
          const status = review?.status ?? 'blocked';
          const issueText = review?.issues[0]?.detail ?? 'No review issues.';

          return (
            <div key={draft.id} className="flex items-center justify-between gap-2 rounded-sm border border-border/60 bg-background/30 px-2 py-1">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-3xs text-foreground">{draft.skillId}</span>
                  <span className={`shrink-0 font-mono text-3xs ${STATUS_CLASS[status]}`}>{status}</span>
                  <span className="shrink-0 font-mono text-3xs text-primary">{draft.enabled ? 'enabled' : 'disabled'}</span>
                </div>
                <div className="truncate text-3xs text-muted-foreground">
                  {draft.package.scaffold.package.version} / {formatWarnings(draft.warnings)} / {draft.savedAt}
                </div>
                <div className="truncate text-3xs text-muted-foreground">{issueText}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  title={draft.enabled ? 'Disable package draft' : 'Enable reviewed package draft'}
                  disabled={!draft.enabled && !review?.eligible}
                  onClick={() => onSetEnabled(draft.id, !draft.enabled)}
                >
                  {draft.enabled ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                </Button>
                <Button type="button" variant="ghost" size="icon-xs" title="Remove package draft" onClick={() => onRemove(draft.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        }) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No saved package drafts.
          </div>
        )}
      </div>
    </div>
  );
}
