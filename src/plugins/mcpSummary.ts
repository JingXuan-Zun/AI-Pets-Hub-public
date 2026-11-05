import type { PetConfig } from '../types';
import { updateMcpServers } from './pluginPackages';

// One plain sentence on an MCP plugin's card ("让她能操作一个独立的 Chrome 浏览器…") instead of
// "外部工具服务器……启动方式 npx…": written once from the server's tool list when it is added,
// and kept in the MCP config next to the server.

const MAX_SUMMARY = 60;

type McpToolLike = { description?: string; name: string };

/** Without a model: what it offers, by tool name. */
export function fallbackMcpSummary(tools: McpToolLike[]) {
  if (!tools.length) return '';
  const names = tools.slice(0, 6).map((tool) => tool.name).join('、');
  return `提供 ${tools.length} 个工具：${names}${tools.length > 6 ? '等' : ''}`;
}

export function cleanMcpSummary(text: string) {
  const line = text.trim().split(/\r?\n/u).find((item) => item.trim())?.trim() ?? '';
  const plain = line.replace(/^["'“”「」*\s]+|["'“”「」*\s]+$/gu, '');
  return plain.length > MAX_SUMMARY ? `${plain.slice(0, MAX_SUMMARY - 1)}…` : plain;
}

export async function summarizeMcpTools(tools: McpToolLike[], settings: PetConfig['settings']) {
  if (!tools.length) return '';
  try {
    const { getConfiguredCognitionResponse } = await import('../services/geminiService');
    const list = tools.slice(0, 40).map((tool) => `- ${tool.name}：${(tool.description ?? '').replace(/\s+/gu, ' ').slice(0, 100)}`).join('\n');
    const output = await getConfiguredCognitionResponse(
      `这个工具服务器提供的工具：\n${list}`,
      [
        '用一句中文向普通用户说明：装了这个工具服务器后，桌宠角色能帮他做什么。',
        '以“让她能”开头，不超过 30 个字，不要提工具名、MCP、服务器这些词，不要加引号。',
      ].join('\n'),
      settings,
      { maxTokensOverride: 1024, task: 'understanding', timeoutMs: 30000 },
    );
    return cleanMcpSummary(String(output ?? '')) || fallbackMcpSummary(tools);
  } catch {
    return fallbackMcpSummary(tools);
  }
}

export async function saveMcpServerDescription(serverId: string, description: string) {
  if (!description) return;
  await updateMcpServers((servers) => servers.map((server) => (server.id === serverId ? { ...server, description } : server)));
}
