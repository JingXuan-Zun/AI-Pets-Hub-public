import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const files = [
  'src/social-timeline/socialEventTimelineTypes.ts',
  'src/social-timeline/socialEventTimelineProjection.ts',
  'src/social-timeline/socialEventMemoryScopeProjection.ts',
  'src/social-timeline/socialEventTimelineLinks.ts',
  'src/social-timeline/index.ts',
  'src/components/settings/SettingsSocialEventTimeline.tsx',
  'src/components/settings/SettingsSocialEventEvidence.tsx',
  'src/components/settings/SettingsSocialEventLinks.tsx',
];

function line(source: ts.SourceFile, position: number) {
  return source.getLineAndCharacterOfPosition(position).line + 1;
}

function inspectFunctions(source: ts.SourceFile) {
  const visit = (node: ts.Node) => {
    if (ts.isFunctionLike(node) && node.body) {
      const size = line(source, node.body.end) - line(source, node.getStart(source)) + 1;
      assert.ok(size <= 50, `${source.fileName} function has ${size} lines`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

for (const relativePath of files) {
  const text = fs.readFileSync(path.resolve(relativePath), 'utf8');
  assert.ok(text.split(/\r?\n/u).length <= 300, `${relativePath} exceeds 300 lines`);
  const source = ts.createSourceFile(relativePath, text, ts.ScriptTarget.Latest, true,
    relativePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  inspectFunctions(source);
  assert.doesNotMatch(text,
    /createStore|localStorage|writeFile|fetch\(|GroupChatRuntime|AgentRuntime|gemini|openai/iu);
}

const projection = fs.readFileSync('src/social-timeline/socialEventTimelineProjection.ts', 'utf8');
assert.match(projection, /memoryGroupIds/u);
assert.doesNotMatch(projection,
  /upsert|approve|reject|enqueue|invalidate|restore|rollback|onChange|persist/iu);
const scopeProjection = fs.readFileSync(
  'src/social-timeline/socialEventMemoryScopeProjection.ts', 'utf8',
);
assert.match(scopeProjection, /evidenceScopeSnapshots/u);
assert.match(scopeProjection, /capturedGroupId/u);
assert.match(scopeProjection, /currentGroupId/u);
assert.match(scopeProjection, /projectMemoryEvidenceScopeCorrectionEvents/u);
assert.doesNotMatch(scopeProjection,
  /\b(?:upsert|approve|reject|enqueue|invalidate|restore|rollback|persist)\b|onChange/iu);
const settings = fs.readFileSync('src/components/settings/SettingsSocialEventTimeline.tsx', 'utf8');
assert.match(settings, /只读聚合现有审计记录/u);
assert.match(settings, /仅证明策略已提供/u);
assert.match(settings, /全部角色/u);
assert.match(settings, /全部 Topic/u);
assert.match(settings, /全部记忆组/u);
assert.match(settings, /记忆组：/u);
assert.match(settings, /原始证据范围（不可变）/u);
assert.match(settings, /当前组已停用或失效/u);
assert.match(settings, /有效历史组/u);
assert.doesNotMatch(settings, /onApplyConfig|onUpdateConfig|onChange\s*:/u);
const evidence = fs.readFileSync('src/components/settings/SettingsSocialEventEvidence.tsx', 'utf8');
assert.match(evidence, /已完成任务结果（来自 factualSummary）/u);
assert.match(evidence, /来源消息（不等于事实）/u);
const links = fs.readFileSync('src/components/settings/SettingsSocialEventLinks.tsx', 'utf8');
assert.match(links, /后来被纠正/u);
assert.match(links, /纠正了/u);
assert.match(links, /后来被撤销/u);
assert.match(links, /目标详情已不在活动记录中/u);
assert.match(links, /目标事件未在当前 300 条中/u);
const personality = fs.readFileSync('src/components/settings/SettingsPersonalityTab.tsx', 'utf8');
assert.match(personality, /<SettingsSocialEventTimeline/u);
assert.match(personality, /groupTopicRepository=\{localConfig\.groupTopicRepository\}/u);
assert.match(personality, /groupMemoryRepository=\{localConfig\.groupMemoryRepository\}/u);
assert.match(personality, /directedRelationshipRepository=\{localConfig\.directedRelationshipRepository\}/u);
console.log('social event timeline architecture smoke ok');
