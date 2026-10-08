const { isSafeExternalUrl } = require('./ipcSenderGuard.cjs');

function prepareUrlTarget(action, clock) {
  const startedAt = clock.now();
  const targetUrl = String(action.command || '').trim();
  if (!targetUrl) {
    return {
      ok: false,
      error: 'Missing URL.',
      execution: {
        kind: 'open-url',
        startedAt,
      },
      verification: {
        confidence: 'failed',
        ok: false,
        reason: 'missing-url',
        summary: '缺少要打开的 URL。',
      },
    };
  }

  if (!isSafeExternalUrl(targetUrl)) {
    return {
      ok: false,
      error: 'Only http, https and mailto links can be opened.',
      execution: {
        kind: 'open-url',
        startedAt,
        target: targetUrl,
      },
      verification: {
        confidence: 'failed',
        ok: false,
        reason: 'unsupported-url-protocol',
        summary: '只能打开 http、https 或 mailto 链接。',
      },
    };
  }
  return { ok: true, targetUrl, startedAt };
}

function checkUrlShell(shell, targetUrl, startedAt) {
  if (!shell || typeof shell.openExternal !== 'function') {
    return {
      ok: false,
      error: 'Electron shell.openExternal is unavailable.',
      execution: {
        kind: 'open-url',
        startedAt,
        target: targetUrl,
      },
      verification: {
        confidence: 'failed',
        ok: false,
        reason: 'shell-open-url-unavailable',
        summary: 'Electron shell.openExternal 不可用。',
      },
    };
  }
  return null;
}

function urlOpenAccepted(targetUrl, startedAt) {
  return {
    execution: {
      kind: 'open-url',
      observation: '系统打开 URL 请求没有返回错误。',
      startedAt,
      target: targetUrl,
    },
    ok: true,
    verification: {
      confidence: 'request-accepted',
      ok: true,
      reason: 'shell-open-url-accepted',
      summary: '系统打开 URL 请求没有返回错误；当前没有进一步确认浏览器页面状态。',
    },
  };
}

function urlOpenException(targetUrl, startedAt, error) {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    execution: {
      kind: 'open-url',
      observation: '系统打开 URL 请求异常。',
      startedAt,
      target: targetUrl,
    },
    verification: {
      confidence: 'failed',
      ok: false,
      reason: 'shell-open-url-exception',
      summary: '系统打开 URL 请求异常。',
    },
  };
}

async function openUrlAction(action, shell, clock = Date) {
  const target = prepareUrlTarget(action, clock);
  if (!target.ok) return target;
  const { targetUrl, startedAt } = target;
  const unavailable = checkUrlShell(shell, targetUrl, startedAt);
  if (unavailable) return unavailable;
  try {
    await shell.openExternal(targetUrl);
    return urlOpenAccepted(targetUrl, startedAt);
  } catch (error) {
    return urlOpenException(targetUrl, startedAt, error);
  }
}

module.exports = { openUrlAction };
