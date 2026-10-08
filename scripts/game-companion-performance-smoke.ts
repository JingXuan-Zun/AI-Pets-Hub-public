import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { readModuleProjectFile } from './projectModuleSource.mjs';

const controllerSource = readFileSync('src/components/pet/useGameCompanionLoopController.ts', 'utf8');
const captureServiceSource = readModuleProjectFile('electron/captureService.cjs');
const captureScriptSource = readFileSync('electron/capturePowerShellScripts.cjs', 'utf8');

assert.match(controllerSource, /sourceId: state\.lockedSourceId \?\? state\.sourceId/u);
assert.match(captureServiceSource, /sourceId = ''/u);
assert.match(captureServiceSource, /getNativeWindowCaptureSources\(\{ includeThumbnails, sourceId, thumbnailSize:/u);
assert.match(captureServiceSource, /if \(!sourceId\.trim\(\)\)/u);
assert.match(captureScriptSource, /requestedWindowHandle/u);
assert.match(captureScriptSource, /hWnd\.ToInt64\(\) -ne \$requestedWindowHandle/u);

assert.match(captureServiceSource, /CAPTURE_SOURCE_ANALYSIS_THUMBNAIL_SIZE = \{ width: 960, height: 540 \}/u);
assert.match(captureServiceSource, /sourceId \? CAPTURE_SOURCE_ANALYSIS_THUMBNAIL_SIZE : CAPTURE_SOURCE_THUMBNAIL_SIZE/u);
assert.match(captureScriptSource, /const thumbnailSize = options\.thumbnailSize/u);
assert.match(captureScriptSource, /maxThumbnailWidth/u);
assert.match(controllerSource, /sourceId: selectedSource\.id/u);
assert.match(controllerSource, /focusedSources[\s\S]*focusedSource/u);
assert.match(controllerSource, /GAME_COMPANION_PENDING_REPLY_RECHECK_MS = 2500/u);
assert.match(controllerSource, /MAX_CONSECUTIVE_GAME_COMPANION_CAPTURE_FAILURES = 4/u);

console.log('game companion performance smoke passed');
