import assert from 'node:assert/strict';
import {
  classifyDesktopItem,
  createDesktopIconArrangementPlan,
} from '../src/agent/index.ts';

const viewport = {
  height: 900,
  width: 1440,
  x: 0,
  y: 0,
};

function createIcon(
  id: string,
  name: string,
  index: number,
  x: number,
  y: number,
  extra: Partial<DesktopPetDesktopIconLike> = {},
): DesktopPetDesktopIconLike {
  return {
    centerX: x + 48,
    centerY: y + 37,
    desktopGridCellHeight: 88,
    desktopGridCellWidth: 96,
    height: 74,
    id,
    index,
    name,
    width: 96,
    x,
    y,
    ...extra,
  };
}

const icons: DesktopPetDesktopIconLike[] = [
  createIcon('doc', 'report.pdf', 0, 20, 20),
  createIcon('image-b', 'banner.jpg', 1, 116, 20),
  createIcon('folder', 'Work', 2, 212, 20, { isDirectory: true }),
  createIcon('shortcut', 'Chrome.lnk', 3, 308, 20),
  createIcon('image-a', 'photo.png', 4, 404, 20),
  createIcon('unknown', 'Loose item', 5, 500, 20),
];

assert.equal(classifyDesktopItem(createIcon('system', '回收站', 6, 20, 120)).kind, 'system-icon');
assert.equal(classifyDesktopItem(createIcon('image', 'photo.png', 7, 20, 120)).category, 'image');
assert.equal(classifyDesktopItem(createIcon('folder-meta', 'Folder', 8, 20, 120, { isDirectory: true })).category, 'folder');

const defaultPlan = createDesktopIconArrangementPlan({
  icons,
  maxColumns: 6,
  viewport,
});

assert.deepEqual(
  defaultPlan.items.map((item) => item.iconId),
  ['doc', 'image-b', 'folder', 'shortcut', 'image-a', 'unknown'],
  'default desktop organization should keep position order when groupBy is omitted',
);
assert.equal(defaultPlan.grouping, undefined);

const categoryPlan = createDesktopIconArrangementPlan({
  groupBy: 'category',
  icons,
  maxColumns: 6,
  viewport,
});

assert.equal(categoryPlan.grouping?.groupBy, 'category');
assert.deepEqual(
  categoryPlan.items.map((item) => item.classification?.category),
  ['folder', 'image', 'image', 'document', 'shortcut', 'unknown'],
  'category grouping should cluster desktop items by reusable classification metadata',
);
assert.deepEqual(
  categoryPlan.items.map((item) => item.iconId),
  ['folder', 'image-b', 'image-a', 'doc', 'shortcut', 'unknown'],
  'items inside a category group should be stable and name-sorted',
);
assert.deepEqual(
  categoryPlan.grouping?.groups.map((group) => [group.category, group.count]),
  [
    ['folder', 1],
    ['image', 2],
    ['document', 1],
    ['shortcut', 1],
    ['unknown', 1],
  ],
);
assert.deepEqual(
  categoryPlan.grouping?.layouts?.map((layout) => [
    layout.groupKey,
    layout.count,
    layout.startRow,
    layout.endRow,
  ]),
  [
    ['folder', 1, 0, 0],
    ['image', 2, 1, 1],
    ['document', 1, 2, 2],
    ['shortcut', 1, 3, 3],
    ['unknown', 1, 4, 4],
  ],
  'category grouping should start each desktop item category on its own row',
);
assert.equal(categoryPlan.rows, 5);

const extensionPlan = createDesktopIconArrangementPlan({
  groupBy: 'extension',
  icons,
  maxColumns: 6,
  viewport,
});

assert.equal(extensionPlan.grouping?.groups.some((group) => group.key === '.png'), true);
assert.equal(extensionPlan.items.find((item) => item.iconId === 'unknown')?.groupKey, 'no-extension');

console.log('desktop icon classification grouping smoke ok');
