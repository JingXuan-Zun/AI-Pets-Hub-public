import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const MAX_FILE_LINES = 300;
const MAX_FUNCTION_LINES = 50;
const files = [
  'src/components/chat/group/attention/groupUserAttention.ts',
  'src/components/chat/group/attention/GroupUserAttentionPrompt.tsx',
  'src/components/chat/group/attention/attentionPolicy.ts',
  'src/components/chat/group/orchestration/conversationTurnPlan.ts',
  'src/components/chat/chatGroupInteractionPlanner.ts',
  'src/components/chat/chatGroupContinuation.ts',
  'src/components/chat/chatMessageSendRequestExecution.ts',
  'src/components/chat/chatPreparedGroupContinuation.ts',
  'src/components/chat/chatPreparedTargetResponses.ts',
  'src/components/chat/chatSingleRoundSpeakerPlanning.ts',
];

function lineNumber(source: ts.SourceFile, position: number) {
  return source.getLineAndCharacterOfPosition(position).line + 1;
}

function assertFunctionSizes(source: ts.SourceFile) {
  const visit = (node: ts.Node) => {
    if (ts.isFunctionLike(node) && node.body) {
      const start = lineNumber(source, node.getStart(source));
      const end = lineNumber(source, node.body.end);
      assert.ok(
        end - start + 1 <= MAX_FUNCTION_LINES,
        `${source.fileName}:${start} function exceeds ${MAX_FUNCTION_LINES} lines`,
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

for (const relativePath of files) {
  const absolutePath = path.resolve(relativePath);
  const sourceText = fs.readFileSync(absolutePath, 'utf8');
  assert.ok(
    sourceText.split(/\r?\n/u).length <= MAX_FILE_LINES,
    `${relativePath} exceeds ${MAX_FILE_LINES} lines`,
  );
  const source = ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  assertFunctionSizes(source);
}

const attentionPolicySource = fs.readFileSync(
  path.resolve('src/components/chat/group/attention/attentionPolicy.ts'), 'utf8',
);
assert.match(attentionPolicySource, /selectGroupAttentionParticipants/u);
assert.match(attentionPolicySource, /silentRoleIds/u);
assert.match(attentionPolicySource, /usedFallback/u);
assert.doesNotMatch(attentionPolicySource, /createStore|GroupChatRuntime|AgentRuntime|gemini|openai/iu);

const executionSource = fs.readFileSync(
  path.resolve('src/components/chat/chatPreparedTargetResponses.ts'), 'utf8',
);
assert.match(executionSource, /selectSingleRoundGroupChatParticipants/u);
assert.match(executionSource, /const maxTurns = request\.isGroupMode[\s\S]*context\.speakerSlots\.length/u);
assert.doesNotMatch(executionSource, /GroupChatRuntimeV[23]|createStore/u);

const turnPlanSource = fs.readFileSync(
  path.resolve('src/components/chat/group/orchestration/conversationTurnPlan.ts'), 'utf8',
);
assert.match(turnPlanSource, /speakerId: string/u);
assert.match(turnPlanSource, /addressedCharacterIds: string\[\]/u);
assert.match(turnPlanSource, /turnBudget: number/u);
assert.match(turnPlanSource, /interruptionPolicy: ConversationInterruptionPolicy/u);
assert.match(turnPlanSource, /usedAttentionFallback/u);
assert.doesNotMatch(
  turnPlanSource,
  /createStore|GroupChatRuntime|AgentRuntime|gemini|openai|executeTool/iu,
);
const groupPromptSource = fs.readFileSync(
  path.resolve('src/components/chat/chatGroupPromptUtils.ts'), 'utf8',
);
assert.match(groupPromptSource, /buildConversationTurnPromptLines/u);
assert.doesNotMatch(groupPromptSource, /ConversationTurnPlan.*用户/u);

console.log('group user attention architecture smoke ok');
