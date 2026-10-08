import { resolveChatAgentRuntimeContinuation } from '../chatAgentRuntimeCompatibility';
import { compactAgentPanelText } from './agentMessageProgress';
import { type ChatAgentProcessPanelSource, type ChatAgentSessionV2ToolResultEntry, type ChatAgentVisualObservation } from './agentMessageTypes';

export function isAgentVisualToolName(toolName?: string | null) {
  return toolName === 'summarize_visual_snapshot' || toolName === 'analyze_game_screen';
}

function normalizeAgentVisualLine(line?: string | null) {
  return line?.replace(/\s+/gu, ' ').trim() ?? '';
}

function uniqueAgentVisualLines(lines: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return lines
    .map(normalizeAgentVisualLine)
    .filter((line) => {
      if (!line || seen.has(line)) {
        return false;
      }

      seen.add(line);
      return true;
    });
}

function extractAgentVisualLine(lines: string[], prefixes: string[]) {
  for (const line of lines) {
    for (const prefix of prefixes) {
      if (line.toLowerCase().startsWith(prefix.toLowerCase())) {
        return line.slice(prefix.length).trim();
      }
    }
  }

  return '';
}

function splitAgentVisualListText(text?: string | null) {
  return uniqueAgentVisualLines(
    (text ?? '')
      .split(/\s*\|\s*/u)
      .map((item) => item.trim()),
  );
}

function resolveAgentVisualObservationFromToolResult(
  entry: ChatAgentSessionV2ToolResultEntry,
  index: number,
): ChatAgentVisualObservation | null {
  const toolName = entry.command.toolCall?.name ?? entry.command.kind;
  if (!isAgentVisualToolName(toolName)) {
    return null;
  }

  const result = entry.result;
  const stateSummary = result.stateSummary ?? result.receipt?.stateSummary ?? null;
  const observedLines = uniqueAgentVisualLines([
    ...(stateSummary?.observedState ?? []),
    ...(result.observations ?? []),
    ...(result.receipt?.evidenceLines ?? []),
    result.responseText,
  ]);
  const verificationLines = uniqueAgentVisualLines([
    ...(stateSummary?.verificationEvidence ?? []),
    result.verification,
    result.receipt?.verification,
  ]);
  const allLines = uniqueAgentVisualLines([
    ...observedLines,
    ...verificationLines,
    ...(stateSummary?.missingEvidence ?? []),
  ]);
  const source = extractAgentVisualLine(allLines, [
    'Visual source:',
    'Game source:',
    'Selected visual source:',
    'Selected game source:',
    '视觉来源：',
  ]);
  const extractedSummary = extractAgentVisualLine(allLines, [
    'Visual summary:',
    'Game content analysis:',
  ]);
  const summary = extractedSummary
    || (result.ok === false
      ? compactAgentPanelText(result.errorText ?? result.followUp ?? result.responseText, 180)
      : '');
  const confidence = extractAgentVisualLine(verificationLines, [
    'Visual confidence:',
    'Game confidence:',
  ]);
  const companionCue = extractAgentVisualLine(verificationLines, [
    'Visual companion cue:',
    'Game companion cue:',
  ]);

  const contentLines = uniqueAgentVisualLines([
    extractAgentVisualLine(allLines, ['Visual app/window:'])
      ? `窗口：${extractAgentVisualLine(allLines, ['Visual app/window:'])}`
      : '',
    extractAgentVisualLine(allLines, ['Visual main content:'])
      ? `内容：${extractAgentVisualLine(allLines, ['Visual main content:'])}`
      : '',
    extractAgentVisualLine(allLines, ['Visual visible objects:'])
      ? `对象：${splitAgentVisualListText(extractAgentVisualLine(allLines, ['Visual visible objects:'])).join(' / ')}`
      : '',
    extractAgentVisualLine(allLines, ['Game detected game/genre:'])
      ? `游戏：${extractAgentVisualLine(allLines, ['Game detected game/genre:'])}`
      : '',
    extractAgentVisualLine(allLines, ['Game scene state:'])
      ? `场景：${extractAgentVisualLine(allLines, ['Game scene state:'])}`
      : '',
    extractAgentVisualLine(allLines, ['Game player state:'])
      ? `玩家：${extractAgentVisualLine(allLines, ['Game player state:'])}`
      : '',
    extractAgentVisualLine(allLines, ['Game HUD:'])
      ? `HUD：${extractAgentVisualLine(allLines, ['Game HUD:'])}`
      : '',
  ]);
  const visibleTextLines = splitAgentVisualListText(
    extractAgentVisualLine(allLines, [
      'Visual readable text:',
      'Game visible text:',
    ]),
  );
  const uncertaintyLines = uniqueAgentVisualLines([
    ...(stateSummary?.missingEvidence ?? []).map((line) => (
      extractAgentVisualLine([line], ['Visual uncertainty:', 'Game uncertainty:']) || line
    )),
    ...splitAgentVisualListText(
      extractAgentVisualLine(allLines, [
        'Visual uncertainty:',
        'Game uncertainty:',
      ]),
    ),
  ]);

  return {
    companionCue,
    confidence,
    contentLines,
    key: `${index}-${toolName}-${source || summary || result.responseText || 'visual'}`,
    ok: result.ok !== false,
    recoveryLines: uniqueAgentVisualLines(stateSummary?.recommendedRecovery ?? []),
    source,
    summary,
    toolName,
    uncertaintyLines,
    visibleTextLines,
  };
}

export function resolveAgentVisualObservations(process: ChatAgentProcessPanelSource) {
  return (resolveChatAgentRuntimeContinuation(process)?.toolResults ?? [])
    .map(resolveAgentVisualObservationFromToolResult)
    .filter((entry): entry is ChatAgentVisualObservation => Boolean(entry));
}

function resolveLatestAgentVisualObservation(process: ChatAgentProcessPanelSource) {
  const observations = resolveAgentVisualObservations(process);
  return observations[observations.length - 1] ?? null;
}
