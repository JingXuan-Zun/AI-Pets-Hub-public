// A new problem goes on her mind so she asks about reporting it: one question at a time, room
// made by dropping her weakest concern, strong enough that her speak-first rules pick it, and
// gone once the user decided.
import assert from 'node:assert/strict';
import type { CharacterCognition } from '../src/character-cognition/characterCognitionTypes';
import { decideProactiveSpeech } from '../src/character-cognition/proactiveSpeechRules';
import { INCIDENT_CONCERN_PREFIX, withIncidentConcern, withoutIncidentConcerns } from '../src/incidents/incidentConcern';

let checks = 0;
const check = (condition: boolean, label: string) => { assert.ok(condition, label); checks += 1; };
const now = Date.UTC(2026, 10, 18, 12);
const concern = (id: string, charge: number) => ({ about: 'user', charge, chargedAt: now, createdAt: now, id, keywords: [], text: id });
const base: CharacterCognition = {
  baseline: { defaultMood: '平静', neverNegativeTowardUser: true, rules: [] },
  concerns: [concern('a', 40), concern('b', 10), concern('c', 30)],
  initializedAt: now,
  mood: { intensity: 0.3, label: '平静' },
  roleId: 'primary',
  toward: null,
  updatedAt: now,
};
const incident = { fingerprint: 'd5c59d00b72e6afa', source: 'window' as const, title: 'cannot read voice of undefined' };

const withIt = withIncidentConcern(base, incident, now);
const added = withIt.concerns.find((item) => item.id.startsWith(INCIDENT_CONCERN_PREFIX));
check(Boolean(added) && withIt.concerns.length === 3, 'the problem is on her mind, still at most three concerns');
check(!withIt.concerns.some((item) => item.id === 'b'), 'the weakest concern made room');
check(Boolean(added?.text.includes('界面出错') && added.text.includes('发给开发者')), 'she knows what happened and what to ask');
check(withIncidentConcern(withIt, { ...incident, fingerprint: 'ffffffffffffffff' }, now) === withIt, 'one question at a time');

const decision = decideProactiveSpeech({
  candidates: [{ cognition: withIt, name: '小玲', roleId: 'primary' }],
  chatBusy: false,
  enabled: true,
  idleMs: 1000,
  justCameBack: false,
  lastUserMessageAt: now - 30 * 60_000,
  log: [],
  now: now + 60_000,
  quietHours: false,
});
check(decision.speak && decision.concern.id === added?.id, 'her speak-first rules pick it soon');
const quiet = decideProactiveSpeech({ candidates: [{ cognition: withIt, name: '小玲', roleId: 'primary' }], chatBusy: false, enabled: true, idleMs: 1000, justCameBack: false, lastUserMessageAt: null, log: [], now, quietHours: true });
check(!quiet.speak, 'but not in quiet hours');

const cleared = withoutIncidentConcerns(withIt, now);
check(!cleared.concerns.some((item) => item.id.startsWith(INCIDENT_CONCERN_PREFIX)), 'gone once the user decided');
check(withoutIncidentConcerns(base, now) === base, 'nothing to clear → unchanged');

console.log(`incident concern smoke ok: ${checks} checks`);
