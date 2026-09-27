import assert from 'node:assert/strict';
import { createDesktopIconArrangementPlan } from '../src/agent/index.ts';

const viewport = {
  height: 1380,
  width: 2560,
  x: 0,
  y: 0,
};

const icons: DesktopPetDesktopIconLike[] = Array.from({ length: 8 }, (_, index) => {
  const column = index % 4;
  const row = Math.floor(index / 4);
  const x = 20 + column * 96;
  const y = 16 + row * 88;

  return {
    centerX: x + 48,
    centerY: y + 37,
    desktopGridCellHeight: 88,
    desktopGridCellWidth: 96,
    height: 74,
    id: `icon-${index}`,
    index,
    name: `icon ${index}`,
    width: 96,
    x,
    y,
  };
});

const plan = createDesktopIconArrangementPlan({
  icons,
  maxColumns: 7,
  viewport,
});

assert.equal(plan.cellWidth, 96, 'desktop organization should use Windows ListView grid width');
assert.equal(plan.cellHeight, 88, 'desktop organization should use Windows ListView grid height');
assert.equal(plan.grid?.originX, 20, 'desktop organization should infer the real desktop grid x origin');
assert.equal(plan.grid?.originY, 16, 'desktop organization should infer the real desktop grid y origin');
assert.equal(plan.columns, 7, 'desktop organization should keep the requested max column count when the viewport fits');

for (const item of plan.items) {
  assert.equal(
    (item.to.x - 20) % 96,
    0,
    `${item.iconName} target x should be snapped to the Windows desktop grid`,
  );
  assert.equal(
    (item.to.y - 16) % 88,
    0,
    `${item.iconName} target y should be snapped to the Windows desktop grid`,
  );
}

assert.notEqual(
  plan.items[1]?.to.x,
  32 + 112,
  'desktop organization should not keep using the old hard-coded 112px column grid',
);

console.log('desktop icon grid arrangement smoke ok');
