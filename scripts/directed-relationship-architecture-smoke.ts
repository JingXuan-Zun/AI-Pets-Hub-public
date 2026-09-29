import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const files = [
  'src/character-relationship/directedRelationshipTypes.ts',
  'src/character-relationship/directedRelationshipBehaviorPolicy.ts',
  'src/character-relationship/directedRelationshipBehaviorPrompt.ts',
  'src/character-relationship/directedRelationshipBehaviorTrace.ts',
  'src/character-relationship/directedRelationshipRepository.ts',
  'src/character-relationship/directedRelationshipOperations.ts',
  'src/character-relationship/directedRelationshipContext.ts',
  'src/character-relationship/directedRelationshipCandidateScreening.ts',
  'src/character-relationship/directedRelationshipCandidateReview.ts',
  'src/character-relationship/directedRelationshipCandidateGroups.ts',
  'src/character-relationship/directedRelationshipCandidates.ts',
  'src/character-relationship/directedRelationshipShadowReport.ts',
  'src/components/chat/group/relationship/groupRelationshipSignalProtocol.ts',
  'src/components/chat/group/relationship/groupRelationshipCandidateCapture.ts',
  'src/components/chat/group/role/groupRoleSignalProtocol.ts',
  'src/components/chat/group/role/groupRoleTurnOutputProtocol.ts',
  'src/components/chat/group/memory/groupRoleRuntimeSnapshot.ts',
  'src/components/settings/SettingsDirectedRelationshipEditor.tsx',
  'src/components/settings/SettingsDirectedRelationshipBehaviorPreview.tsx',
  'src/components/settings/SettingsDirectedRelationshipBehaviorTimeline.tsx',
  'src/components/settings/SettingsDirectedRelationshipList.tsx',
  'src/components/settings/SettingsDirectedRelationshipTimeline.tsx',
  'src/components/settings/SettingsDirectedRelationshipSection.tsx',
  'src/components/settings/SettingsDirectedRelationshipCandidateInbox.tsx',
  'src/components/settings/SettingsDirectedRelationshipCandidateActions.tsx',
  'src/components/settings/SettingsDirectedRelationshipCandidateGroups.tsx',
  'src/components/settings/SettingsDirectedRelationshipShadowReport.tsx',
  'src/components/settings/useSettingsDirectedRelationshipCandidateReview.ts',
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
  inspectFunctions(ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true));
  assert.doesNotMatch(sourceText, /GroupChatRuntimeV[23]|AgentRuntime|localStorage|writeFile/u);
}

const types = fs.readFileSync(path.resolve('src/types.ts'), 'utf8');
const constants = fs.readFileSync(path.resolve('src/constants.ts'), 'utf8');
const normalization = fs.readFileSync(path.resolve('src/petConfigNormalization.ts'), 'utf8');
const attentionPolicy = fs.readFileSync(
  path.resolve('src/components/chat/group/attention/attentionPolicy.ts'), 'utf8',
);
const interactionPlanner = fs.readFileSync(
  path.resolve('src/components/chat/chatGroupInteractionPlanner.ts'), 'utf8',
);
assert.match(types, /directedRelationshipRepository: DirectedRelationshipRepositoryData/u);
assert.match(constants, /directedRelationshipRepository: EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY/u);
assert.match(normalization, /normalizeDirectedRelationshipRepository/u);
assert.doesNotMatch(normalization, /automatic.*directedRelationship/u);
assert.doesNotMatch(attentionPolicy, /DirectedRelationship|relationshipBehavior/u);
assert.doesNotMatch(interactionPlanner, /DirectedRelationship|relationshipBehavior/u);
const candidateReview = fs.readFileSync(
  path.resolve('src/character-relationship/directedRelationshipCandidateReview.ts'), 'utf8',
);
assert.match(candidateReview, /approveDirectedRelationshipCandidateAfterBatchPredecessor/u);
assert.match(candidateReview, /predecessors = new Map/u);
const candidateGroups = fs.readFileSync(
  path.resolve('src/character-relationship/directedRelationshipCandidateGroups.ts'), 'utf8',
);
assert.ok(candidateGroups.includes('`${candidate.sourceRoleId}->${candidate.targetRoleId}`'));
assert.match(candidateGroups, /screeningDecision === 'manual-review'/u);
assert.doesNotMatch(candidateGroups, /upsertDirectedRelationship|onUpdateConfig|AgentRuntime/u);
const candidateGroupUi = fs.readFileSync(
  path.resolve('src/components/settings/SettingsDirectedRelationshipCandidateGroups.tsx'), 'utf8',
);
assert.match(candidateGroupUi, /按定向关系分组审核/u);
assert.match(candidateGroupUi, /批准该组/u);
assert.match(candidateGroupUi, /拒绝该组/u);
assert.doesNotMatch(candidateGroupUi, /upsertDirectedRelationship|onUpdateConfig|AgentRuntime/u);

console.log('directed relationship architecture smoke ok');
