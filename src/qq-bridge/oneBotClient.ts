// A small OneBot v11 forward-WebSocket client: events and API calls share one socket.
// Only what the bridge needs: private text messages in, private text messages out.

export type OneBotImage = { file: string; url: string };

export type OneBotPrivateMessage = {
  /** Pictures in the message: Tencent's download address, or a file id to ask SnowLuma for one. */
  images: OneBotImage[];
  messageId: string;
  /** The voice message's file id (for get_record), when the user sent voice. */
  voiceFile: string | null;
  text: string;
  userId: string;
};

export type OneBotClientStatus = 'connecting' | 'connected' | 'disconnected';

type SocketLike = {
  close: () => void;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onopen: ((event: unknown) => void) | null;
  readyState: number;
  send: (data: string) => void;
};

export type OneBotClientOptions = {
  accessToken?: string;
  /** Called before each connection attempt; wins over accessToken (e.g. read from SnowLuma's config). */
  resolveAccessToken?: () => Promise<string>;
  createSocket?: (url: string) => SocketLike;
  onMessage: (message: OneBotPrivateMessage) => void;
  /** A reply QQ refused even after the retries (e.g. Tencent's "网络连接异常"). */
  onSendFailed?: (text: string, reason: string) => void;
  onStatus?: (status: OneBotClientStatus, detail?: string) => void;
  /** Waits between send retries; tests shorten them. */
  sendRetryDelaysMs?: number[];
  url: string;
};

/** Plain text, or OneBot segments (an image, a voice message). */
export type OneBotOutgoingMessage = string | Array<{ data: Record<string, string>; type: string }>;

function describeOutgoing(message: OneBotOutgoingMessage) {
  return typeof message === 'string' ? message : message.map((segment) => `[${segment.type}]`).join('');
}

const OPEN = 1;
const RECONNECT_MIN_MS = 2000;
const RECONNECT_MAX_MS = 30000;
// Tencent sometimes refuses a send for a moment ("网络连接异常"); the same message usually
// goes through a few seconds later.
const SEND_RETRY_DELAYS_MS = [3000, 10000];
// QQ cuts very long messages; long replies go out in pieces.
export const ONEBOT_MAX_MESSAGE_CHARS = 1500;

/** The access token travels as a query parameter: a browser WebSocket cannot set headers. */
export function buildOneBotUrl(url: string, accessToken = '') {
  const token = accessToken.trim();
  if (!token) return url;
  return `${url}${url.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`;
}

/** The plain text of a OneBot message (string with CQ codes, or an array of segments). */
export function extractOneBotText(message: unknown) {
  if (typeof message === 'string') {
    return message.replace(/\[CQ:[^\]]*\]/gu, '').replace(/&#91;/gu, '[').replace(/&#93;/gu, ']').replace(/&amp;/gu, '&').trim();
  }
  if (!Array.isArray(message)) return '';
  return message
    .filter((segment) => segment?.type === 'text' && typeof segment?.data?.text === 'string')
    .map((segment) => segment.data.text as string)
    .join('')
    .trim();
}

/** The file id of a voice segment ([CQ:record,file=…] or a record segment), or null. */
export function findOneBotRecordFile(message: unknown) {
  if (typeof message === 'string') {
    return message.match(/\[CQ:record,[^\]]*?file=([^,\]]+)/u)?.[1] ?? null;
  }
  if (!Array.isArray(message)) return null;
  const record = message.find((segment) => segment?.type === 'record');
  const file = record?.data?.file ?? record?.data?.file_id;
  return typeof file === 'string' && file ? file : null;
}

function unescapeCq(value: string) {
  return value.replace(/&#44;/gu, ',').replace(/&#91;/gu, '[').replace(/&#93;/gu, ']').replace(/&amp;/gu, '&');
}

/** The pictures of a message (segments or [CQ:image,…] codes). */
export function findOneBotImages(message: unknown): OneBotImage[] {
  if (typeof message === 'string') {
    return [...message.matchAll(/\[CQ:image,([^\]]*)\]/gu)].map((match) => {
      const fields = Object.fromEntries(match[1].split(',').map((pair) => {
        const at = pair.indexOf('=');
        return [pair.slice(0, at), unescapeCq(pair.slice(at + 1))];
      }));
      return { file: fields.file ?? '', url: fields.url ?? '' };
    }).filter((image) => image.file || image.url);
  }
  if (!Array.isArray(message)) return [];
  return message
    .filter((segment) => segment?.type === 'image')
    .map((segment) => ({ file: String(segment.data?.file ?? ''), url: String(segment.data?.url ?? '') }))
    .filter((image) => image.file || image.url);
}

