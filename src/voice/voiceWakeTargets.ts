import { getRenderableDesktopPetSlots } from '../multiPetRoster';
import { type PetConfig } from '../types';
import { matchWakePhrase, parseWakePhrases } from './voiceWakeMatcher';

/** petId null = a general wake phrase that wakes whichever character is selected. */
export interface VoiceWakeTarget {
  phrase: string;
  petId: string | null;
}

// Every shown character answers to its own phrases (its name when none are set); the general
// phrases from the voice settings wake the selected character.
export function buildVoiceWakeTargets(config: PetConfig): VoiceWakeTarget[] {
  const targets: VoiceWakeTarget[] = getRenderableDesktopPetSlots(config).flatMap((slot) => (
    parseWakePhrases(slot.personality.wakeWords ?? '', slot.personality.name).map((phrase) => ({ phrase, petId: slot.id }))
  ));
  parseWakePhrases(config.settings.voiceWakeWords, '').forEach((phrase) => targets.push({ phrase, petId: null }));
  return targets;
}

// Longer phrases win ("高冷小桃" over "小桃"); on a shared phrase the selected character wins.
export function matchVoiceWakeTarget(transcript: string, targets: VoiceWakeTarget[], activePetId: string | null) {
  const rank = (target: VoiceWakeTarget) => (target.petId === null || target.petId === activePetId ? 0 : 1);
  const ordered = [...targets].sort((a, b) => b.phrase.length - a.phrase.length || rank(a) - rank(b));
  for (const target of ordered) {
    const match = matchWakePhrase(transcript, [target.phrase]);
    if (match) return { ...match, petId: target.petId };
  }
  return null;
}
