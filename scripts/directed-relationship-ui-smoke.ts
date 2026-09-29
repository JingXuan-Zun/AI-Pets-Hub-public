import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const section = readProjectFile('src/components/settings/SettingsDirectedRelationshipSection.tsx');
const editor = readProjectFile('src/components/settings/SettingsDirectedRelationshipEditor.tsx');
const list = readProjectFile('src/components/settings/SettingsDirectedRelationshipList.tsx');
const timeline = readProjectFile('src/components/settings/SettingsDirectedRelationshipTimeline.tsx');
const behaviorTimeline = readProjectFile('src/components/settings/SettingsDirectedRelationshipBehaviorTimeline.tsx');
const personality = readProjectFile('src/components/settings/SettingsPersonalityTab.tsx');
const candidateGroups = readProjectFile(
  'src/components/settings/SettingsDirectedRelationshipCandidateGroups.tsx',
);

assert.match(section, /A→B 与 B→A 独立/u);
assert.match(section, /自动关系演化保持关闭/u);
assert.match(editor, /信任/u);
assert.match(editor, /亲密/u);
assert.match(editor, /警惕/u);
assert.match(section, /source: 'manual'/u);
assert.match(list, /invalidateDirectedRelationship|onInvalidate/u);
assert.match(list, /恢复/u);
assert.match(timeline, /关系审计时间线/u);
assert.match(timeline, /remove-role/u);
assert.match(behaviorTimeline, /命中对象/u);
assert.match(behaviorTimeline, /命中原因/u);
assert.match(behaviorTimeline, /本轮直接回应或拉入的角色/u);
assert.doesNotMatch(behaviorTimeline, /输出摘录/u);
assert.match(personality, /SettingsDirectedRelationshipSection/u);
assert.match(personality, /directedRelationshipRepository/u);
assert.match(candidateGroups, /批准该组/u);
assert.match(candidateGroups, /拒绝该组/u);

console.log('directed relationship ui smoke ok');
