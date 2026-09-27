export type SettingsWorkspaceViewId = 'workspace' | 'inspector' | 'logs';

type SettingsWorkspaceSection = 'controls' | 'preview' | 'stats' | 'inspector' | 'logs';

export const SETTINGS_WORKSPACE_VIEWS: ReadonlyArray<{
  id: SettingsWorkspaceViewId;
  label: string;
}> = [
  { id: 'workspace', label: '工作区' },
  { id: 'inspector', label: '检查器' },
  { id: 'logs', label: '日志' },
];

const SETTINGS_WORKSPACE_SECTIONS: Record<SettingsWorkspaceViewId, SettingsWorkspaceSection[]> = {
  workspace: ['controls', 'preview', 'stats'],
  inspector: ['inspector'],
  logs: ['logs'],
};

export function getSettingsWorkspaceSections(view: SettingsWorkspaceViewId) {
  return SETTINGS_WORKSPACE_SECTIONS[view];
}
