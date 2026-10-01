import { desktopModelBridge, openDesktopModel } from './modelTransport';

function createDesktopGeminiClient(apiKey: string) {
  async function open(args: any, stream: boolean) {
    const { abortSignal, ...config } = args.config ?? {};
    return openDesktopModel({ provider: 'gemini', credentialField: 'geminiApiKey',
      credential: apiKey, args: { model: args.model, contents: args.contents, config }, stream }, abortSignal);
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

/** Desktop secrets are resolved by the main process; browser keys live only in memory. */
export async function getGeminiClient(apiKey: string | undefined) {
  const normalizedKey = apiKey?.trim();
  if (!normalizedKey) {
    throw new Error('请先在设置中填写 Gemini API Key。');
  }
  if (desktopModelBridge()) return createDesktopGeminiClient(normalizedKey);
  if (normalizedKey.startsWith('desktop-pet-credential:')) throw new Error('请重新填写 Gemini API Key。');
  const { GoogleGenAI } = await import('@google/genai');
  return new GoogleGenAI({ apiKey: normalizedKey });
}
