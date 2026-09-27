import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const files = [
  'src/character-graph/characterGraphTypes.ts',
  'src/character-graph/characterGraphStore.ts',
  'src/character-graph/characterContextBuilder.ts',
  'src/components/chat/group/memory/groupMemoryGraphAdapter.ts',
];

function line(source: ts.SourceFile, position: number) {
  return source.getLineAndCharacterOfPosition(position).line + 1;
}

function inspect(source: ts.SourceFile) {
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
  inspect(ts.createSourceFile(relativePath, text, ts.ScriptTarget.Latest, true));
  assert.doesNotMatch(text, /AgentRuntime|GroupChatRuntimeV[23]|localStorage|writeFile|upsert:/u);
}

const builder = fs.readFileSync(path.resolve(files[2]), 'utf8');
assert.match(builder, /filter\(\(node\) => canReadNode\(node, request\)\)/u);
assert.ok(builder.indexOf('canReadNode') < builder.indexOf('scoreNode'));
assert.match(builder, /droppedNodeCount: readable\.length - items\.length/u);

console.log('character graph architecture smoke ok');
