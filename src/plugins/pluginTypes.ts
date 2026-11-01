import type { SettingsControlCenterPageId } from '../components/settings/settingsControlCenterNavigation';

// One description per plugin, whatever it came from (an imported SKILL.md, an MCP server, a
// feature built into the pet). The plugin market lists these, and characters read the same
// text when they recommend or explain a plugin. See docs/plugin-system-design-20261028.md §2.

export type PluginKind = 'skill' | 'mcp' | 'native';

export type PluginPermission =
  | 'read-instructions'
  | 'run-program'
  | 'network'
  | 'send-messages'
  | 'credentials'
  | 'change-computer';

export interface PluginManifest {
  /** `<kind>:<id>`, e.g. `skill:drawing-teacher`, `mcp:filesystem`, `native:comfyui`. */
  id: string;
  kind: PluginKind;
  name: string;
  /** One sentence a user understands. */
  description: string;
  permissions: PluginPermission[];
  /** Where it came from, shown on the card. */
  source: string;
  /** False when one setting serves every character (e.g. the QQ connection). */
  roleScoped: boolean;
  /** Characters may use it unless the user turned it off for them. */
  enabledByDefault: boolean;
  settingsPageId?: SettingsControlCenterPageId;
  /** For characters: when it is worth suggesting, and what users can say. */
  useWhen?: string;
  examples?: string[];
  troubleshooting?: string[];
  /** Set when it came as a plugin package (userData/plugins/<id>); uninstalling removes the package. */
  packageId?: string;
  /** Steps to set it up, and what must be installed first (with where to get it). */
  setup?: string[];
  requires?: Array<{ install: string; name: string }>;
  /** Longer text for the plugin's own page, e.g. the opening of a SKILL.md. */
  readme?: string;
  /** Platform capabilities this plugin provides; hidden from characters it is off for. */
  capabilityIds?: string[];
  /** Ready to use, or what is missing. */
  status: { ready: boolean; note?: string };
}

export const PLUGIN_KIND_LABELS: Record<PluginKind, string> = {
  mcp: 'MCP 工具',
  native: '内置',
  skill: '技能',
};

export const PLUGIN_PERMISSION_LABELS: Record<PluginPermission, string> = {
  'change-computer': '改动电脑',
  credentials: '使用账号或密钥',
  network: '联网',
  'read-instructions': '只读说明',
  'run-program': '在电脑上运行程序',
  'send-messages': '替你发消息',
};
