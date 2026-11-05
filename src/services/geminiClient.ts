import { desktopModelBridge, openDesktopModel } from './modelTransport';

function createDesktopGeminiClient(apiKey: string, apiUrl: string) {
  async function open(args: any, stream: boolean) {
    const { abortSignal, ...config } = args.config ?? {};
    return openDesktopModel({ provider: 'gemini', credentialField: 'geminiApiKey',
      credential: apiKey, ...(apiUrl ? { endpoint: apiUrl } : {}), args: { model: args.model, contents: args.contents, config }, stream }, abortSignal);
  }
  return { models: {
    async generateContent(args: any) {
      const request = await open(args, false);
      try {
        const chunk = await request.read();
        return JSON.parse(new TextDecoder().decode(chunk.value)) as { text: string };
      } finally { request.close(); }
    },
    async generateContentStream(args: any) {
      const request = await open(args, true);
      return (async function* () {
        try {
          while (true) {
            const chunk = await request.read();
            if (chunk.done) return;
            yield JSON.parse(new TextDecoder().decode(chunk.value)) as { text: string };
          }
        } finally { request.close(); }
      })();
    },
  } };
}

/** Splits a trailing API version off a relay URL; the SDK appends its own. */
function geminiHttpOptions(apiUrl: string) {
  const url = new URL(apiUrl);
  let pathname = url.pathname.replace(/\/+$/u, '');
  const version = /\/(v1beta|v1alpha|v1)$/iu.exec(pathname);
  if (version) pathname = pathname.slice(0, -version[0].length);
  return { baseUrl: url.origin + pathname, ...(version ? { apiVersion: version[1].toLowerCase() } : {}) };
}

/**
 * Desktop secrets are resolved by the main process; browser keys live only in memory.
 * apiUrl is an optional relay endpoint; empty uses the official Gemini endpoint.
 */
export async function getGeminiClient(apiKey: string | undefined, apiUrl?: string) {
  const normalizedKey = apiKey?.trim();
  if (!normalizedKey) {
    throw new Error('请先在设置中填写 Gemini API Key。');
  }
  const normalizedUrl = apiUrl?.trim() ?? '';
  if (desktopModelBridge()) return createDesktopGeminiClient(normalizedKey, normalizedUrl);
  if (normalizedKey.startsWith('desktop-pet-credential:')) throw new Error('请重新填写 Gemini API Key。');
  const { GoogleGenAI } = await import('@google/genai');
  return new GoogleGenAI({ apiKey: normalizedKey, ...(normalizedUrl ? { httpOptions: geminiHttpOptions(normalizedUrl) } : {}) });
}

/**
 * “读取模型” for Gemini: the model names this key can chat with. On the desktop the main
 * process asks (it holds the saved key and only sends it to the saved endpoint).
 */
export async function listGeminiModels(apiKey: string | undefined, apiUrl?: string): Promise<string[]> {
  const normalizedKey = apiKey?.trim();
  if (!normalizedKey) throw new Error('请先填写 Gemini API Key。');
  const normalizedUrl = apiUrl?.trim() ?? '';
  if (desktopModelBridge()) {
    const request = await openDesktopModel({ args: {}, credential: normalizedKey, credentialField: 'geminiApiKey', ...(normalizedUrl ? { endpoint: normalizedUrl } : {}), operation: 'models', provider: 'gemini' });
    try {
      const chunk = await request.read();
      const parsed = JSON.parse(new TextDecoder().decode(chunk.value)) as { models?: unknown };
      return Array.isArray(parsed.models) ? parsed.models.filter((name): name is string => typeof name === 'string') : [];
    } finally { request.close(); }
  }
  if (normalizedKey.startsWith('desktop-pet-credential:')) throw new Error('请重新填写 Gemini API Key。');
  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({ apiKey: normalizedKey, ...(normalizedUrl ? { httpOptions: geminiHttpOptions(normalizedUrl) } : {}) });
  const names: string[] = [];
  for await (const model of await client.models.list({ config: { pageSize: 100 } })) {
    const actions = model.supportedActions;
    if (model.name && (!actions || actions.includes('generateContent'))) names.push(model.name.replace(/^models\//u, ''));
  }
  return names;
}
