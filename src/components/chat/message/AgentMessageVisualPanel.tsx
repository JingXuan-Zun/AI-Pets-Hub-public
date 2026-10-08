import { compactAgentPanelText } from './agentMessageProgress';
import { type ChatAgentProcessPanelSource } from './agentMessageTypes';
import { resolveAgentVisualObservations } from './agentMessageVisualObservation';

function resolveAgentVisualToolLabel(toolName: string) {
  return toolName === 'analyze_game_screen' ? '游戏画面' : '屏幕画面';
}

export function PetChatAgentVisualObservationPanel({
  process,
}: {
  process: ChatAgentProcessPanelSource;
}) {
  const visualObservations = resolveAgentVisualObservations(process);
  if (!visualObservations.length) {
    return null;
  }

  const recentObservations = visualObservations.slice(-3).reverse();

  return (
    <div className="mt-2 rounded-md border border-cyan-100 bg-cyan-50/40 px-2 py-1.5 text-2xs leading-relaxed text-foreground">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-semibold text-cyan-900">视觉观察</span>
        <span className="shrink-0 rounded-full border border-cyan-100 bg-white/70 px-1.5 py-0.5 text-cyan-700">
          最近 {recentObservations.length} 次
        </span>
      </div>
      <div className="space-y-1.5">
        {recentObservations.map((observation) => (
          <div key={observation.key} className="rounded-md border border-cyan-100 bg-white/80 px-2 py-1.5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-semibold text-cyan-900">
                {resolveAgentVisualToolLabel(observation.toolName)}
              </span>
              <span className={`shrink-0 rounded-full border px-1.5 py-0.5 ${
                observation.ok
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                  : 'border-rose-100 bg-rose-50 text-rose-700'
              }`}>
                {observation.ok ? '已观察' : '失败'}
              </span>
            </div>
            {observation.source ? (
              <div className="mb-0.5 break-words text-cyan-700">
                来源：{compactAgentPanelText(observation.source, 180)}
              </div>
            ) : null}
            {observation.summary ? (
              <div className="mb-1 break-words text-foreground">
                {compactAgentPanelText(observation.summary, 240)}
              </div>
            ) : null}
            {observation.contentLines.length ? (
              <div className="space-y-0.5 text-muted-foreground">
                {observation.contentLines.slice(0, 4).map((line) => (
                  <div key={line} className="break-words">
                    {compactAgentPanelText(line, 220)}
                  </div>
                ))}
              </div>
            ) : null}
            {observation.visibleTextLines.length ? (
              <div className="mt-1 rounded-md border border-border bg-muted/70 px-2 py-1 text-muted-foreground">
                <span className="mr-1 font-semibold text-muted-foreground">可读文字</span>
                <span className="break-words">{observation.visibleTextLines.slice(0, 4).join(' / ')}</span>
              </div>
            ) : null}
            {observation.confidence || observation.uncertaintyLines.length ? (
              <div className="mt-1 grid gap-1 sm:grid-cols-2">
                {observation.confidence ? (
                  <div className="rounded-md border border-emerald-100 bg-emerald-50/60 px-2 py-1 text-emerald-800">
                    <span className="mr-1 font-semibold">置信度</span>
                    <span>{observation.confidence}</span>
                  </div>
                ) : null}
                {observation.uncertaintyLines.length ? (
                  <div className="rounded-md border border-amber-100 bg-amber-50/70 px-2 py-1 text-amber-800">
                    <div className="mb-0.5 font-semibold">不确定点</div>
                    {observation.uncertaintyLines.slice(0, 3).map((line) => (
                      <div key={line} className="break-words">
                        {compactAgentPanelText(line, 180)}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {observation.recoveryLines.length ? (
              <div className="mt-1 rounded-md border border-border bg-muted/75 px-2 py-1 text-muted-foreground">
                <div className="mb-0.5 font-semibold text-muted-foreground">建议处理</div>
                {observation.recoveryLines.slice(0, 2).map((line) => (
                  <div key={line} className="break-words">
                    {compactAgentPanelText(line, 220)}
                  </div>
                ))}
              </div>
            ) : null}
            {observation.companionCue ? (
              <div className="mt-1 break-words text-cyan-700">
                角色提示：{compactAgentPanelText(observation.companionCue, 180)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
