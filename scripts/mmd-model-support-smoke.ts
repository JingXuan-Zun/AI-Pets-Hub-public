import assert from 'node:assert/strict';
import { resolve3DModelFormatFromFileName } from '../src/model3dFormatSupport';
import { readVmdDurationMs } from '../src/pet-runtime/avatar3d/avatar3dMmdRuntime';
import { isPetModelMotionBindingCompatibleWithModelType } from '../src/pet-runtime/content/petModelMotionBindingCompatibility';
import { resolveCustomMotionFormatFromFileName } from '../src/components/settings/settingsModelImportUtils';

let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases++; };

// A VMD with one bone key at frame 0 and one at frame 90 (3 s at 30 fps) and a morph key at 45.
function makeVmd(boneFrames: number[], morphFrames: number[]) {
  const bytes = new Uint8Array(50 + 4 + boneFrames.length * 111 + 4 + morphFrames.length * 23);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('Vocaloid Motion Data 0002'), 0);
  let offset = 50;
  view.setUint32(offset, boneFrames.length, true);
  offset += 4;
  boneFrames.forEach((frame) => { view.setUint32(offset + 15, frame, true); offset += 111; });
  view.setUint32(offset, morphFrames.length, true);
  offset += 4;
  morphFrames.forEach((frame) => { view.setUint32(offset + 15, frame, true); offset += 23; });
  return bytes.buffer;
}

check(readVmdDurationMs(makeVmd([0, 90], [45])), 3000, 'length comes from the last bone frame');
check(readVmdDurationMs(makeVmd([0], [120])), 4000, 'or the last morph frame');
check(readVmdDurationMs(new TextEncoder().encode('not a motion file at all, really not').buffer), null, 'other files are rejected');
check(readVmdDurationMs(makeVmd([], [])), null, 'an empty motion has no length');

check([resolve3DModelFormatFromFileName('角色.pmx'), resolve3DModelFormatFromFileName('old.PMD')], ['pmx', 'pmd'], 'PMX and PMD models import');
check(resolveCustomMotionFormatFromFileName('挥手.vmd'), 'vmd', 'VMD motions import');
const binding = { format: 'vmd', id: 'm', motionKey: 'happy', name: '挥手', sourceUrl: 'D:/m/挥手.vmd' } as const;
check([isPetModelMotionBindingCompatibleWithModelType('3d', binding), isPetModelMotionBindingCompatibleWithModelType('live2d', binding)], [true, false], 'VMD belongs to 3D models');

console.log(`mmd model support smoke ok: ${cases} checks`);
