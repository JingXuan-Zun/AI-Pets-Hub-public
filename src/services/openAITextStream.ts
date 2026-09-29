/** Decode SSE across arbitrary UTF-8/network boundaries; never expose reasoning deltas. */
export async function* readOpenAITextStream(response: Response): AsyncGenerator<string> {
  if (!response.ok) throw new Error(`聊天接口请求失败 (${response.status})：${await response.text()}`);
  if (response.headers.get('content-type')?.includes('application/json')) {
    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.message || '模型接口返回错误');
    const text = extractText(payload);
    if (!text) throw createMissingResponseTextError({
      finishReason: resolveFinishReason(payload),
      sawReasoning: hasReasoningContent(payload),
    });
    yield text;
    return;
  }
  if (!response.body) throw new Error('接口没有返回可读取的流。');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let data: string[] = [];
  let hasText = false;
  let lastFinishReason = '';
  let sawReasoning = false;
  function parseEvent() {
    const raw = data.join('\n'); data = [];
    if (!raw || raw === '[DONE]') return { done: raw === '[DONE]', text: '' };
    const payload = JSON.parse(raw);
    if (payload.error) throw new Error(payload.error.message || '模型流式请求失败');
    sawReasoning = sawReasoning || hasReasoningContent(payload);
    lastFinishReason = resolveFinishReason(payload) || lastFinishReason;
    return { done: false, text: extractText(payload) };
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() + '\n\n' : decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end).replace(/\r$/, '');
        buffer = buffer.slice(end + 1);
        if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
        else if (line.trim().startsWith('{')) data.push(line.trim());
        if (line !== '') continue;
        const event = parseEvent();
        if (event.text) { hasText = true; yield event.text; }
        if (event.done) {
          if (!hasText) throw createMissingResponseTextError({ finishReason: lastFinishReason, sawReasoning });
          return;
        }
      }
      if (done) break;
    }
    if (!hasText) throw createMissingResponseTextError({ finishReason: lastFinishReason, sawReasoning });
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function extractText(payload: any): string {
  const candidates = [
    payload?.choices?.[0]?.delta?.content,
    payload?.choices?.[0]?.message?.content,
    payload?.choices?.[0]?.text,
    payload?.output_text,
    payload?.output?.[0]?.content?.[0]?.text,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value) return value;
    if (Array.isArray(value)) {
      const text = value.map((item) => typeof item === 'string' ? item : item?.text ?? item?.content ?? '').join('');
      if (text) return text;
    }
    if (value && typeof value === 'object') {
      const text = value.text ?? value.content ?? value.value;
      if (typeof text === 'string' && text) return text;
    }
  }
  return '';
}

function hasReasoningContent(payload: any) {
  const candidates = [
    payload?.choices?.[0]?.delta?.reasoning_content,
    payload?.choices?.[0]?.delta?.reasoning,
    payload?.choices?.[0]?.message?.reasoning_content,
    payload?.choices?.[0]?.message?.reasoning,
  ];
  return candidates.some((value) => (
    typeof value === 'string' ? Boolean(value.trim()) : Array.isArray(value) ? value.length > 0 : Boolean(value)
  ));
}

function resolveFinishReason(payload: any) {
  const value = payload?.choices?.[0]?.finish_reason;
  return typeof value === 'string' ? value.trim() : '';
}

function createMissingResponseTextError(options: {
  finishReason: string;
  sawReasoning: boolean;
}) {
  if (options.sawReasoning) {
    return new Error('模型只输出了内部推理，没有生成最终回复。请增加最大输出 Token 或关闭深度思考后重试。');
  }

  return new Error(
    options.finishReason
      ? `模型未返回回复正文（结束原因：${options.finishReason}）。`
      : '模型未返回回复正文。',
  );
}
