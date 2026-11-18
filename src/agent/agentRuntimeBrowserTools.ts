import { runCancellableAgentRuntimeTask } from './agentRuntimeCancellation';
import { desktopPetShellRuntime } from '../desktopShellRuntime';
import {
  type AgentChatCommandResult,
  type AgentChatExecutionReceipt,
  type AgentStructuredToolEvidence,
  type AgentToolCallCommand,
} from './agentChatCommand';
import { type AgentRuntimeExecutorContext } from './agentRuntimeExecutor';

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
