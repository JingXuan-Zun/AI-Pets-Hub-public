import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';
import { readModuleProjectFile } from './projectModuleSource.mjs';

const serviceSource = readModuleProjectFile('electron/desktopIconService.cjs');
const typeSource = readProjectFile('src/vite-env.d.ts');

for (const pattern of [
  /function Resolve-DesktopPetIconMetadata/u,
  /function Get-DesktopPetFileMetadataMap/u,
  /foreach \(\$kind in @\('Desktop', 'CommonDesktopDirectory'\)\)/u,
  /GetFolderPath\(\$kind\)/u,
  /New-Object -ComObject WScript\.Shell/u,
  /Add-DesktopPetIconProperty \$icon 'itemKind' 'system-icon'/u,
  /includeReadOnlyPositionFallback/u,
  /positionSource = "folder-view"/u,
  /positionSource = "ui-automation"/u,
  /for \(const key of \['filePath', 'itemKind', 'path', 'positionSource', 'targetPath'\]\)/u,
  /for \(const key of \['canMove', 'isDirectory', 'isFile', 'isShortcut', 'isSystemIcon'\]\)/u,
]) {
  assert.match(serviceSource, pattern);
}

for (const field of [
  'extension?: string;',
  'filePath?: string;',
  'isDirectory?: boolean;',
  'isFile?: boolean;',
  'isShortcut?: boolean;',
  'isSystemIcon?: boolean;',
  'itemKind?: string;',
  'path?: string;',
  "positionSource?: 'shell-list-view' | 'folder-view' | 'ui-automation' | 'filesystem-fallback' | string;",
  'targetPath?: string;',
]) {
  assert.equal(typeSource.includes(field), true, `${field} should be exposed to renderer types`);
}

console.log('desktop icon metadata source smoke ok');