/** A private message event, or null for anything else (group messages, heartbeats, API replies). */
export function parseOneBotPrivateMessage(raw: unknown): OneBotPrivateMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const event = raw as Record<string, unknown>;
  if (event.post_type !== 'message' || event.message_type !== 'private') return null;
  const text = extractOneBotText(event.message ?? event.raw_message);
  const voiceFile = findOneBotRecordFile(event.message);
  const images = findOneBotImages(event.message);
  if (!text && !voiceFile && !images.length) return null;
  return {
    images,
    messageId: String(event.message_id ?? ''),
    text,
    userId: String(event.user_id ?? ''),
    voiceFile,
  };
}

/** Cuts a long reply at line breaks (or hard) into pieces QQ will accept. */
export function splitOneBotText(text: string, maxChars = ONEBOT_MAX_MESSAGE_CHARS) {
  const pieces: string[] = [];
  let rest = text.trim();
  while (rest.length > maxChars) {
    const cut = rest.lastIndexOf('\n', maxChars);
    const at = cut > maxChars / 2 ? cut : maxChars;
    pieces.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}

export function createOneBotClient(options: OneBotClientOptions) {
  const createSocket = options.createSocket ?? ((url: string) => new WebSocket(url) as unknown as SocketLike);
  let socket: SocketLike | null = null;
  let stopped = false;
  let retryMs = RECONNECT_MIN_MS;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let echo = 0;
  const retryDelays = options.sendRetryDelaysMs ?? SEND_RETRY_DELAYS_MS;
  // Sends still waiting for QQ's answer, by echo: the piece and how many retries it had.
  const pendingSends = new Map<string, { attempt: number; message: OneBotOutgoingMessage; userId: number }>();
  const sendTimers = new Set<ReturnType<typeof setTimeout>>();
  // Other API calls waiting for their answer (get_record …), by echo.
  const pendingCalls = new Map<string, { reject: (error: Error) => void; resolve: (data: Record<string, unknown>) => void }>();

  const sendPiece = (userId: number, message: OneBotOutgoingMessage, attempt: number) => {
    if (!socket || socket.readyState !== OPEN) {
      options.onSendFailed?.(describeOutgoing(message), '没有连上 SnowLuma');
      return;
    }
    echo += 1;
    const id = `desktop-pet-${echo}`;
    pendingSends.set(id, { attempt, message, userId });
    socket.send(JSON.stringify({ action: 'send_private_msg', echo: id, params: { message, user_id: userId } }));
  };

  /** QQ's answer to one of our sends: done, or retried after a pause, or reported as failed. */
  const handleSendResult = (data: Record<string, unknown>) => {
    const id = typeof data.echo === 'string' ? data.echo : '';
    const call = pendingCalls.get(id);
    if (call) {
      pendingCalls.delete(id);
      if (data.status === 'ok' && data.data && typeof data.data === 'object') call.resolve(data.data as Record<string, unknown>);
      else call.reject(new Error(String(data.wording ?? data.message ?? data.msg ?? data.retcode ?? '调用失败')));
      return;
    }
    const pending = pendingSends.get(id);
    if (!pending) return;
    pendingSends.delete(id);
    if (data.status === 'ok') return;
    const reason = String(data.wording ?? data.message ?? data.msg ?? data.retcode ?? '未知原因');
    const delay = retryDelays[pending.attempt];
    if (delay === undefined || stopped) {
      options.onSendFailed?.(describeOutgoing(pending.message), reason);
      return;
    }
    const timer = setTimeout(() => {
      sendTimers.delete(timer);
      if (!stopped) sendPiece(pending.userId, pending.message, pending.attempt + 1);
    }, delay);
    sendTimers.add(timer);
  };

  const connect = async () => {
    if (stopped) return;
    options.onStatus?.('connecting');
    // Looked up again on every attempt: the service may set a new token after it logs in.
    const accessToken = options.resolveAccessToken
      ? await options.resolveAccessToken().catch(() => options.accessToken ?? '')
      : options.accessToken;
    if (stopped) return;
    let current: SocketLike;
    try {
      current = createSocket(buildOneBotUrl(options.url, accessToken));
    } catch (error) {
      options.onStatus?.('disconnected', error instanceof Error ? error.message : String(error));
      scheduleReconnect();
      return;
    }
    socket = current;
    current.onopen = () => {
      retryMs = RECONNECT_MIN_MS;
      options.onStatus?.('connected');
    };
    current.onmessage = (event) => {
      let data: unknown;
      try {
        data = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (data && typeof data === 'object' && 'echo' in data) {
        handleSendResult(data as Record<string, unknown>);
        return;
      }
      const message = parseOneBotPrivateMessage(data);
      if (message) options.onMessage(message);
    };
    current.onerror = () => undefined;
    current.onclose = () => {
      if (socket === current) socket = null;
      if (stopped) return;
      options.onStatus?.('disconnected', '连接断开，稍后自动重连');
      scheduleReconnect();
    };
  };

  const scheduleReconnect = () => {
    if (stopped || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void connect();
    }, retryMs);
    retryMs = Math.min(retryMs * 2, RECONNECT_MAX_MS);
  };

  const sendPrivateText = (userId: string, text: string) => {
    if (!socket || socket.readyState !== OPEN) return false;
    for (const piece of splitOneBotText(text)) sendPiece(Number(userId), piece, 0);
    return true;
  };

  /** An image (a sticker): base64 without the data: prefix; SnowLuma uploads it. */
  const sendPrivateImage = (userId: string, base64: string) => {
    if (!socket || socket.readyState !== OPEN) return false;
    sendPiece(Number(userId), [{ data: { file: `base64://${base64}` }, type: 'image' }], 0);
    return true;
  };

  void connect();

  /** A voice message: any audio as base64; SnowLuma converts it to QQ's voice format. */
  const sendPrivateRecord = (userId: string, base64: string) => {
    if (!socket || socket.readyState !== OPEN) return false;
    sendPiece(Number(userId), [{ data: { file: `base64://${base64}` }, type: 'record' }], 0);
    return true;
  };

  /** One OneBot API call and its answer's data (rejects on failure or after a timeout). */
  const callAction = (action: string, params: Record<string, unknown>, timeoutMs = 30000) => new Promise<Record<string, unknown>>((resolve, reject) => {
    if (!socket || socket.readyState !== OPEN) {
      reject(new Error('没有连上 SnowLuma'));
      return;
    }
    echo += 1;
    const id = `desktop-pet-${echo}`;
    const timer = setTimeout(() => {
      pendingCalls.delete(id);
      reject(new Error('超时'));
    }, timeoutMs);
    pendingCalls.set(id, {
      reject: (error) => { clearTimeout(timer); reject(error); },
      resolve: (data) => { clearTimeout(timer); resolve(data); },
    });
    socket.send(JSON.stringify({ action, echo: id, params }));
  });

  /** A received voice message as WAV (base64), transcoded by SnowLuma. */
  const getRecordWavBase64 = async (file: string) => {
    const data = await callAction('get_record', { file, out_format: 'wav' });
    if (typeof data.base64 !== 'string' || !data.base64) throw new Error('语音转码没有返回内容');
    return data.base64;
  };

  /** A download address for a received picture that came without one. */
  const getImageUrl = async (file: string) => {
    const data = await callAction('get_image', { file });
    return typeof data.url === 'string' ? data.url : '';
  };

  /** The QQ number SnowLuma is logged in as. */
  const getLoginUin = async () => String((await callAction('get_login_info', {}, 10000)).user_id ?? '');

  return {
    getImageUrl,
    getLoginUin,
    getRecordWavBase64,
    sendPrivateImage,
    sendPrivateRecord,
    sendPrivateText,
    stop: () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      sendTimers.forEach((timer) => clearTimeout(timer));
      sendTimers.clear();
      pendingSends.clear();
      pendingCalls.forEach((call) => call.reject(new Error('已断开')));
      pendingCalls.clear();
      socket?.close();
      socket = null;
      options.onStatus?.('disconnected');
    },
  };
}

