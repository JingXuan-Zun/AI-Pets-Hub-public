export interface DesktopModelRequest {
  provider: 'openai' | 'gemini';
  credentialField: 'customApiKey' | 'visionCustomApiKey' | 'geminiApiKey';
  credential?: string;
  endpoint?: string;
  body?: unknown;
  args?: unknown;
  stream?: boolean;
  operation?: 'models';
}

export function desktopModelBridge() {
  if (typeof window === 'undefined' || !window.desktopPetShell?.desktopMode) return null;
  const shell = window.desktopPetShell;
  if (!shell.openModelRequest || !shell.readModelRequest || !shell.cancelModelRequest) {
    throw new Error('模型连接不可用，请重新启动应用。');
  }
  return { open: shell.openModelRequest, read: shell.readModelRequest, cancel: shell.cancelModelRequest };
}

export async function openDesktopModel(request: DesktopModelRequest, signal?: AbortSignal | null) {
  const bridge = desktopModelBridge();
  if (!bridge) throw new Error('模型连接不可用。');
  const id = crypto.randomUUID();
  const cancel = () => { void bridge.cancel(id).catch(() => undefined); };
  signal?.throwIfAborted();
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    const metadata = await bridge.open({ ...request, id });
    signal?.throwIfAborted();
    return { metadata, read: async () => {
      signal?.throwIfAborted();
      const chunk = await bridge.read(id);
      signal?.throwIfAborted();
      return chunk;
    }, close: () => { signal?.removeEventListener('abort', cancel); cancel(); } };
  } catch (error) {
    signal?.removeEventListener('abort', cancel);
    cancel();
    throw error;
  }
}

/** Keep browser development usable; desktop mode never falls back to renderer networking. */
export async function requestModelFetch(endpoint: string, options: RequestInit,
  credential: string, credentialField: 'customApiKey' | 'visionCustomApiKey' = 'customApiKey') {
  if (!desktopModelBridge()) {
    if (credential.startsWith('desktop-pet-credential:')) throw new Error('请重新填写 API Key。');
    return fetch(endpoint, { ...options, headers: { ...options.headers,
      ...(credential.trim() ? { Authorization: `Bearer ${credential.trim()}` } : {}) } });
  }
  const stream = await openDesktopModel({ provider: 'openai', endpoint, credential, credentialField,
    body: options.body ? JSON.parse(String(options.body)) : undefined,
    operation: options.method === 'GET' ? 'models' : undefined,
    stream: new Headers(options.headers).get('Accept') === 'text/event-stream' }, options.signal);
  if ([204, 205, 304].includes(stream.metadata.status)) {
    stream.close();
    return new Response(null, { status: stream.metadata.status });
  }
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await stream.read();
        if (chunk.done) { controller.close(); stream.close(); }
        else if (chunk.value) controller.enqueue(new Uint8Array(chunk.value));
      } catch (error) { controller.error(error); stream.close(); }
    },
    cancel() { stream.close(); },
  });
  return new Response(body, { status: stream.metadata.status,
    headers: { 'content-type': stream.metadata.contentType } });
}
