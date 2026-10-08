import { type ChatAgentExecutionReceipt } from '../../../types';
import { countAgentStateSummaryItems, createAgentStructuredEvidenceLines } from './agentMessageEvidence';

export function PetChatAgentStateSummaryPanel({
  stateSummary,
}: {
  stateSummary?: ChatAgentExecutionReceipt['stateSummary'];
}) {
  if (!stateSummary || countAgentStateSummaryItems(stateSummary) === 0) {
    return null;
  }

  const structuredEvidenceLines = createAgentStructuredEvidenceLines(stateSummary);
  const inputReplayPreview = stateSummary.structuredEvidence?.inputReplayPreview ?? null;
  const groups = [
    {
      items: stateSummary.observedState,
      label: '观察',
      tone: 'border-border bg-muted/50 text-primary',
    },
    {
      items: structuredEvidenceLines,
      label: 'Structured',
      tone: 'border-indigo-100 bg-indigo-50/50 text-indigo-800',
    },
    {
      items: stateSummary.changedState,
      label: '变更',
      tone: 'border-emerald-100 bg-emerald-50/55 text-emerald-800',
    },
    {
      items: stateSummary.verificationEvidence,
      label: '验证',
      tone: 'border-violet-100 bg-violet-50/55 text-violet-800',
    },
    {
      items: stateSummary.missingEvidence,
      label: '缺失',
      tone: 'border-amber-100 bg-amber-50/60 text-amber-800',
    },
    {
      items: stateSummary.recommendedRecovery,
      label: '恢复',
      tone: 'border-border bg-muted text-foreground',
    },
  ].filter((group) => group.items?.length);

  return (
    <div className="mt-2 rounded-md border border-border bg-white/85 px-2 py-1.5 text-2xs leading-relaxed text-foreground">
      <div className="mb-1 font-semibold text-foreground">状态证据</div>
      <div className="grid gap-1 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.label} className={`min-w-0 rounded-md border px-2 py-1 ${group.tone}`}>
            <div className="mb-0.5 font-semibold">{group.label}</div>
            <ul className="space-y-0.5">
              {group.items?.slice(0, 4).map((item, index) => (
                <li key={`${group.label}-${index}`} className="break-words">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {inputReplayPreview?.beforeRedDotDataUrl || inputReplayPreview?.afterRedDotDataUrl ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {inputReplayPreview.beforeRedDotDataUrl ? (
            <figure className="min-w-0 overflow-hidden rounded-md border border-rose-100 bg-rose-50/35 p-1">
              <img
                alt="Agent input replay before click"
                className="max-h-40 w-full rounded object-contain"
                src={inputReplayPreview.beforeRedDotDataUrl}
              />
              <figcaption className="mt-1 truncate text-2xs text-rose-700">
                before · {inputReplayPreview.beforeCaptureStatus ?? 'capture_unknown'}
              </figcaption>
            </figure>
          ) : null}
          {inputReplayPreview.afterRedDotDataUrl ? (
            <figure className="min-w-0 overflow-hidden rounded-md border border-rose-100 bg-rose-50/35 p-1">
              <img
                alt="Agent input replay after click"
                className="max-h-40 w-full rounded object-contain"
                src={inputReplayPreview.afterRedDotDataUrl}
              />
              <figcaption className="mt-1 truncate text-2xs text-rose-700">
                after · {inputReplayPreview.afterCaptureStatus ?? 'capture_unknown'}
                {typeof inputReplayPreview.uiChanged === 'boolean' ? ` · changed=${inputReplayPreview.uiChanged}` : ''}
              </figcaption>
            </figure>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
