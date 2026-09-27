import assert from 'node:assert/strict';
import {
  selectMovableDesktopOrganizationFallbackIcons,
  type DesktopPetDesktopIconLike,
} from '../src/agent/index.ts';

const fallbackIcons: DesktopPetDesktopIconLike[] = [
  {
    height: 64,
    id: 'movable-shell-icon',
    index: 0,
    name: 'movable shell icon',
    positionSource: 'shell-list-view',
    width: 64,
    x: 2400,
    y: 120,
  },
  {
    canMove: true,
    height: 64,
    id: 'explicitly-movable-icon',
    index: 1,
    name: 'explicitly movable icon',
    positionSource: 'ui-automation',
    width: 64,
    x: 2500,
    y: 120,
  },
  {
    canMove: false,
    height: 64,
    id: 'read-only-icon',
    index: 2,
    name: 'read only icon',
    positionSource: 'ui-automation',
    width: 64,
    x: 2600,
    y: 120,
  },
];

const selection = selectMovableDesktopOrganizationFallbackIcons(fallbackIcons);

assert.deepEqual(
  selection.icons.map((icon) => icon.id),
  ['movable-shell-icon', 'explicitly-movable-icon'],
  'A fallback read that contains native movable icons must remain eligible for desktop organization.',
);
assert.equal(selection.positionSummary.totalIconCount, 3);
assert.equal(selection.positionSummary.movableIconCount, 2);
assert.equal(selection.positionSummary.readOnlyIconCount, 1);

console.log('desktop organization movable fallback smoke ok');
