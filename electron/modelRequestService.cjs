const MAX_BODY_BYTES = 24 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 24 * 1024 * 1024;

function normalizeEndpoint(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('invalid-endpoint');
  const pathname = url.pathname.replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(pathname)) return url.href;
  url.pathname = /\/responses$/i.test(pathname)
    ? pathname.replace(/\/responses$/i, '') + '/chat/completions'
    : pathname ? pathname + '/chat/completions' : '/v1/chat/completions';
  return url.href;
}

function requestEndpoint(request) {
  if (request.operation !== 'models') return normalizeEndpoint(request.endpoint);
  const url = new URL(request.endpoint);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || !/\/models$/i.test(url.pathname)) throw new Error('invalid-models-endpoint');
  return url.href;
}

function credentialEndpoint(request) {
  if (request.operation !== 'models') return normalizeEndpoint(request.endpoint);
  const url = new URL(requestEndpoint(request));
  url.pathname = url.pathname.replace(/\/models$/i, '/chat/completions');
  return url.href;
}

function createModelRequestService({ persistedConfigStore, fetchImpl = fetch, createGeminiClient }) {
  const sessions = new Map();
  const encoder = new TextEncoder();
  function cancel(owner, id) {
    const session = sessions.get(id);
    if (!session || session.owner !== owner) return;
    sessions.delete(id);
    clearTimeout(session.timer);
    session.controller.abort();
    void session.reader?.cancel().catch(() => undefined);
    void Promise.resolve(session.iterator?.return?.()).catch(() => undefined);
  }
  function resolveKey(request) {
    const fields = request.provider === 'gemini' ? ['geminiApiKey'] : ['customApiKey', 'visionCustomApiKey'];
    if (!fields.includes(request.credentialField)) throw new Error('invalid-credential-field');
    const value = request.credential ?? '';
    if (typeof value !== 'string') throw new Error('invalid-credential');
    if (!value.startsWith('desktop-pet-credential:')) return value.trim();
    if (value !== 'desktop-pet-credential:' + request.credentialField) throw new Error('invalid-credential-reference');
    const loaded = persistedConfigStore.load({ includeModelSecrets: true });
    if (!loaded.ok) throw new Error('credential-unavailable');
    const settings = loaded.config.settings;
    if (request.provider !== 'gemini') {
      const urlField = request.credentialField === 'customApiKey' ? 'customApiUrl' : 'visionCustomApiUrl';
      if (normalizeEndpoint(settings[urlField]) !== credentialEndpoint(request)) throw new Error('credential-endpoint-mismatch');
    }
    return settings[request.credentialField] || '';
  }
  async function open(owner, request) {
    if (!request || !['openai', 'gemini'].includes(request.provider)
      || typeof request.id !== 'string' || !/^[\w-]{1,80}$/.test(request.id)
      || sessions.has(request.id) || [...sessions.values()].filter((s) => s.owner === owner).length >= 4
      || sessions.size >= 32) throw new Error('模型请求不可用，请稍后重试。');
    const controller = new AbortController();
    const session = { owner, controller, bytes: 0, reading: false };
    sessions.set(request.id, session);
    session.timer = setTimeout(() => cancel(owner, request.id), 300_000);
    try {
      const key = resolveKey(request);
      const payload = request.provider === 'gemini' ? request.args : request.body;
      if (Buffer.byteLength(JSON.stringify(payload) || '') > MAX_BODY_BYTES) throw new Error('request-too-large');
      if (request.provider === 'gemini') {
        if (!key || !payload || typeof payload.model !== 'string' || payload.httpOptions || payload.config?.httpOptions) throw new Error('invalid-gemini-request');
        const client = createGeminiClient ? await createGeminiClient(key)
          : new (await import('@google/genai')).GoogleGenAI({ apiKey: key });
        const args = { model: payload.model, contents: payload.contents,
          config: { ...payload.config, abortSignal: controller.signal } };
        if (request.stream) {
          const stream = await client.models.generateContentStream(args);
          session.iterator = stream[Symbol.asyncIterator]();
        } else {
          const result = await client.models.generateContent(args);
          session.single = encoder.encode(JSON.stringify({ text: result.text || '' }));
        }
        if (!sessions.has(request.id)) {
          await session.iterator?.return?.();
          throw new Error('cancelled');
        }
        return { status: 200, contentType: 'application/json' };
      }
      const response = await fetchImpl(requestEndpoint(request), {
        method: request.operation === 'models' ? 'GET' : 'POST', redirect: 'error', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: request.stream ? 'text/event-stream' : 'application/json',
          ...(key ? { Authorization: `Bearer ${key}` } : {}) },
        body: request.operation === 'models' ? undefined : JSON.stringify(payload),
      });
      if (!sessions.has(request.id)) { await response.body?.cancel(); throw new Error('cancelled'); }
      if (!response.ok) {
        await response.body?.cancel();
        session.single = encoder.encode(JSON.stringify({ error: { message: '模型接口请求失败，请检查配置后重试。' } }));
      } else session.reader = response.body?.getReader();
      return { status: response.status, contentType: response.headers.get('content-type') || 'application/json' };
    } catch {
      cancel(owner, request.id);
      throw new Error('模型请求失败，请检查配置后重试。');
    }
  }
  async function read(owner, id) {
    const session = sessions.get(id);
    if (!session || session.owner !== owner || session.reading) throw new Error('模型请求已结束。');
    session.reading = true;
    try {
      let result;
      if (session.single) { result = { value: session.single, done: false }; session.single = null; }
      else if (session.iterator) {
        const next = await session.iterator.next();
        result = { done: next.done, value: next.done ? undefined : encoder.encode(JSON.stringify({ text: next.value.text || '' })) };
      } else result = session.reader ? await session.reader.read() : { done: true };
      session.bytes += result.value?.byteLength || 0;
      if (session.bytes > MAX_RESPONSE_BYTES) throw new Error('response-too-large');
      if (result.done) cancel(owner, id);
      return result;
    } catch {
      cancel(owner, id);
      throw new Error('模型响应读取失败，请重试。');
    } finally { session.reading = false; }
  }
  return { open, read, cancel, cancelOwner: (owner) => {
    for (const [id, session] of sessions) if (session.owner === owner) cancel(owner, id);
  } };
}

module.exports = { createModelRequestService };
