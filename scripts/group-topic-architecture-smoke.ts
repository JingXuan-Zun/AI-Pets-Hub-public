import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const MAX_FILE_LINES = 300;
const MAX_FUNCTION_LINES = 50;
const files = [
  'src/components/chat/group/topic/topicLifecycle.ts',
  'src/components/chat/group/topic/topicStateOperations.ts',
  'src/components/chat/group/runtime/groupRuntimeController.ts',
  'src/components/chat/group/state/groupSessionRecord.ts',
];

function line(source: ts.SourceFile, position: number) {
  return source.getLineAndCharacterOfPosition(position).line + 1;
}

function inspectFunctions(source: ts.SourceFile) {
  const visit = (node: ts.Node) => {
    if (ts.isFunctionLike(node) && node.body) {
      const size = line(source, node.body.end) - line(source, node.getStart(source)) + 1;
      assert.ok(size <= MAX_FUNCTION_LINES, `${source.fileName} function has ${size} lines`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

for (const relativePath of files) {
  const sourceText = fs.readFileSync(path.resolve(relativePath), 'utf8');
  assert.ok(sourceText.split(/\r?\n/u).length <= MAX_FILE_LINES, `${relativePath} exceeds line budget`);
  const source = ts.createSourceFile(
    relativePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS,
  );
  inspectFunctions(source);
  assert.doesNotMatch(sourceText, /GroupChatRuntimeV[23]|createStore|AgentRuntime|neuron/iu);
}

const lifecycleSource = fs.readFileSync(files[0], 'utf8');
for (const status of [
  'disputed', 'waiting-information', 'concluded', 'decaying', 'archived',
]) {
  assert.match(lifecycleSource, new RegExp(`'${status}'`, 'u'));
}
assert.match(lifecycleSource, /isGroupTopicTransitionAllowed/u);

const operationsSource = fs.readFileSync(files[1], 'utf8');
assert.match(operationsSource, /createArchiveTopicPatch/u);
assert.match(operationsSource, /createDerivedTopicPatch/u);
assert.match(operationsSource, /createDecayTopicPatch/u);
assert.doesNotMatch(operationsSource, /localStorage|writeFile|fetch\(/iu);

const controllerSource = fs.readFileSync(files[2], 'utf8');
assert.match(controllerSource, /archiveTopic/u);
assert.match(controllerSource, /deriveTopic/u);
assert.match(controllerSource, /decayTopic/u);
assert.match(controllerSource, /waitingForInformation/u);
assert.match(controllerSource, /hasNewInformation/u);

console.log('group topic architecture smoke ok');
