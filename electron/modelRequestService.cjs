const { resolveProfileCredential } = require('./configCredentials.cjs');
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

/**
 * Optional Gemini endpoint (a relay/proxy). Empty means the official endpoint. A trailing
 * API version (/v1beta, /v1, /v1alpha) is split off because the SDK appends its own.
 */
function normalizeGeminiEndpoint(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  const url = new URL(text);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('invalid-endpoint');
  let pathname = url.pathname.replace(/\/+$/, '');
  let apiVersion;
  const version = /\/(v1beta|v1alpha|v1)$/i.exec(pathname);
  if (version) {
    apiVersion = version[1].toLowerCase();
    pathname = pathname.slice(0, -version[0].length);
  }
  return { baseUrl: url.origin + pathname, ...(apiVersion ? { apiVersion } : {}) };
}

/**
 * What the renderer needs from one Gemini response or chunk: the text and, for the
 * conversation loop, any function calls with their thought signatures (Gemini requires
 * those to be sent back with the call on the next turn).
 */
function geminiChunkPayload(value) {
  const parts = value?.candidates?.[0]?.content?.parts ?? [];
  const functionCalls = parts
    .filter((part) => part?.functionCall?.name)
    .map((part) => ({
      args: part.functionCall.args ?? {},
      ...(part.functionCall.id ? { id: part.functionCall.id } : {}),
      name: part.functionCall.name,
      ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}),
    }));
  const text = parts.length
    ? parts.filter((part) => typeof part?.text === 'string' && !part.thought).map((part) => part.text).join('')
    : (value?.text || '');
  return functionCalls.length ? { functionCalls, text } : { text };
}

