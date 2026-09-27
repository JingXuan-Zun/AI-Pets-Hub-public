import { useEffect, useState } from 'react';
import { AlertTriangle, Eye, ListMusic } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { type PetConfig } from '../../types';
import { SettingsSkillTimelineEditor } from './SettingsSkillTimelineEditor';
import {
  createDefaultSkillTimelinePreviewInput,
  createSkillTimelinePreview,
  type SkillTimelinePreviewResult,
} from './settingsSkillTimelinePreviewUtils';

function formatDelay(delayMs: number | null) {
  return delayMs === null ? '--' : `${delayMs}ms`;
}

function PreviewMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-sm border border-border/80 bg-background/35 px-2 py-2">
      <div className="text-3xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-[12px] text-foreground">{value}</div>
    </div>
  );
}

function PreviewStepList({ result }: { result: SkillTimelinePreviewResult }) {
  if (result.stepRows.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-border/80 bg-background/20 px-3 py-5 text-2xs text-muted-foreground">
        No timeline steps resolved yet.
      </div>
    );
  }

  return (
    <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
      {result.stepRows.slice(0, 8).map((step, index) => (
        <div key={`${step.label}-${index}`} className="rounded-sm border border-border/80 bg-background/30 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-2xs font-medium text-foreground">{step.label}</span>
            <span className="font-mono text-2xs text-primary">{formatDelay(step.delayMs)}</span>
          </div>
          <div className="mt-1 truncate text-3xs text-muted-foreground">
            motion {step.motionCandidates.join(', ') || '-'} / expression {step.expressionCandidates.join(', ') || '-'}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SettingsSkillTimelinePreviewPanel({
  localConfig,
  selectedPetSlotId,
}: {
  localConfig: PetConfig;
  selectedPetSlotId: string;
}) {
  const [inputJson, setInputJson] = useState(() => createDefaultSkillTimelinePreviewInput(localConfig, selectedPetSlotId));
  const [result, setResult] = useState<SkillTimelinePreviewResult | null>(null);

  useEffect(() => {
    setInputJson(createDefaultSkillTimelinePreviewInput(localConfig, selectedPetSlotId));
    setResult(null);
  }, [localConfig, selectedPetSlotId]);

  const runPreview = () => {
    setResult(createSkillTimelinePreview({
      config: localConfig,
      inputJson,
      targetPetId: selectedPetSlotId,
    }));
  };

  return (
    <div className="rounded-sm border border-border bg-secondary/15 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">Skill timeline preview</Label>
          <div className="mt-1 text-xs text-muted-foreground">
            Dry-run a choreography JSON before the Agent executes it.
          </div>
        </div>
        <Button type="button" className="h-8 rounded-sm px-3 text-2xs uppercase tracking-widest" onClick={runPreview}>
          <Eye className="mr-1 h-3.5 w-3.5" />
          Preview
        </Button>
      </div>

      <SettingsSkillTimelineEditor
        inputJson={inputJson}
        localConfig={localConfig}
        selectedPetSlotId={selectedPetSlotId}
        onChangeInputJson={setInputJson}
      />

      <textarea
        className="mt-3 h-36 w-full resize-y rounded-sm border border-border bg-background/50 px-3 py-2 font-mono text-2xs text-foreground outline-none focus:border-primary"
        spellCheck={false}
        value={inputJson}
        onChange={(event) => setInputJson(event.target.value)}
      />

      {result ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <PreviewMetric label="status" value={result.ok ? 'ok' : 'review'} />
            <PreviewMetric label="animations" value={result.animationIds.length} />
            <PreviewMetric label="steps" value={result.stepRows.length} />
            <PreviewMetric label="schedule" value={result.scheduleCount} />
          </div>
          {result.error ? (
            <div className="flex items-start gap-2 rounded-sm border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-2xs text-amber-500">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{result.error}</span>
            </div>
          ) : null}
          <div className="flex items-center gap-2 text-2xs text-muted-foreground">
            <ListMusic className="h-3.5 w-3.5 text-primary" />
            <span className="truncate">audio {result.audioLabel}</span>
          </div>
          <PreviewStepList result={result} />
          <div className="max-h-28 space-y-1 overflow-y-auto rounded-sm border border-border/70 bg-background/25 px-3 py-2">
            {result.observationLines.map((line) => (
              <div key={line} className="truncate font-mono text-3xs text-muted-foreground">{line}</div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
