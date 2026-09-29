import assert from 'node:assert/strict';
import { createEmptyStoryDefinition, createStoryEntry, createStorySession } from '../src/components/chat/story/storyDefaults';
import { buildStoryTurnPrompt } from '../src/components/chat/story/storyTurnPrompt';

const definition = createEmptyStoryDefinition(['primary', 'companion-1'], 'imported');
definition.title = '钟楼下的密约';
definition.premise = '在钟声响起前找出告密者。';
definition.userRole = '临时加入调查的记录员';
definition.goals = [createStoryEntry('保护真正的证人')];
definition.tasks = [createStoryEntry('取得密封名单')];
definition.rules = [createStoryEntry('任何角色都不能无证据指认告密者')];
definition.customScript = '第三幕前，钟楼管理员不能离开控制室。';
definition.openingScene = '众人在封锁的钟楼大厅碰面。';
const session = createStorySession(definition);
session.currentTurn = 2;

const prompt = buildStoryTurnPrompt({
  basePrompt: '我先检查门锁，再询问管理员。',
  participantNames: ['阿澈', '小满'],
  session,
  targetName: '阿澈',
});

assert.match(prompt, /保护真正的证人/);
assert.match(prompt, /取得密封名单/);
assert.match(prompt, /不能无证据指认/);
assert.match(prompt, /管理员不能离开控制室/);
assert.match(prompt, /只扮演“阿澈”/);
assert.match(prompt, /不得代替用户或其他角色/);
assert.match(prompt, /独立旁白/);
assert.match(prompt, /不要写动作/);
assert.match(prompt, /第三人称/);
assert.match(prompt, /第 3 轮/);
assert.match(prompt, /我先检查门锁/);

console.log('story turn prompt smoke: PASS');
