import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');
const responseTurn = read('src/components/chat/usePetChatResponseTurn.ts');
const firstRound = read('src/components/chat/chatPreparedTargetResponses.ts');
const continuation = read('src/components/chat/chatGroupContinuation.ts');
const visibleReply = read('src/components/chat/characterToolProtocol.ts');
const streamProjection = read('src/components/chat/chatResponseTurnUtils.ts');

assert.match(responseTurn, /groupRoleTurnOutput: currentChatMode === 'group'/u);
assert.match(responseTurn, /parseGroupRoleTurnOutput/u);
assert.match(responseTurn, /onPetMessage\?\.\(stripGroupRoleSignalMarkers\(finalResponse\)\)/u);
assert.match(firstRound, /applyGroupRoleTopicSignal\(context\.runtime, result\.result\.groupRoleTurnOutput, \{[\s\S]+roleId: plan\.targetSlot\.id,[\s\S]+turnId: result\.turnId/u);
assert.match(firstRound, /if \(!context\.runtime\.canContinue\(\)\) return false/u);
assert.match(firstRound, /if \(result\.result\.cancelled[\s\S]+return false;[\s\S]+completeGroupTurn/u);
assert.match(continuation, /completeNextGroupTurn\([\s\S]*options\.onTopicSnapshotChanged, options\.onRelationshipTurnComplete/u);
assert.match(continuation, /if \(!handledTopicSignal\)/u);
assert.match(continuation, /roleId: turn\.targetSlot\.id,[\s\S]+turnId: turn\.turnId/u);
assert.match(continuation, /if \(result\.cancelled\)[\s\S]+return 'completed';[\s\S]+completeNextGroupTurn/u);
assert.match(visibleReply, /stripGroupRoleSignalMarkers\(text\)/u);
assert.match(streamProjection, /stripGroupRoleSignalMarkers\(responseText\)/u);
assert.doesNotMatch(firstRound, /deriveTopic\(/u);
assert.doesNotMatch(continuation, /deriveTopic\(/u);
console.log('group topic signal wiring smoke ok');
