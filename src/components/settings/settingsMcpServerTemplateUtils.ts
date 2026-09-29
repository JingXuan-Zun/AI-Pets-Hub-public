import type { SettingsMcpServerDraft } from './settingsMcpConfigFormUtils';

export interface SettingsMcpServerTemplate {
  description: string;
  draft: SettingsMcpServerDraft;
  id: string;
  title: string;
}

function createDraft(options: {
  args: string[];
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  id: string;
  title: string;
}): SettingsMcpServerDraft {
  return {
    argsText: options.args.join('\n'),
    command: options.command,
    cwd: options.cwd ?? '',
    envJson: JSON.stringify(options.env ?? {}, null, 2),
    id: options.id,
    title: options.title,
  };
}

export function createMcpServerTemplates(): SettingsMcpServerTemplate[] {
  return [{
    description: 'Replace the script path with a real stdio MCP server script before saving.',
    draft: createDraft({
      args: ['C:\\path\\to\\real-mcp-server.js'],
      command: 'node',
      id: 'local-stdio-server',
      title: 'Local stdio MCP server',
    }),
    id: 'local-node-stdio',
    title: 'Local Node stdio',
  }, {
    description: 'Replace the package name and required env values before running readiness.',
    draft: createDraft({
      args: ['-y', '@vendor/real-mcp-server'],
      command: 'npx.cmd',
      env: { API_KEY: 'replace-me' },
      id: 'npx-package-server',
      title: 'NPX package MCP server',
    }),
    id: 'npx-package',
    title: 'NPX package',
  }];
}

export function createMcpServerReadyDraftExamples(): SettingsMcpServerTemplate[] {
  return [{
    description: 'Static-preflight-ready NPX shape. Run readiness and soak to prove this package works locally.',
    draft: createDraft({
      args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
      command: 'npx.cmd',
      id: 'filesystem',
      title: 'Filesystem MCP server',
    }),
    id: 'static-ready-npx-filesystem',
    title: 'Static-ready filesystem',
  }];
}

export function cloneMcpServerTemplateDraft(template: SettingsMcpServerTemplate) {
  return {
    ...template.draft,
  };
}
