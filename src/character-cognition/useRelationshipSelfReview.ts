import { useEffect, type MutableRefObject } from 'react';
import {
  approveDirectedRelationshipCandidate,
  approveDirectedRelationshipCandidateAfterBatchPredecessor,
  buildDirectedRelationshipId,
  rejectDirectedRelationshipCandidate,
  type DirectedRelationshipCandidate,
  type DirectedRelationshipRepositoryData,
} from '../character-relationship';
import { pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import { getDesktopPetSlots } from '../multiPetRoster';
import type { PetConfig, PetConfigUpdateHandler } from '../types';
import {
  buildRelationshipDecisionPrompt,
  parseRelationshipDecision,
  pendingRelationshipCandidates,
} from './relationshipSelfReview';
import { askModel, personaInput } from './useCharacterCognition';

// Works through relationship candidates one at a time: the character the change is about decides
// (relationshipSelfReview.ts). Runs a while after start-up and then every few minutes.

const START_DELAY_MS = 3 * 60_000;
const ROUND_EVERY_MS = 10 * 60_000;
const GAP_MS = 8_000;

/**
 * The round's own copy of the repository, so back-to-back decisions build on each other even before
 * the saved config comes back; candidates group chat adds meanwhile are taken in.
 */
export function withNewCandidates(working: DirectedRelationshipRepositoryData, latest: DirectedRelationshipRepositoryData | undefined) {
  if (!latest) return working;
  const known = new Set(working.candidates.map((candidate) => candidate.id));
  const added = latest.candidates.filter((candidate) => !known.has(candidate.id));
  return added.length ? { ...working, candidates: [...working.candidates, ...added] } : working;
}

function applyDecision(repository: DirectedRelationshipRepositoryData, candidate: DirectedRelationshipCandidate, accept: boolean) {
  if (!accept) return rejectDirectedRelationshipCandidate(repository, candidate.id).repository;
  const first = approveDirectedRelationshipCandidate(repository, candidate.id);
  if (first.reason !== 'relationship-version-conflict') return first.repository;
  // An earlier accepted candidate for the same pair moved the relationship; build on top of it.
  const relationshipId = buildDirectedRelationshipId(candidate.sourceRoleId, candidate.targetRoleId);
  const predecessor = [...repository.auditTrail].reverse().find((item) => item.relationshipId === relationshipId);
  return predecessor
    ? approveDirectedRelationshipCandidateAfterBatchPredecessor(repository, candidate.id, predecessor.id).repository
    : rejectDirectedRelationshipCandidate(repository, candidate.id).repository;
}

export function useRelationshipSelfReview(options: {
  configRef: MutableRefObject<PetConfig>;
  onUpdateConfig: PetConfigUpdateHandler;
}) {
  const { configRef, onUpdateConfig } = options;

  useEffect(() => {
    let disposed = false;
    let running = false;

    const save = (repository: DirectedRelationshipRepositoryData) => {
      onUpdateConfig({ ...configRef.current, directedRelationshipRepository: repository }, { normalize: false, persist: true, priority: 'low' });
    };

    const round = async () => {
      if (running || disposed) return;
      if (configRef.current.settings.lifeCompanion?.characterCognitionEnabled === false) return;
      running = true;
      let accepted = 0;
      let declined = 0;
      try {
        let working = configRef.current.directedRelationshipRepository;
        if (!working) return;
        const commit = (next: DirectedRelationshipRepositoryData) => {
          working = withNewCandidates(next, configRef.current.directedRelationshipRepository);
          save(working);
        };
        for (const candidate of pendingRelationshipCandidates(working.candidates)) {
          if (disposed) return;
          const config = configRef.current;
          const slots = getDesktopPetSlots(config);
          const slot = slots.find((item) => item.id === candidate.sourceRoleId);
          if (candidate.screeningDecision === 'blocked' || !slot) {
            // Blocked by the rules (or the character is gone): nothing for her to decide.
            commit(rejectDirectedRelationshipCandidate(working, candidate.id).repository);
            declined += 1;
            continue;
          }
          const input = personaInput(slot, slots);
          const output = await askModel(config, buildRelationshipDecisionPrompt({ candidate, name: input.name, persona: input.persona }));
          const decision = parseRelationshipDecision(output);
          if (!decision || disposed) continue;
          if (!working.candidates.some((item) => item.id === candidate.id && item.status === 'pending')) continue;
          commit(applyDecision(working, candidate, decision.accept));
          if (decision.accept) accepted += 1; else declined += 1;
          await new Promise((resolve) => { setTimeout(resolve, GAP_MS); });
        }
      } catch (error) {
        pushFrontendRuntimeLog('关系', '角色自己判断关系变化时出错', { error: error instanceof Error ? error.message : String(error) });
      } finally {
        running = false;
        if (accepted || declined) pushFrontendRuntimeLog('关系', '角色自己决定了关系变化', { accepted, declined });
      }
    };

    const first = window.setTimeout(() => { void round(); }, START_DELAY_MS);
    const interval = window.setInterval(() => { void round(); }, ROUND_EVERY_MS);
    return () => {
      disposed = true;
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [configRef, onUpdateConfig]);
}
