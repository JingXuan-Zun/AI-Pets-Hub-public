import assert from 'node:assert/strict';
import {
  getGameCompanionObservationTrustIssue,
  MIN_GAME_COMPANION_OBSERVATION_CONFIDENCE,
} from '../src/components/pet/gameCompanionObservationTrust.ts';
import { readProjectFile } from './smokeTestHarness.ts';

assert.equal(MIN_GAME_COMPANION_OBSERVATION_CONFIDENCE, 0.72);
assert.equal(getGameCompanionObservationTrustIssue({
  confidence: 0.93,
  hasStructuredOutput: true,
  sceneState: '角色站在室外道路上',
  uncertainty: [],
}), null);
assert.match(
  getGameCompanionObservationTrustIssue({
    confidence: 0.99,
    hasStructuredOutput: false,
    summary: 'unstructured response',
  }) ?? '',
  /结构化/u,
);
assert.match(
  getGameCompanionObservationTrustIssue({
    confidence: 0.4,
    hasStructuredOutput: true,
    summary: '画面很模糊',
  }) ?? '',
  /40%/u,
);
assert.match(
  getGameCompanionObservationTrustIssue({
    confidence: 0.95,
    hasStructuredOutput: true,
    summary: '疑似战斗界面',
    uncertainty: ['HUD 文字太小，无法确认'],
  }) ?? '',
  /HUD/u,
);

const controllerSource = readProjectFile('src/components/pet/useGameCompanionLoopController.ts');
assert.match(controllerSource, /needsExplicitSourceSelection/u);
assert.match(controllerSource, /请先在游戏陪玩中选择一个游戏窗口或屏幕来源/u);
assert.ok(controllerSource.includes('getGameCompanionObservationTrustIssue(analysis)')); 
assert.match(controllerSource, /state\.observationRevision \+= 1/u);
assert.match(controllerSource, /state\.pendingCompanionReplyRevision === observationRevision[\s\S]*state\.observationRevision === observationRevision/u);
assert.match(controllerSource, /void generateCompanionReply[\s\S]*\.finally\(/u);
assert.match(controllerSource, /isCurrentLoopState/u);
assert.ok(controllerSource.includes('loopStateRef.current === state')); 

console.log('game companion observation trust smoke passed');
