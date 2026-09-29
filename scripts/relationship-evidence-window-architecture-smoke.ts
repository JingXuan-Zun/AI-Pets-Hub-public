import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const files = [
  'src/social-trend/relationshipEvidenceWindowTypes.ts',
  'src/social-trend/relationshipEvidenceWindowProjection.ts',
  'src/components/settings/SettingsRelationshipEvidenceWindowPanel.tsx',
  'src/components/settings/SettingsRelationshipEvidenceWindowCard.tsx',
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

const projection = fs.readFileSync('src/social-trend/relationshipEvidenceWindowProjection.ts', 'utf8');
assert.match(projection, /buildScopedRelationshipEvidenceWindows/u);
assert.match(projection, /isWritableGroupMemoryGroup/u);
assert.match(projection, /latestEvidenceScopeCorrection/u);
assert.doesNotMatch(projection,
  /(?:create|enqueue|approve|reject|upsert|invalidate|restore)DirectedRelationship\w*\s*\(|onChange|persist/iu);
const panel = fs.readFileSync('src/components/settings/SettingsRelationshipEvidenceWindowPanel.tsx', 'utf8');
assert.match(panel, /不创建候选、不写正式关系/u);
assert.match(panel, /不会限制或拦截用户聊天内容/u);
assert.match(panel, /全部记忆范围/u);
assert.match(panel, /无法确认时保留为未关联范围/u);
assert.doesNotMatch(panel, /onApplyConfig|onUpdateConfig|onChange\s*:/u);
const card = fs.readFileSync('src/components/settings/SettingsRelationshipEvidenceWindowCard.tsx', 'utf8');
assert.match(card, /仓储已达到详细记录保留上限/u);
assert.match(card, /记忆范围：/u);
assert.match(card, /未按记忆组归属/u);
assert.match(card, /纠正后历史范围：/u);
const personality = fs.readFileSync('src/components/settings/SettingsPersonalityTab.tsx', 'utf8');
assert.match(personality, /<SettingsRelationshipEvidenceWindowPanel/u);
assert.match(personality, /groupMemoryRepository=\{localConfig\.groupMemoryRepository\}/u);
console.log('relationship evidence window architecture smoke ok');
