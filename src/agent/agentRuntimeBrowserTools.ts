import { desktopPetShellRuntime } from '../desktopShellRuntime';
import {
  type AgentChatCommandResult,
  type AgentChatExecutionReceipt,
  type AgentStructuredToolEvidence,
  type AgentToolCallCommand,
} from './agentChatCommand';
import { type AgentRuntimeExecutorContext } from './agentRuntimeExecutor';

const AGENT_RUNTIME_CANCELLED_TEXT = '已终止当前 Agent 执行。';

interface BrowserSearchResultLike {
  browserLabel?: string | null;
  error?: string | null;
  ok?: boolean;
  opened?: boolean;
  query?: string | null;
  text?: string | null;
  url?: string | null;
}

function isAgentRuntimeCancellationRequested(runtime: AgentRuntimeExecutorContext) {
  return Boolean(runtime.signal?.aborted);
}

function createAgentRuntimeCancelledResult(target: AgentToolCallCommand | string): AgentChatCommandResult {
  const toolName = typeof target === 'string' ? target : target.name;
  return {
    errorText: AGENT_RUNTIME_CANCELLED_TEXT,
    ok: false,
    receipt: {
      evidenceLines: ['User cancelled the active Agent run before this tool could finish.'],
      status: 'blocked',
      summaryLines: [
        `tool: ${toolName}`,
        'result: cancelled by user',
      ],
      title: 'Agent run cancelled',
      toolName,
      verification: AGENT_RUNTIME_CANCELLED_TEXT,
    },
    responseText: AGENT_RUNTIME_CANCELLED_TEXT,
    verification: AGENT_RUNTIME_CANCELLED_TEXT,
  };
}

async function runCancellableAgentRuntimeTask<T>(
  runtime: AgentRuntimeExecutorContext,
  target: AgentToolCallCommand | string,
  task: Promise<T> | (() => Promise<T>),
): Promise<{ cancelled: true; result: AgentChatCommandResult } | { cancelled: false; value: T }> {
  if (isAgentRuntimeCancellationRequested(runtime)) {
    return {
      cancelled: true,
      result: createAgentRuntimeCancelledResult(target),
    };
  }

  let removeAbortListener: (() => void) | null = null;
  try {
    const taskPromise = typeof task === 'function' ? task() : task;
    const racedValue = await new Promise<T | symbol>((resolve, reject) => {
      const cancelledMarker = Symbol('agent-runtime-cancelled');
      const signal = runtime.signal;
      const handleAbort = () => resolve(cancelledMarker);

      if (signal) {
        if (signal.aborted) {
          resolve(cancelledMarker);
          return;
        }

        signal.addEventListener('abort', handleAbort, { once: true });
        removeAbortListener = () => signal.removeEventListener('abort', handleAbort);
      }

      taskPromise.then(resolve, reject);
    });

    removeAbortListener?.();
    removeAbortListener = null;

    if (typeof racedValue === 'symbol' || isAgentRuntimeCancellationRequested(runtime)) {
      return {
        cancelled: true,
        result: createAgentRuntimeCancelledResult(target),
      };
    }

    return {
      cancelled: false,
      value: racedValue,
    };
  } finally {
    removeAbortListener?.();
  }
}

