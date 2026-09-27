import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const files = [
  'src/social-trend/socialTrendTypes.ts',
  'src/social-trend/socialTrendProjection.ts',
  'src/social-trend/index.ts',
  'src/components/settings/SettingsSocialTrendPanel.tsx',
  'src/components/settings/SettingsSocialTrendCard.tsx',
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

const projection = fs.readFileSync('src/social-trend/socialTrendProjection.ts', 'utf8');
assert.match(projection, /sharedMemoryGroups/u);
assert.match(projection, /isWritableGroupMemoryGroup/u);
assert.doesNotMatch(projection,
  /(?:upsertDirectedRelationship|approveDirectedRelationshipCandidate|enqueueDirectedRelationshipCandidate|invalidateDirectedRelationship|restoreDirectedRelationship)\s*\(|onChange|persist/iu);
const panel = fs.readFileSync('src/components/settings/SettingsSocialTrendPanel.tsx', 'utf8');
assert.match(panel, /不判断因果、不生成修改建议/u);
assert.match(panel, /全部记忆组/u);
assert.match(panel, /不表示关系归属于该记忆组/u);
assert.match(panel, /sharedMemoryGroups\.some/u);
assert.doesNotMatch(panel, /onApplyConfig|onUpdateConfig|onChange\s*:/u);
const card = fs.readFileSync('src/components/settings/SettingsSocialTrendCard.tsx', 'utf8');
assert.match(card, /仅表示共现，不表示关系变化原因/u);
assert.match(card, /记忆组/u);
assert.match(card, /最早保留快照/u);
const personality = fs.readFileSync('src/components/settings/SettingsPersonalityTab.tsx', 'utf8');
assert.match(personality, /<SettingsSocialTrendPanel/u);
assert.match(personality, /relationshipRepository=\{localConfig\.directedRelationshipRepository\}/u);
console.log('social trend architecture smoke ok');
