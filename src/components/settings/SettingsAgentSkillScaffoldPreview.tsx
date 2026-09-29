import { FileJson } from 'lucide-react';
import {
  createAgentSkillAuthoringScaffold,
  type AgentSkillAuthoringScaffold,
} from '../../agent/agentSkillAuthoringScaffold';
import { type AgentSkillManifestEntry } from '../../agent/agentSkillManifest';

function formatScaffoldJson(scaffold: AgentSkillAuthoringScaffold | null) {
  return scaffold
    ? JSON.stringify(scaffold, null, 2)
    : 'Select a Skill to preview its authoring scaffold.';
}

export function SettingsAgentSkillScaffoldPreview({
  selectedSkillId,
  skills,
  onSelectSkillId,
}: {
  selectedSkillId: string;
  skills: AgentSkillManifestEntry[];
  onSelectSkillId: (skillId: string) => void;
}) {
  const scaffold = createAgentSkillAuthoringScaffold(selectedSkillId);

  return (
    <div className="mt-3 rounded-sm border border-border/80 bg-background/25 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          <FileJson className="h-3.5 w-3.5 text-primary" />
          Scaffold preview
        </div>
        <select
          className="h-8 rounded-sm border border-border bg-background px-2 font-mono text-2xs text-foreground outline-none"
          value={selectedSkillId}
          onChange={(event) => onSelectSkillId(event.target.value)}
        >
          {skills.map((entry) => (
            <option key={entry.id} value={entry.id}>{entry.id}</option>
          ))}
        </select>
      </div>
      <pre className="max-h-56 overflow-auto rounded-sm border border-border/70 bg-secondary/20 p-2 text-3xs text-muted-foreground">
        {formatScaffoldJson(scaffold)}
      </pre>
    </div>
  );
}
