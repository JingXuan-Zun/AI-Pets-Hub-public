

export function stripAgentRunLoopSummaryFromText(text?: string | null) {
  const sourceText = text?.trim() ?? '';
  if (!sourceText) {
    return '';
  }

  // Some Agent skill/runtime adapters accidentally return their progress
  // envelope as finalAnswer. Never expose that envelope in a character bubble.
  // Keep the first human-facing bracketed answer when one is present.
  const internalProgressMarker = /(?:Runtime diagnosis|详细阶段|执行评估|工具计划|Agent runtime progress|Character reply|Decide next step|Summarize result|observedState|verificationEvidence)/iu;
  if (internalProgressMarker.test(sourceText)) {
    const answerMatch = sourceText.match(/【[^】\r\n]{1,120}】\s*([\s\S]*?)(?=\n(?:完成|详细阶段|执行评估|工具计划|$))/u);
    if (answerMatch?.[1]?.trim()) {
      return answerMatch[1].trim();
    }

    const finalAnswerMatch = sourceText.match(/(?:finalAnswer|Character reply)\s*[:：]?\s*([\s\S]*?)(?=\n(?:详细阶段|执行评估|工具计划|执行事件|$))/iu);
    if (finalAnswerMatch?.[1]?.trim()) {
      return finalAnswerMatch[1].trim();
    }

    return '';
  }

  const blockStart = sourceText.indexOf('\nExecution rounds:');
  if (blockStart >= 0) {
    return sourceText.slice(0, blockStart).trim();
  }

  return sourceText.startsWith('Execution rounds:')
    ? ''
    : sourceText;
}

export function compactAgentPersonaPromptText(text?: string | null, maxLength = 180) {
  const normalizedText = stripAgentRunLoopSummaryFromText(text)
    .replace(/\s+/gu, ' ')
    .trim();

  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, Math.max(0, maxLength - 3))}...`;
}

export const AGENT_INTERNAL_FALLBACK_TEXT_PATTERN = /(?:AgentSessionV2|AgentProductionSession|Agent V2|JSON|工具调用|结构化决策|local tool executor|tool executor adapter|no local tool executor|model did not return valid|completed without an additional tool result)/iu;

export function createAgentSafeVisibleFallbackText(text?: string | null, maxLength = 160) {
  const compactText = compactAgentPersonaPromptText(text, maxLength);
  if (!compactText || AGENT_INTERNAL_FALLBACK_TEXT_PATTERN.test(compactText)) {
    return '';
  }

  return compactText;
}
