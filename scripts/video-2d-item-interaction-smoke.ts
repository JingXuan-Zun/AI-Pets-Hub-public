import assert from 'node:assert/strict';
import { publishVideoItemInteraction, subscribeVideoItemInteractions } from '../src/pet-runtime/video2d/videoItemInteraction';
import { type FolderItem, type PetConfig } from '../src/types';
import { readProjectSources } from './smokeTestHarness.ts';

const modelUrl = 'local-asset://idle.webm';
const interactionFolder = 'C:/PetVideos/eating';
const config = {
  modelType: '2d',
  modelUrl,
  customModelPresets: [{
    id: 'video-pet',
    name: '视频桌宠',
    type: '2d',
    url: modelUrl,
    renderKind: 'video',
    videoItemBindings: [{ appearanceId: 'apple', folderPath: interactionFolder }],
  }],
} as PetConfig;
const folder = {
  id: 'folder-1',
  name: '苹果',
  position: { x: 0, y: 0 },
  appearanceId: 'apple',
} satisfies FolderItem;
const received: Array<{ modelUrl: string; folderPath: string }> = [];
const unsubscribe = subscribeVideoItemInteractions((event) => received.push(event));

assert.equal(publishVideoItemInteraction(config, folder), true);
assert.deepEqual(received, [{ modelUrl, folderPath: interactionFolder }]);

assert.equal(publishVideoItemInteraction(config, { ...folder, appearanceId: 'unknown' }), false);
assert.equal(publishVideoItemInteraction({ ...config, modelType: '3d' }, folder), false);
assert.equal(publishVideoItemInteraction({ ...config, modelUrl: 'other.webm' }, folder), false);
assert.equal(received.length, 1);

unsubscribe();
assert.equal(publishVideoItemInteraction(config, folder), true);
assert.equal(received.length, 1);
const { needsControllerSource } = readProjectSources({
  needsControllerSource: 'src/pet-runtime/core/petNeedsController.ts',
});
assert.match(needsControllerSource, /deliveredToVideoPet \|\| interactionType === 'eat'/u);
assert.match(needsControllerSource, /isManualHandoff && publishVideoItemInteraction/u);
console.log('2D 视频道具触发路由通过');