const ONEBOT_TEST_TIMEOUT_MS = 6000;

/** Opens the WebSocket, asks who is logged in, and closes again. */
export function testOneBotConnection(url: string, accessToken: string) {
  return new Promise<{ ok: true; account: string } | { ok: false; error: string }>((resolve) => {
    let socket: WebSocket;
    try {
      socket = new WebSocket(buildOneBotUrl(url, accessToken));
    } catch (error) {
      resolve({ error: error instanceof Error ? error.message : String(error), ok: false });
      return;
    }
    const finish = (result: { ok: true; account: string } | { ok: false; error: string }) => {
      clearTimeout(timer);
      socket.close();
      resolve(result);
    };
    const timer = setTimeout(() => finish({ error: '连接超时：确认 SnowLuma 已经启动、正向 WebSocket 已开启、地址和端口一致。', ok: false }), ONEBOT_TEST_TIMEOUT_MS);
    socket.onopen = () => socket.send(JSON.stringify({ action: 'get_login_info', echo: 'desktop-pet-test', params: {} }));
    socket.onerror = () => finish({ error: '连不上：确认 SnowLuma 已经启动、正向 WebSocket 已开启、地址和端口一致；设了 Token 的话要填一样的。', ok: false });
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data));
        if (data?.echo !== 'desktop-pet-test') return;
        if (data.status === 'ok' && data.data) {
          finish({ account: `${data.data.nickname ?? ''}（${data.data.user_id ?? '?'}）`, ok: true });
        } else {
          finish({ error: `连上了，但服务返回错误：${data.wording ?? data.msg ?? data.retcode ?? '未知'}`, ok: false });
        }
      } catch {
        // Not JSON: ignore and wait.
      }
    };
  });
}
