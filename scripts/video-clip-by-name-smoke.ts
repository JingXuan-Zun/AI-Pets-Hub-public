// A video character plays a clip by name: the spoken name finds its folder (exact, then partial),
// and the request reaches every listener for that model.
import assert from 'node:assert/strict';
import { matchClipFolder } from '../src/platform-capabilities/videoClipCapabilities';
import { publishVideoClipRequest, subscribeVideoClipRequests } from '../src/pet-runtime/video2d/videoItemInteraction';

let checks = 0;
const check = (condition: boolean, label: string) => { assert.ok(condition, label); checks += 1; };
const folders = ['待机', '开心', '跳舞', '打招呼_挥手', '跳舞 2'].map((name) => ({ folderPath: `D:/lib/${name}`, name }));

check(matchClipFolder(folders, '跳舞')?.name === '跳舞', 'exact name first');
check(matchClipFolder(folders, '挥手')?.name === '打招呼_挥手', 'part of a folder name');
check(matchClipFolder(folders, '跳个舞') === null || matchClipFolder(folders, '跳个舞')?.name.startsWith('跳舞') === true, 'no wild guess');
check(matchClipFolder(folders, '给我跳舞吧')?.name === '跳舞', 'a folder name inside a longer request');
check(matchClipFolder(folders, '睡觉') === null, 'nothing matching → null (she gets the list)');
check(matchClipFolder(folders, '') === null, 'empty → null');

const heard: string[] = [];
check(publishVideoClipRequest({ folderPath: 'x', modelUrl: 'm' }) === false, 'no video pet listening → false');
const stop = subscribeVideoClipRequests((request) => heard.push(`${request.modelUrl}:${request.folderPath}`));
check(publishVideoClipRequest({ folderPath: 'D:/lib/跳舞', modelUrl: 'file:///pet.webm' }) && heard[0] === 'file:///pet.webm:D:/lib/跳舞', 'the request reaches the renderer');
stop();

console.log(`video clip by name smoke ok: ${checks} checks`);
