// When a failed model request is worth trying again (2026-11-09, after DeepSeek's dsh-superagent
// prototype: a passing failure of the model provider or the network — 408, 429 for request rate,
// 5xx, a refused / reset / timed-out connection — is retried three times with a growing pause
// before it counts as failed). Before, a chat reply got one retry after 1 s, so a provider hiccup
// of half a minute (DeepSeek 503 on 11-03) failed the reply outright.

/** Pauses before the 2nd, 3rd and 4th attempt of a passing failure. */
export const TRANSIENT_RETRY_DELAYS_MS = [2_000, 5_000, 10_000] as const;
/** Anything else that failed before a word arrived keeps its single quick retry. */
export const OTHER_RETRY_DELAYS_MS = [1_000] as const;

const TRANSIENT_PATTERNS = [
  // electron/modelRequestService.cjs describes errors in Chinese; raw texts are matched too.
  /连不上接口服务器/u,
  /模型响应读取失败/u,
  /请求太频繁了/u,
  /HTTP (?:408|5\d\d)\b/u,
  /\b(?:408|500|502|503|504|529)\b/u,
  /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed|network error|Failed to fetch/iu,
  /overloaded|temporarily unavailable|service unavailable|bad gateway|gateway time-?out/iu,
  /超时/u,
];

// Waiting does not help these: keys, models, balance, permissions, a daily limit.
const PERMANENT_PATTERNS = [
  /API Key 无效|找不到这个模型|没有权限|余额|额度|每天限额|接口地址不对|密钥|内容太大/u,
  /\b(?:400|401|402|403|404|413)\b/u,
];

export function isTransientModelError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (PERMANENT_PATTERNS.some((pattern) => pattern.test(message))) return false;
  return TRANSIENT_PATTERNS.some((pattern) => pattern.test(message));
}

/** The pause before the next attempt, or null when it is time to give up. */
export function nextModelRetryDelay(error: unknown, failedAttempts: number) {
  const delays = isTransientModelError(error) ? TRANSIENT_RETRY_DELAYS_MS : OTHER_RETRY_DELAYS_MS;
  return failedAttempts <= delays.length ? delays[failedAttempts - 1] : null;
}

/** Sleeps, but ends at once (rejecting) when the user stops the reply. */
export function waitBeforeRetry(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
