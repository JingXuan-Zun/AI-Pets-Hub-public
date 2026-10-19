import { useEffect, useRef } from 'react';
import { getReachedStatMilestones, isPetHungry } from '../components/pet/petStatsMath';
import { type PetAutoSpeechTrigger, type PetConfig, type PetStats } from '../types';

// The other characters speak up about their own state too, like the main one: when one
// becomes hungry, or her affection reaches a new milestone, she says so in her own voice.
// (The main character keeps its existing monitors.)

export function useCompanionNeedSpeech({ config, enqueueTriggeredPetSpeech }: {
  config: PetConfig;
  enqueueTriggeredPetSpeech: (trigger: PetAutoSpeechTrigger) => void;
}) {
  const lastStatsRef = useRef(new Map<string, PetStats>());
  const hungryRef = useRef(new Map<string, number>());

  useEffect(() => {
    const seen = new Set<string>();
    for (const pet of config.companionPets ?? []) {
      if (!pet.enabled || !pet.stats) continue;
      seen.add(pet.id);
      const previous = lastStatsRef.current.get(pet.id);
      lastStatsRef.current.set(pet.id, pet.stats);
      // The first sighting only records where she stands; nothing is said about old news.
      if (!previous) {
        if (isPetHungry(pet.stats.hunger)) hungryRef.current.set(pet.id, Date.now());
        continue;
      }
      const milestone = getReachedStatMilestones(previous.affection, pet.stats.affection).at(-1);
      if (milestone) enqueueTriggeredPetSpeech({ kind: 'affection-milestone', milestone, petId: pet.id, stats: pet.stats });
      if (isPetHungry(pet.stats.hunger)) {
        if (!hungryRef.current.has(pet.id)) {
          hungryRef.current.set(pet.id, Date.now());
          enqueueTriggeredPetSpeech({ hungryDurationMs: 0, kind: 'high-hunger-entry', petId: pet.id, stats: pet.stats });
        }
      } else {
        hungryRef.current.delete(pet.id);
      }
    }
    for (const id of [...lastStatsRef.current.keys()]) {
      if (!seen.has(id)) {
        lastStatsRef.current.delete(id);
        hungryRef.current.delete(id);
      }
    }
  }, [config.companionPets, enqueueTriggeredPetSpeech]);
}