function getToolStringInput(toolCall: AgentToolCallCommand, keys: string[]) {
  const input = toolCall.input ?? {};
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function getBrowserSearchResultTextLength(result: BrowserSearchResultLike) {
  return typeof result.text === 'string' ? result.text.trim().length : 0;
}

function compactBrowserSearchPageText(value: unknown, maxLength = 520) {
  const text = typeof value === 'string'
    ? value.replace(/\s+/gu, ' ').trim()
    : '';
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

export async function executeBrowserSearch(
  context: AgentRuntimeExecutorContext,
  query: string,
  forceNewPage?: boolean,
): Promise<AgentChatCommandResult> {
  const settings = context.configRef.current.settings;
  const result = await desktopPetShellRuntime.browserSearch({
    query,
    settings: {
      browserSearchBrowserPath: settings.browserSearchBrowserPath,
      browserSearchDebugPort: settings.browserSearchDebugPort,
      browserSearchEngine: settings.browserSearchEngine,
      browserSearchForceNewPage: Boolean(forceNewPage),
      browserSearchForceOpenBrowser: true,
      browserSearchUrlTemplate: settings.browserSearchUrlTemplate,
    },
  }) as BrowserSearchResultLike;

  const browserLabel = result?.browserLabel || '浏览器';
  const resultQuery = result?.query || query;
  const textLength = getBrowserSearchResultTextLength(result ?? {});
  const opened = Boolean(result?.ok || result?.opened || result?.url);
  const observations = [
    `Browser search query: ${resultQuery}`,
    `Browser: ${browserLabel}`,
    result?.url ? `URL: ${result.url}` : '',
    `Extracted text length: ${textLength}`,
    result?.text ? `Page text preview: ${compactBrowserSearchPageText(result.text)}` : '',
  ].filter(Boolean);

  if (result?.ok) {
    return {
      observations,
      ok: true,
      responseText: `已用${browserLabel}搜索：${resultQuery}`,
      verification: result.url
        ? `浏览器已打开并返回页面内容：${result.url}`
        : '浏览器搜索已返回成功状态。',
    };
  }

  if (opened) {
    return {
      observations,
      ok: true,
      responseText: `已打开${browserLabel}并跳到搜索页，但没有读取到可用页面文字。`,
      verification: result?.url
        ? `浏览器页面已打开：${result.url}；页面文字读取未完成。`
        : '浏览器页面已打开；页面文字读取未完成。',
    };
  }

  return {
    errorText: result?.error || '浏览器搜索失败',
    followUp: '可以先在系统设置里检测浏览器，或指定 Chrome/Edge 的可执行文件路径后再试。',
    observations,
    ok: false,
    responseText: `没能完成浏览器搜索：${result?.error || '未知错误'}。`,
    verification: result?.error || null,
  };
}

export async function executeControlBrowser(
  context: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const action = getToolStringInput(toolCall, ['action', 'browserAction', 'operation']);
  const browserResult = await runCancellableAgentRuntimeTask(context, toolCall, () => desktopPetShellRuntime.controlBrowser({
    ...toolCall.input,
    action,
    settings: context.configRef.current.settings,
  }) as Promise<{
    action?: string | null;
    browserLabel?: string | null;
    error?: string | null;
    ok?: boolean;
    page?: { id?: string; title?: string; url?: string } | null;
    pageCount?: number | null;
    pages?: Array<{ id?: string; title?: string; url?: string }> | null;
    query?: string | null;
    text?: string | null;
    url?: string | null;
  }>);
  if (browserResult.cancelled === true) {
    return browserResult.result;
  }

  const result = browserResult.value;
  const pages = Array.isArray(result?.pages) ? result.pages : [];
  const browserAction = result?.action || action || '';
  const observations = [
    `Browser control action: ${browserAction}`,
    result?.browserLabel ? `Browser: ${result.browserLabel}` : '',
    result?.query ? `Query: ${result.query}` : '',
    result?.url ? `URL: ${result.url}` : '',
    result?.page?.id ? `Page id: ${result.page.id}` : '',
    result?.page?.title ? `Page title: ${result.page.title}` : '',
    result?.page?.url ? `Page URL: ${result.page.url}` : '',
    typeof result?.pageCount === 'number' ? `Page count: ${result.pageCount}` : '',
    ...pages.slice(0, 8).map((page, index) => `Tab ${index + 1}: ${page.title || '(untitled)'} ${page.url || ''}`.trim()),
    result?.text ? `Page text:\n${result.text}` : '',
    result?.error ? `Error: ${result.error}` : '',
  ].filter(Boolean);
  const browserActionNeedsPageEvidence = browserAction === 'open_url'
    || browserAction === 'search_web'
    || browserAction === 'read_page'
    || browserAction === 'focus_tab';
  const browserHasPageEvidence = Boolean(
    result?.url
    || result?.page?.url
    || result?.page?.id
    || result?.text
    || pages.length,
  );
  const browserReceiptStatus: AgentChatExecutionReceipt['status'] = result?.ok
    ? browserActionNeedsPageEvidence && !browserHasPageEvidence ? 'unverified' : 'success'
    : 'failed';
  const finalBrowserUrl = result?.page?.url ?? result?.url ?? pages.find((page) => page.url)?.url ?? null;
  const browserStructuredEvidence: AgentStructuredToolEvidence = {
    confidence: browserReceiptStatus === 'success' ? 'high' : 'low',
    finalUrl: finalBrowserUrl,
    status: browserReceiptStatus,
    targetMatched: result?.page?.title ?? finalBrowserUrl ?? result?.query ?? result?.browserLabel ?? (browserAction || null),
  };

  return {
    errorText: result?.ok ? null : result?.error || 'Browser control failed.',
    followUp: browserReceiptStatus === 'unverified'
      ? 'Browser control returned ok, but no page/tab evidence was returned; observe tabs/page state before claiming completion.'
      : null,
    observations,
    ok: Boolean(result?.ok),
    receipt: {
      evidenceLines: observations.slice(0, 18),
      status: browserReceiptStatus,
      summaryLines: [
        'Call: control_browser',
        `Action: ${browserAction || 'unknown'}`,
        result?.browserLabel ? `Browser: ${result.browserLabel}` : '',
        result?.url ? `URL: ${result.url}` : '',
        result?.page?.url ? `Page: ${result.page.url}` : '',
        browserReceiptStatus === 'unverified' ? 'Result: browser action ok, page/tab evidence missing' : '',
      ].filter(Boolean),
      title: '执行回执',
      toolName: 'control_browser',
      verification: browserReceiptStatus === 'unverified'
        ? 'Browser control returned ok, but no page/tab evidence was returned.'
        : result?.ok
        ? 'Controlled browser service returned a successful action result.'
        : result?.error ?? null,
      stateSummary: {
        structuredEvidence: browserStructuredEvidence,
      },
    },
    stateSummary: {
      structuredEvidence: browserStructuredEvidence,
    },
    responseText: result?.ok
      ? [
          `Browser control completed: ${result.action || action}.`,
          result.url ? `URL: ${result.url}` : '',
          result.text ? `Page text:\n${result.text}` : '',
          pages.length ? `Tabs:\n${pages.slice(0, 8).map((page, index) => `${index + 1}. ${page.title || '(untitled)'} ${page.url || ''}`.trim()).join('\n')}` : '',
        ].filter(Boolean).join('\n')
      : `Browser control failed: ${result?.error || 'unknown error'}.`,
    verification: result?.ok
      ? 'Browser control request completed.'
      : result?.error || null,
  };
}
