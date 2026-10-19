import assert from 'node:assert/strict';
import { planDesktopIconMove, resolveIconMoveDisplay, resolveIconMovePosition } from '../src/agent/conversation/conversationDesktopIconTool';

// "把XX放到副屏" moves the desktop icon into the first free grid cell of that screen.
const displays = [
  { id: 'a', isPrimary: true, label: 'Redmi 27 NQ', nativeHeight: 1440, nativeWidth: 2560, nativeX: 0, nativeY: 0 },
  { id: 'b', isPrimary: false, label: 'LC34G55T', nativeHeight: 1440, nativeWidth: 3440, nativeX: 2560, nativeY: 0 },
];
const icon = (id: string, name: string, x: number, y: number) => ({ desktopGridCellHeight: 126, desktopGridCellWidth: 94, id, name, nativeScreenCenterX: x, nativeScreenCenterY: y, nativeScreenWidth: 96 });
const icons = [
  icon('1', '此电脑', 65, 39),
  icon('2', '今天中午吃牛肉', 65, 165),
  icon('3', '已经在副屏', 2560 + 47, 63),
  icon('4', '报告1', 65, 291),
  icon('5', '报告2', 65, 417),
];

assert.equal(resolveIconMoveDisplay(displays, '副屏')?.id, 'b');
assert.equal(resolveIconMoveDisplay(displays, '主屏')?.id, 'a');
assert.equal(resolveIconMoveDisplay(displays, '第2块')?.id, 'b');
assert.equal(resolveIconMoveDisplay(displays, '右边那块屏幕')?.id, 'b');
assert.equal(resolveIconMoveDisplay(displays, 'LC34')?.id, 'b');

const plan = planDesktopIconMove(displays, icons, '今天中午吃牛肉', '副屏');
assert.ok(!('error' in plan));
if (!('error' in plan)) {
  assert.equal(plan.display.id, 'b');
  assert.deepEqual([plan.x, plan.y], [2560 + 0, 126 + 2], 'first cell is taken, so the next free one below it');
  assert.match(plan.screenLabel, /副屏/u);
}
assert.match(String((planDesktopIconMove(displays, icons, '已经在副屏', '副屏') as { error: string }).error), /已经在/u);
assert.match(String((planDesktopIconMove(displays, icons, '报告', '副屏') as { error: string }).error), /好几个/u);
assert.match(String((planDesktopIconMove(displays, icons, '不存在', '副屏') as { error: string }).error), /没找到/u);
assert.match(String((planDesktopIconMove([displays[0]], icons, '此电脑', '副屏') as { error: string }).error), /只接了一块屏幕/u);
// "放到副屏右下角": the free cell nearest that corner, above a docked taskbar; once a spot is
// named, an icon may also move within the screen it is already on.
assert.equal(resolveIconMovePosition('右下角'), 'bottom-right');
assert.equal(resolveIconMovePosition('左上'), 'top-left');
assert.equal(resolveIconMovePosition('正中间'), 'center');
assert.equal(resolveIconMovePosition(''), null);
const withTaskbar = [displays[0], { ...displays[1], scaleFactor: 1.5, workAreaHeight: 928, workAreaY: 0, y: 0 }];
const corner = planDesktopIconMove(withTaskbar, icons, '今天中午吃牛肉', '副屏', 'bottom-right');
assert.ok(!('error' in corner));
if (!('error' in corner)) {
  // 3440 / 94 = 36 columns; usable 1392 px / 126 = 11 rows, so the last cell is (35, 10).
  assert.deepEqual([corner.x, corner.y], [2560 + 35 * 94, 10 * 126 + 2]);
}
const within = planDesktopIconMove(displays, icons, '已经在副屏', '副屏', 'bottom-right');
assert.ok(!('error' in within), 'an icon already on that screen can still go to its corner');
console.log('desktop icon move plan smoke ok');
