import type { PetConfig } from '../types';
import { herBrowserUrl, pointAtHerBrowser } from './herBrowser';
import { explainMcpProblem, type McpServerDraft } from './mcpQuickAdd';
import { saveMcpServerDescription, summarizeMcpTools } from './mcpSummary';
import { updateMcpServers } from './pluginPackages';

// Adding MCP servers, the same way from the "添加 MCP 工具" box and when she installs one from a
// link: saved to the MCP config (a browser plugin pointed at her browser), started once to see
// that it works and which tools it has, and given its one-line description for the card.

/** Placeholders READMEs leave for the user's own key: <TOKEN>, YOUR_API_KEY, xxx… */
export const MCP_ENV_PLACEHOLDER = /^(?:<[^>]*>|your[_-].*|.*[_-]here|x{3,}|\.\.\.|)$/iu;

export type McpTestResult = { status: 'testing' } | { status: 'ok'; summary?: string; tools: string[] } | { status: 'failed'; message: string };

/** Keys a server still needs from the user (its README left a placeholder). */
export function missingMcpEnvKeys(servers: McpServerDraft[], values: Record<string, string> = {}) {
  const keys = [...new Set(servers.flatMap((server) => Object.keys(server.env)))];
  return keys.filter((key) => MCP_ENV_PLACEHOLDER.test((values[key] ?? servers.find((server) => key in server.env)?.env[key] ?? '').trim()));
}

export async function testMcpServer(server: Pick<McpServerDraft, 'command' | 'id'>, settings: PetConfig['settings'] | undefined, onProgress?: (result: McpTestResult) => void): Promise<McpTestResult> {
  onProgress?.({ status: 'testing' });
  const shell = window.desktopPetShell;
  try {
    const diagnostic = await shell?.inspectMcpServer?.({ serverId: server.id });
    if (!diagnostic?.ok) {
      const failed = { message: explainMcpProblem(diagnostic?.compatibility?.issueCode, server.command, diagnostic?.stderrSnippet || diagnostic?.error || ''), status: 'failed' } as const;
      onProgress?.(failed);
      return failed;
    }
    const listed = await shell?.listMcpTools?.({ serverId: server.id });
    const found = (listed?.tools ?? []).filter((tool) => tool.serverId === server.id);
    const tools = found.map((tool) => tool.name);
    onProgress?.({ status: 'ok', tools });
    if (!settings || !found.length) return { status: 'ok', tools };
    // What it lets her do, in one sentence for the plugin card (once, when it is added).
    const summary = await summarizeMcpTools(found, settings);
    await saveMcpServerDescription(server.id, summary).catch(() => undefined);
    const done = { status: 'ok', summary, tools } as const;
    onProgress?.(done);
    return done;
  } catch (error) {
    const failed = { message: explainMcpProblem(undefined, server.command, error instanceof Error ? error.message : ''), status: 'failed' } as const;
    onProgress?.(failed);
    return failed;
  }
}

/** Saves the servers and tries each once; `pointedAtHerBrowser` when a browser plugin was set to use her browser. */
export async function addMcpServers(
  servers: McpServerDraft[],
  options: { envValues?: Record<string, string>; onProgress?: (serverId: string, result: McpTestResult) => void; origin?: 'link' | 'user'; settings?: PetConfig['settings'] } = {},
) {
  const browserUrl = herBrowserUrl(options.settings);
  const pointed = servers.map((server) => pointAtHerBrowser(server.args, browserUrl));
  const origin = options.origin ?? 'user';
  const entries = servers.map((server, index) => (server.url
    ? { id: server.id, origin, title: server.title, url: server.url }
    : { args: pointed[index].args, command: server.command, env: Object.fromEntries(Object.keys(server.env).map((key) => [key, options.envValues?.[key] ?? server.env[key]])), id: server.id, origin, title: server.title }));
  await updateMcpServers((current) => [...current.filter((item) => !entries.some((entry) => entry.id === item.id)), ...entries]);
  const results = await Promise.all(servers.map((server) => testMcpServer(server, options.settings, (result) => options.onProgress?.(server.id, result))));
  return { pointedAtHerBrowser: pointed.some((item) => item.changed), results: servers.map((server, index) => ({ id: server.id, result: results[index] })) };
}