function sameGeminiEndpoint(left, right) {
  const a = normalizeGeminiEndpoint(left);
  const b = normalizeGeminiEndpoint(right);
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * What went wrong, in words the user can act on. Before, every failure read “模型请求失败，请
 * 检查配置后重试”, so a wrong key, a model name that does not exist and a blocked network all
 * looked the same. Never includes the key: anything key-like is cut out.
 */
function describeModelError(error) {
  const raw = String(error?.message ?? error ?? '');
  const message = raw.replace(/(AIza|sk-)[\w-]{8,}/gu, '***').replace(/key=[^&\s]+/giu, 'key=***');
  const known = {
    'credential-endpoint-mismatch': '保存的密钥属于另一个接口地址：改了地址要重新填密钥并保存。',
    'credential-unavailable': '读不到保存的密钥，请重新填写 API Key 并保存。',
    'invalid-credential-reference': '密钥无效，请重新填写 API Key 并保存。',
    'invalid-credential-field': '密钥无效，请重新填写 API Key 并保存。',
    'invalid-gemini-request': '模型名称或 API Key 是空的。',
    'invalid-endpoint': '接口地址不对，应该以 http:// 或 https:// 开头。',
    'request-too-large': '这次发送的内容太大了。',
  };
  if (known[message]) return known[message];
  if (/API key not valid|API_KEY_INVALID|invalid api key|Incorrect API key|\b401\b/iu.test(message)) return 'API Key 无效，检查有没有填错或多了空格。';
  if (/not found|NOT_FOUND|\b404\b/iu.test(message) && /model/iu.test(message)) return '找不到这个模型，检查模型名称有没有写对。';
  if (/location is not supported|FAILED_PRECONDITION/iu.test(message)) return '所在地区不能直接用这个接口，需要代理或填一个中转地址。';
  if (/fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket|timeout/iu.test(message)) return '连不上接口服务器（网络或代理问题）；国内用 Gemini 一般需要代理或中转地址。';
  // Gemini's 429 is not about the account balance: a model with no free-tier quota (limit 0,
  // common for new / preview models unless the key's project has billing on), or too many
  // requests per minute / per day.
  // 402 from Gemini: the prepaid credits of the key's Google project ran out (the balance may sit on another project).
  if (/\b402\b|prepayment credits|credits are depleted|insufficient.{0,20}(balance|credit)|余额不足/iu.test(message)) {
    return '这个 API Key 所在项目的余额用完了（402）。余额可能充在了别的项目上，或者充值还没到账；到 Google AI Studio 的项目页（ai.studio/projects）看这个 Key 属于哪个项目、那个项目还有没有余额。用中转的话，是中转那边的余额。';
  }
  if (/\b429\b|quota|RESOURCE_EXHAUSTED|rate limit/iu.test(message)) {
    if (/limit:\s*0\b/iu.test(message)) return '这个模型在你这个 API Key 的项目里没有额度（限额是 0）：新模型或预览模型常常只给开通了付费的项目用，和余额无关。换一个模型，或在 Google AI Studio 给这个 Key 所在的项目开通付费。';
    if (/per\s*day|PerDay|daily/iu.test(message)) return '这个模型今天的次数用完了（每天限额），明天恢复，或换一个模型。';
    if (/per\s*minute|PerMinute/iu.test(message)) return '请求太频繁了（每分钟限额），等一分钟再试。';
    return '被限额了（429）：可能是这个模型对你的项目没开放、每分钟或每天次数到了，或者余额不足。换个模型试试，或到 Google AI Studio 看这个模型的限额。';
  }
  if (/\b403\b|PERMISSION_DENIED/iu.test(message)) return '没有权限使用这个模型（密钥或账号权限不够）。';
  // Anything else: no raw text (it may carry a key or private data), only an HTTP status if any.
  const status = /\b([1-5]\d\d)\b/u.exec(message)?.[1];
  return status ? `模型请求失败（HTTP ${status}），请检查配置后重试。` : '模型请求失败，请检查配置后重试。';
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
    const loaded = persistedConfigStore.load({ includeModelSecrets: true });
    if (!loaded.ok) throw new Error('credential-unavailable');
    const settings = loaded.config.settings;
    // A saved API profile's key (“接口配置”), right after switching to it: only to its own endpoint.
    const profile = resolveProfileCredential(value, settings);
    if (profile) {
      if (request.credentialField === 'visionCustomApiKey' || profile.llmProvider !== request.provider) throw new Error('invalid-credential-reference');
      const matches = request.provider === 'gemini'
        ? sameGeminiEndpoint(profile.url, request.endpoint)
        : normalizeEndpoint(profile.url) === credentialEndpoint(request);
      if (!matches) throw new Error('credential-endpoint-mismatch');
      return profile.apiKey;
    }
    if (value !== 'desktop-pet-credential:' + request.credentialField) throw new Error('invalid-credential-reference');
    if (request.provider === 'gemini') {
      // The saved key only goes to the saved endpoint.
      if (!sameGeminiEndpoint(settings.geminiApiUrl, request.endpoint)) throw new Error('credential-endpoint-mismatch');
    } else {
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
        const listing = request.operation === 'models';
        if (!key || (!listing && (!payload || typeof payload.model !== 'string' || payload.httpOptions || payload.config?.httpOptions))) throw new Error('invalid-gemini-request');
        const endpoint = normalizeGeminiEndpoint(request.endpoint);
        const options = { apiKey: key, ...(endpoint ? { httpOptions: endpoint } : {}) };
        const client = createGeminiClient ? await createGeminiClient(key, options.httpOptions)
          : new (await import('@google/genai')).GoogleGenAI(options);
        // “读取模型”: the models this key can chat with (names without the “models/” prefix).
        if (listing) {
          const names = [];
          const pager = await client.models.list({ config: { abortSignal: controller.signal, pageSize: 100 } });
          for await (const model of pager) {
            const actions = Array.isArray(model?.supportedActions) ? model.supportedActions : null;
            if (typeof model?.name === 'string' && (!actions || actions.includes('generateContent'))) names.push(model.name.replace(/^models\//u, ''));
            if (names.length >= 300) break;
          }
          session.single = encoder.encode(JSON.stringify({ models: names }));
          return { status: 200, contentType: 'application/json' };
        }
        const args = { model: payload.model, contents: payload.contents,
          config: { ...payload.config, abortSignal: controller.signal } };
        if (request.stream) {
          const stream = await client.models.generateContentStream(args);
          session.iterator = stream[Symbol.asyncIterator]();
        } else {
          const result = await client.models.generateContent(args);
          session.single = encoder.encode(JSON.stringify(geminiChunkPayload(result)));
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
        const reason = describeModelError(new Error(`HTTP ${response.status}`));
        session.single = encoder.encode(JSON.stringify({ error: {
          message: reason.startsWith('模型请求失败') ? `模型接口请求失败（HTTP ${response.status}），请检查配置后重试。` : `${reason}（HTTP ${response.status}）`,
        } }));
      } else session.reader = response.body?.getReader();
      return { status: response.status, contentType: response.headers.get('content-type') || 'application/json' };
    } catch (error) {
      cancel(owner, request.id);
      // The full reason, without anything key-like, stays in the local log for diagnosing.
      console.warn('[model-request] failed:', String(error?.message ?? error).replace(/(AIza|sk-)[\w-]{8,}/gu, '***').replace(/key=[^&\s]+/giu, 'key=***').slice(0, 600));
      throw new Error(describeModelError(error));
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
        result = { done: next.done, value: next.done ? undefined : encoder.encode(JSON.stringify(geminiChunkPayload(next.value))) };
      } else result = session.reader ? await session.reader.read() : { done: true };
      session.bytes += result.value?.byteLength || 0;
      if (session.bytes > MAX_RESPONSE_BYTES) throw new Error('response-too-large');
      if (result.done) cancel(owner, id);
      return result;
    } catch (error) {
      cancel(owner, id);
      // Keep the kind of failure (timeout, connection reset, too large) so a dropped stream can
      // be told apart from the rest; no URL, key or body text is included.
      const reason = String(error?.cause?.code || error?.code || (error?.message === 'response-too-large' ? 'too-large' : error?.name) || '').slice(0, 40);
      throw new Error(`模型响应读取失败${reason && reason !== 'Error' ? `（${reason}）` : ''}，请重试。`);
    } finally { session.reading = false; }
  }
  return { open, read, cancel, cancelOwner: (owner) => {
    for (const [id, session] of sessions) if (session.owner === owner) cancel(owner, id);
  } };
}

module.exports = { createModelRequestService, describeModelError };
