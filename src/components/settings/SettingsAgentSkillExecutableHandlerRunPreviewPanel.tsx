import { useState } from 'react';
import { PlayCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  runAgentSkillExecutableHandler,
  type AgentSkillExecutableHandlerRegistry,
  type AgentSkillExecutableHandlerRunResult,
  type AgentSkillInstalledPackageHandlerPreviewRegistry,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillInstalledPackageRuntimePolicy,
} from '../../agent';

function createDefaultInputJson(skillId: string) {
  return skillId === 'character.animation'
    ? '{"animationId":"wave"}'
    : '{}';
}

function formatRunResult(result: AgentSkillExecutableHandlerRunResult | null) {
  if (!result) {
    return 'dry-run idle';
  }
  if (result.error) {
    return `blocked / ${result.error}`;
  }
  return [
    result.result?.ok ? 'ok' : 'failed',
    result.handler?.handlerId ?? 'handler-missing',
    result.result?.marker ?? result.result?.summary ?? 'no-marker',
  ].join(' / ');
}

export function SettingsAgentSkillExecutableHandlerRunPreviewPanel({
  handlerRegistry,
  installedRegistry,
  policy,
  previewRegistry,
  trustedPackageIds,
}: {
  handlerRegistry: AgentSkillExecutableHandlerRegistry;
  installedRegistry: AgentSkillInstalledPackageRegistry;
  policy: AgentSkillInstalledPackageRuntimePolicy;
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry;
  trustedPackageIds?: readonly string[];
}) {
  const [inputJson, setInputJson] = useState('{"animationId":"wave"}');
  const [runResult, setRunResult] = useState<AgentSkillExecutableHandlerRunResult | null>(null);

  const runPreview = (skillId: string, packageId: string) => {
    setRunResult(runAgentSkillExecutableHandler(
      handlerRegistry,
      installedRegistry,
      policy,
      previewRegistry,
      { dryRun: true, inputJson, packageId, skillId },
      { trustedPackageIds },
    ));
  };

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <PlayCircle className="h-3 w-3 text-primary" />
          Handler dry-run preview
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          handlers {handlerRegistry.handlers.length}
        </div>
      </div>
      <textarea
        className="mb-2 h-16 w-full resize-y rounded-sm border border-border bg-background/50 p-2 font-mono text-3xs text-foreground outline-none"
        spellCheck={false}
        value={inputJson}
        onChange={(event) => setInputJson(event.target.value)}
      />
      <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
        {handlerRegistry.handlers.length ? handlerRegistry.handlers.map((handler) => (
          <div key={handler.packageId} className="flex items-center justify-between gap-2 rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
            <div className="min-w-0">
              <div className="truncate font-mono text-3xs text-foreground">{handler.skillId}</div>
              <div className="truncate text-3xs text-muted-foreground">{handler.handlerId}</div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => {
                if (!inputJson.trim()) {
                  setInputJson(createDefaultInputJson(handler.skillId));
                }
                runPreview(handler.skillId, handler.packageId);
              }}
            >
              Dry run
            </Button>
          </div>
        )) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No executable handlers registered for dry-run preview.
          </div>
        )}
      </div>
      <div className="mt-2 truncate rounded-sm border border-border/60 bg-secondary/10 px-2 py-1 font-mono text-3xs text-muted-foreground">
        {formatRunResult(runResult)}
      </div>
    </div>
  );
}
