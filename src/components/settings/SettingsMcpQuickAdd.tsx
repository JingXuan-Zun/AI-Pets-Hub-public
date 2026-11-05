import { useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, Plug, XCircle } from 'lucide-react';
import { parseMcpQuickAdd, type McpServerDraft } from '../../plugins/mcpQuickAdd';
import { addMcpServers, missingMcpEnvKeys, testMcpServer, type McpTestResult } from '../../plugins/mcpInstall';
import type { PetConfig } from '../../types';

/**
 * "Add an MCP tool" in one box: paste a command line, a URL or the README's JSON, fill any key it
 * asks for, and it is saved and started once to show whether it works and which tools it has.
 */
export function SettingsMcpQuickAdd({ onAdded, renderAdvanced, settings }: {
  onAdded: (message: string) => void;
  renderAdvanced?: () => ReactNode;
  /** For the one-line summary on the plugin card, written by the chat model. */
  settings?: PetConfig['settings'];
}) {
  const [input, setInput] = useState('');
  const [name, setName] = useState('');
  const [env, setEnv] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, McpTestResult>>({});
  const [busy, setBusy] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const parsed = useMemo(() => (input.trim() ? parseMcpQuickAdd(input, name) : null), [input, name]);
  const servers: McpServerDraft[] = parsed?.ok ? parsed.servers : [];
  const envKeys = [...new Set(servers.flatMap((server) => Object.keys(server.env)))];
  const missingKeys = missingMcpEnvKeys(servers, env);
  const showResult = (serverId: string, result: McpTestResult) => setResults((current) => ({ ...current, [serverId]: result }));

  const test = (server: McpServerDraft) => testMcpServer(server, settings, (result) => showResult(server.id, result));

  const add = async () => {
    if (!servers.length || missingKeys.length) return;
    setBusy(true);
    try {
      const added = await addMcpServers(servers, { envValues: env, onProgress: showResult, settings });
      const working = added.results.filter((item) => item.result.status === 'ok').length;
      const herBrowserNote = added.pointedAtHerBrowser ? '浏览器插件已设成在她自己的浏览器里操作（到插件页面点“打开她的浏览器”登录她的账号）。' : '';
      onAdded(`${working === servers.length ? `已添加 ${servers.map((server) => server.id).join('、')}，连接正常。` : `已添加，但有 ${servers.length - working} 个没连上，看下面的原因。`}${herBrowserNote}`);
    } catch (error) {
      onAdded(`添加失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-primary/30 bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Plug className="h-4 w-4 text-primary" />添加 MCP 工具</div>
      <p className="mt-1 text-2xs leading-5 text-muted-foreground">
        把 MCP 项目说明（README）里的启动命令、网址，或整段 JSON 配置贴进来就行。例如 <code className="rounded bg-muted px-1">npx -y @modelcontextprotocol/server-filesystem D:\文档</code>
      </p>
      <textarea
        value={input}
        onChange={(event) => { setInput(event.target.value); setResults({}); }}
        rows={4}
        placeholder={'npx -y 包名 参数\n或 https://…\n或 { "mcpServers": { … } }'}
        className="mt-2 w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary"
      />
      {parsed && !parsed.ok ? <p className="mt-1 text-2xs text-amber-700">{'error' in parsed ? parsed.error : ''}</p> : null}

      {servers.length ? (
        <div className="mt-2 space-y-2">
          {servers.length === 1 ? (
            <label className="flex items-center gap-2 text-2xs text-muted-foreground">
              名字（英文，可改）
              <input value={name || servers[0].id} onChange={(event) => setName(event.target.value)} className="h-7 w-48 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary" />
            </label>
          ) : null}
          {servers.map((server) => {
            const result = results[server.id];
            return (
              <div key={server.id} className="rounded-md bg-muted/30 px-3 py-2 text-2xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{server.id}</span>
                  <code className="min-w-0 flex-1 truncate text-muted-foreground">{server.url || [server.command, ...server.args].join(' ')}</code>
                  {result?.status === 'testing' ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
                  {result?.status === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : null}
                  {result?.status === 'failed' ? <XCircle className="h-3.5 w-3.5 text-red-600" /> : null}
                </div>
                {result?.status === 'testing' ? <p className="mt-1 text-muted-foreground">正在启动并读取工具（第一次可能要下载，最多等半分钟）…</p> : null}
                {result?.status === 'ok' && result.summary ? <p className="mt-1 font-semibold text-foreground">{result.summary}</p> : null}
                {result?.status === 'ok' ? <p className="mt-1 text-emerald-700">已连接，提供 {result.tools.length} 个工具：{result.tools.slice(0, 12).join('、')}{result.tools.length > 12 ? '…' : ''}</p> : null}
                {result?.status === 'failed' ? (
                  <div className="mt-1 whitespace-pre-wrap text-red-700">
                    {result.message}
                    <button type="button" onClick={() => void test(server)} className="ml-2 rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-muted">重新测试</button>
                  </div>
                ) : null}
              </div>
            );
          })}
          {envKeys.length ? (
            <div className="space-y-1">
              <p className="text-2xs text-muted-foreground">它需要这些设置（多半是你自己的密钥，只保存在本机）：</p>
              {envKeys.map((key) => (
                <label key={key} className="flex items-center gap-2 text-2xs">
                  <code className="w-56 shrink-0 truncate text-foreground">{key}</code>
                  <input
                    type="password"
                    value={env[key] ?? ''}
                    placeholder={missingKeys.includes(key) ? '需要填写' : '已从配置读取，可不改'}
                    onChange={(event) => setEnv((current) => ({ ...current, [key]: event.target.value }))}
                    className={`h-7 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs outline-none focus:border-primary ${missingKeys.includes(key) ? 'border-amber-500' : 'border-border'}`}
                  />
                </label>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || !servers.length || missingKeys.length > 0} onClick={() => void add()} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}添加并测试
        </button>
        {missingKeys.length ? <span className="text-2xs text-amber-700">先填好上面标黄的设置</span> : null}
        {renderAdvanced ? (
          <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="ml-auto inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground">
            {showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}高级配置（JSON、诊断、调用记录）
          </button>
        ) : null}
      </div>
      {showAdvanced && renderAdvanced ? <div className="mt-3">{renderAdvanced()}</div> : null}
    </section>
  );
}
