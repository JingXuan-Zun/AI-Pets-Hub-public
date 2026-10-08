import { Check, Copy, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { createAgentSessionV2TraceDebugSummary } from './agentMessageDebugSummary';
import { resolveAgentSessionV2PerformanceSignals } from './agentMessagePerformance';
import { compactAgentPanelText } from './agentMessageProgress';
import { resolveAgentSessionV2StuckSignalClassName, resolveAgentSessionV2TraceStuckSignals } from './agentMessageStuckSignals';
import { resolveAgentSessionV2TraceClassName, resolveAgentSessionV2TraceDetailPairs, resolveAgentSessionV2TraceTypeText } from './agentMessageTraceFormatting';
import { type ChatAgentSessionV2Process, resolveLatestAgentRuntimeDiagnosticEvent } from './agentMessageTypes';

export function PetChatAgentSessionV2TracePanel({
  session,
}: {
  session: ChatAgentSessionV2Process;
}) {
  const traceEvents = session.traceEvents ?? [];
  const stuckSignals = resolveAgentSessionV2TraceStuckSignals(session);
  const performanceSignals = resolveAgentSessionV2PerformanceSignals(session);
  const latestRuntimeShadow = resolveLatestAgentRuntimeDiagnosticEvent(session);
  const [copyStatus, setCopyStatus] = useState<'copied' | 'failed' | 'idle'>('idle');
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyResetTimerRef.current) {
      clearTimeout(copyResetTimerRef.current);
    }
  }, []);

  if (!traceEvents.length && !latestRuntimeShadow && !session.taskState) {
    return null;
  }

  const setTemporaryCopyStatus = (status: 'copied' | 'failed') => {
    setCopyStatus(status);
    if (copyResetTimerRef.current) {
      clearTimeout(copyResetTimerRef.current);
    }

    copyResetTimerRef.current = setTimeout(() => {
      setCopyStatus('idle');
      copyResetTimerRef.current = null;
    }, 1600);
  };
  const handleCopyTraceDebugSummary = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setTemporaryCopyStatus('failed');
      return;
    }

    void navigator.clipboard.writeText(
      createAgentSessionV2TraceDebugSummary(session, stuckSignals),
    ).then(() => {
      setTemporaryCopyStatus('copied');
    }).catch(() => {
      setTemporaryCopyStatus('failed');
    });
  };
  const copyButtonClassName = copyStatus === 'failed'
    ? 'border-rose-100 text-rose-600 hover:bg-rose-50'
    : copyStatus === 'copied'
      ? 'border-emerald-100 text-emerald-600 hover:bg-emerald-50'
      : 'border-border text-muted-foreground hover:bg-white';

  return (
    <div className="mb-2 rounded-md border border-border bg-muted/70 px-2 py-1.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-2xs font-semibold text-muted-foreground">Trace</span>
        <span className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopyTraceDebugSummary}
            className={`h-6 w-6 rounded-full border p-0 ${copyButtonClassName}`}
            title={copyStatus === 'copied'
              ? 'Trace debug summary copied'
              : copyStatus === 'failed'
                ? 'Trace debug summary copy failed'
                : 'Copy trace debug summary'}
          >
            {copyStatus === 'copied'
              ? <Check className="h-3 w-3" />
              : copyStatus === 'failed'
                ? <X className="h-3 w-3" />
                : <Copy className="h-3 w-3" />}
          </Button>
          <span className="rounded-full border border-white bg-white/80 px-1.5 py-0.5 text-2xs text-muted-foreground">
            {traceEvents.length} events
          </span>
        </span>
      </div>
      {latestRuntimeShadow ? (
        <div className={`mb-1.5 rounded-md border px-2 py-1 ${resolveAgentSessionV2TraceClassName(latestRuntimeShadow)}`}>
          <div className="mb-1 flex flex-wrap items-center gap-1.5 text-2xs font-semibold">
            <span>Runtime diagnosis</span>
            {latestRuntimeShadow.status ? (
              <span className="rounded-full border border-current/20 bg-white/55 px-1.5 py-0.5">
                {latestRuntimeShadow.status}
              </span>
            ) : null}
          </div>
          <div className="break-words text-2xs leading-snug">
            {compactAgentPanelText(latestRuntimeShadow.summary, 220)}
          </div>
          {resolveAgentSessionV2TraceDetailPairs(latestRuntimeShadow).length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {resolveAgentSessionV2TraceDetailPairs(latestRuntimeShadow).map(([key, value]) => (
                <span key={`runtime-shadow-${key}`} className="min-w-0 max-w-full rounded border border-current/10 bg-white/55 px-1 py-0.5 text-2xs">
                  <span className="font-semibold opacity-70">{key}</span>
                  <span className="ml-1 break-words opacity-80">{compactAgentPanelText(value, 110)}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {stuckSignals.length ? (
        <div className="mb-1.5 rounded-md border border-amber-100 bg-amber-50/45 px-2 py-1">
          <div className="mb-1 text-2xs font-semibold text-amber-700">Stuck signals</div>
          <div className="flex flex-wrap gap-1">
            {stuckSignals.map((signal) => (
              <span key={signal.id} className={`min-w-0 max-w-full rounded-md border px-1.5 py-1 text-2xs leading-snug ${resolveAgentSessionV2StuckSignalClassName(signal.tone)}`}>
                <span className="block font-semibold">{signal.label}</span>
                <span className="block break-words opacity-80">{compactAgentPanelText(signal.detail, 180)}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {performanceSignals.length ? (
        <div className="mb-1.5 rounded-md border border-border bg-muted/45 px-2 py-1">
          <div className="mb-1 text-2xs font-semibold text-primary">Performance signals</div>
          <div className="flex flex-wrap gap-1">
            {performanceSignals.map((signal) => (
              <span key={signal.id} className={`min-w-0 max-w-full rounded-md border px-1.5 py-1 text-2xs leading-snug ${resolveAgentSessionV2StuckSignalClassName(signal.tone)}`}>
                <span className="block font-semibold">{signal.label}</span>
                <span className="block break-words opacity-80">{compactAgentPanelText(signal.detail, 180)}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="space-y-1">
        {traceEvents.slice(-8).map((event) => {
          const detailPairs = resolveAgentSessionV2TraceDetailPairs(event);
          return (
            <div key={event.id} className="grid grid-cols-[76px_minmax(0,1fr)_auto] items-start gap-2 rounded-md border border-white bg-white/75 px-2 py-1 text-2xs leading-relaxed text-foreground">
              <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-center ${resolveAgentSessionV2TraceClassName(event)}`}>
                {resolveAgentSessionV2TraceTypeText(event.type)}
              </span>
              <span className="min-w-0">
                <span className="block break-words font-medium text-foreground">
                  {compactAgentPanelText(event.summary, 150)}
                </span>
                {detailPairs.length ? (
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    {detailPairs.map(([key, value]) => (
                      <span key={`${event.id}-${key}`} className="min-w-0 max-w-full rounded border border-border bg-muted px-1 py-0.5 text-muted-foreground">
                        <span className="font-semibold text-muted-foreground">{key}</span>
                        <span className="ml-1 break-words">{compactAgentPanelText(value, 96)}</span>
                      </span>
                    ))}
                  </span>
                ) : null}
              </span>
              <span className="min-w-0 max-w-[96px] truncate text-right text-muted-foreground">
                {event.tool ?? event.status ?? `#${event.stepIndex}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
