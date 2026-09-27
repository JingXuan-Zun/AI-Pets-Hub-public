type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function textValue(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() ? value : null;
  if (!Array.isArray(value)) return null;
  const parts = value.map((item) => {
    const record = asRecord(item);
    const text = record?.text ?? record?.content;
    return typeof text === 'string' ? text : '';
  }).filter((item) => item.trim());
  return parts.length > 0 ? parts.join('\n') : null;
}

function firstChoice(payload: JsonRecord | null) {
  const choices = payload?.choices;
  return Array.isArray(choices) ? asRecord(choices[0]) : null;
}

export function extractOpenAICompatibleText(
  payloadValue: unknown,
  options: {
    allowReasoningContentFallback?: boolean;
    includeReasoningContentWhenPresent?: boolean;
  } = {},
): string | null {
  const payload = asRecord(payloadValue);
  const choice = firstChoice(payload);
  const message = asRecord(choice?.message);
  const standardText = textValue(message?.content)
    ?? textValue(choice?.text)
    ?? textValue(payload?.output_text);
  const reasoningText = textValue(message?.reasoning_content);
  if (standardText) {
    return options.allowReasoningContentFallback
      && options.includeReasoningContentWhenPresent
      && reasoningText
      ? `${standardText}\n${reasoningText}`
      : standardText;
  }
  return options.allowReasoningContentFallback ? reasoningText : null;
}

function recordKeys(value: JsonRecord | null) {
  return value ? Object.keys(value).sort().slice(0, 24) : [];
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function summarizeOpenAICompatibleResponse(payloadValue: unknown) {
  const payload = asRecord(payloadValue);
  const choice = firstChoice(payload);
  const message = asRecord(choice?.message);
  const usage = asRecord(payload?.usage);
  const completionDetails = asRecord(usage?.completion_tokens_details);
  return {
    choiceKeys: recordKeys(choice),
    completionTokens: finiteNumber(usage?.completion_tokens),
    finishReason: typeof choice?.finish_reason === 'string' ? choice.finish_reason : null,
    messageKeys: recordKeys(message),
    reasoningCharacters: textValue(message?.reasoning_content)?.length ?? 0,
    reasoningTokens: finiteNumber(completionDetails?.reasoning_tokens),
  };
}
