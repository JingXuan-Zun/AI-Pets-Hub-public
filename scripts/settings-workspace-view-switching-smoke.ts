import assert from 'node:assert/strict';
import { getSettingsWorkspaceSections, SETTINGS_WORKSPACE_VIEWS } from '../src/components/settings/settingsWorkspaceView';
import { readProjectSources } from './smokeTestHarness';

assert.deepEqual(SETTINGS_WORKSPACE_VIEWS.map((view) => view.id), ['workspace', 'inspector', 'logs']);
assert.deepEqual(getSettingsWorkspaceSections('workspace'), ['controls', 'preview', 'stats']);
assert.deepEqual(getSettingsWorkspaceSections('inspector'), ['inspector']);
assert.deepEqual(getSettingsWorkspaceSections('logs'), ['logs']);

const { shellSource } = readProjectSources({
  shellSource: 'src/components/settings/SettingsPanelStandaloneShell.tsx',
});
assert.match(shellSource, /SettingsWorkspaceViewTabs value=\{workspaceView\} onChange=\{setWorkspaceView\}/u);
assert.match(shellSource, /workspaceView === 'inspector' \? \([\s\S]*module=\{activeFeatureModule\}[\s\S]*page=\{activeFeaturePage\}/u);
assert.match(shellSource, /import \{ SettingsWorkspaceLogViewer \} from '\.\/SettingsWorkspaceLogViewer';/u);
assert.match(shellSource, /workspaceView === 'logs' \? <SettingsWorkspaceLogViewer logs=\{logs\} \/> : null/u);

console.log('settings workspace view switching smoke passed');
