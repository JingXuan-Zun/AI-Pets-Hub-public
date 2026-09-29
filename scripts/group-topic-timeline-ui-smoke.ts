import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const timeline = readFileSync('src/components/settings/SettingsGroupTopicTimeline.tsx', 'utf8');
const personalityTab = readFileSync('src/components/settings/SettingsPersonalityTab.tsx', 'utf8');

assert.match(timeline, /群聊 Topic 时间线/u);
assert.match(timeline, /只读/u);
assert.match(timeline, /buildGroupTopicTimeline/u);
assert.match(timeline, /statusFilter/u);
assert.match(timeline, /formatGroupTopicMembers/u);
assert.match(timeline, /父子关系循环/u);
assert.doesNotMatch(timeline, /onApplyConfig|onUpdateConfig|onDelete|onRemove|deriveTopic|updateTopic/u);
assert.match(personalityTab, /<SettingsGroupTopicTimeline/u);
assert.match(personalityTab, /repository=\{localConfig\.groupTopicRepository\}/u);
assert.match(personalityTab, /desktopPetSlots\.map/u);
console.log('group topic timeline ui smoke ok');
