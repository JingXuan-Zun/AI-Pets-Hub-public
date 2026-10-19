import assert from 'node:assert/strict';
import { buildAnnouncementInstruction } from '../src/components/chat/runController/approvalAnnouncement';

// Spoken permission questions should not all sound alike: the angle changes, recent questions
// are shown to be avoided, and the yes/no hint is only sometimes asked for.
const sequence = (values: number[]) => { let index = 0; return () => values[index++ % values.length]; };

const first = buildAnnouncementInstruction('让我操作你的电脑', false, [], sequence([0, 0.9]));
const second = buildAnnouncementInstruction('让我操作你的电脑', false, [], sequence([0.99, 0.9]));
assert.notEqual(first, second, 'a different angle is chosen');
assert.match(first, /这次就一句很短的话直接问/u);
assert.match(first, /不用特意教用户怎么回答/u);
assert.doesNotMatch(first, /最后提醒用户说“同意”或“拒绝”/u);

const withHint = buildAnnouncementInstruction('运行命令：x', false, [], sequence([0.5, 0.1]));
assert.match(withHint, /可以顺带说一句回“好”或“不要”就行/u);

const withRecent = buildAnnouncementInstruction('运行命令：x', true, ['（尾巴卷着手腕）夫君大人，回人家一句「同意」就好啦'], sequence([0.2, 0.9]));
assert.match(withRecent, /你最近已经这样问过/u);
assert.match(withRecent, /回人家一句「同意」就好啦/u);
assert.match(withRecent, /不要重复这些说法、动作描写和句式/u);
assert.match(withRecent, /再提醒一次/u);
console.log('approval announcement smoke ok');
