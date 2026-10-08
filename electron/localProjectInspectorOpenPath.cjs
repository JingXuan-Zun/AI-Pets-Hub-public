function preparePathAction(action, shell, clock) {
  const startedAt = clock.now();
  const targetPath = String(action.command || '').trim();
  if (!targetPath) {
    return {
      ok: false,
      error: 'Missing path.',
      execution: {
        kind: 'open-path',
        startedAt,
      },
      verification: {
        confidence: 'failed',
        ok: false,
        reason: 'missing-path',
        summary: '缺少要打开的路径。',
      },
    };
  }

  if (!shell || typeof shell.openPath !== 'function') {
    return {
      ok: false,
      error: 'Electron shell.openPath is unavailable.',
      execution: {
        kind: 'open-path',
        startedAt,
        target: targetPath,
      },
      verification: {
        confidence: 'failed',
        ok: false,
        reason: 'shell-open-path-unavailable',
        summary: 'Electron shell.openPath 不可用。',
      },
    };
  }
  return { ok: true, targetPath, startedAt };
}

function pathOpenResult(targetPath, startedAt, error) {
  return error
    ? {
        ok: false,
        error,
        execution: {
          kind: 'open-path',
          observation: '系统打开路径请求返回错误。',
          startedAt,
          target: targetPath,
        },
        verification: {
          confidence: 'failed',
          ok: false,
          reason: 'shell-open-path-error',
          summary: '系统打开路径请求返回错误。',
        },
      }
    : {
        execution: {
          kind: 'open-path',
          observation: '系统打开路径请求没有返回错误。',
          startedAt,
          target: targetPath,
        },
        ok: true,
        verification: {
          confidence: 'request-accepted',
          ok: true,
          reason: 'shell-open-path-accepted',
          summary: '系统打开路径请求没有返回错误；当前没有进一步确认目标程序窗口。',
        },
      };
}

function pathOpenException(targetPath, startedAt, error) {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    execution: {
      kind: 'open-path',
      observation: '系统打开路径请求异常。',
      startedAt,
      target: targetPath,
    },
    verification: {
      confidence: 'failed',
      ok: false,
      reason: 'shell-open-path-exception',
      summary: '系统打开路径请求异常。',
    },
  };
}

async function openPathAction(action, shell, clock = Date) {
  const prepared = preparePathAction(action, shell, clock);
  if (!prepared.ok) return prepared;
  const { targetPath, startedAt } = prepared;
  try {
    const error = await shell.openPath(targetPath);
    return pathOpenResult(targetPath, startedAt, error);
  } catch (error) {
    return pathOpenException(targetPath, startedAt, error);
  }
}

module.exports = { openPathAction };
