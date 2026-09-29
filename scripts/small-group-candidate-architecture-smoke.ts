import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const files = [
  'src/social-group/smallGroupCandidateTypes.ts',
  'src/social-group/smallGroupCandidateProjection.ts',
  'src/components/settings/SettingsSmallGroupCandidatePanel.tsx',
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
  const sourceText = fs.readFileSync(path.resolve(relativePath), 'utf8');
  assert.ok(sourceText.split(/\r?\n/u).length <= 300, `${relativePath} exceeds 300 lines`);
  inspectFunctions(ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true,
    relativePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS));
  assert.doesNotMatch(sourceText,
    /createGroupMemorySubgroup|updateGroupMemorySubgroupMembers|upsertDirectedRelationship|AgentRuntime|localStorage|writeFile/u);
}

const projection = fs.readFileSync(
  path.resolve('src/social-group/smallGroupCandidateProjection.ts'), 'utf8',
);
assert.match(projection, /CURRENT_GROUP_MEMORY_GROUP_ID/u);
assert.match(projection, /record\.invalidatedAt === undefined/u);
assert.match(projection, /reverse/u);
assert.doesNotMatch(projection, /record\.summary|evidenceSummary|chatHistoryMemory/u);
const panel = fs.readFileSync(
  path.resolve('src/components/settings/SettingsSmallGroupCandidatePanel.tsx'), 'utf8',
);
assert.match(panel, /不会自动建组或扩大记忆权限/u);
assert.doesNotMatch(panel, /onChange|onApplyConfig|onUpdateConfig/u);

console.log('small group candidate architecture smoke ok');
