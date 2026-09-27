import { type PetAutoSpeechTrigger, type PetPersonality } from '../types';

function formatMinutes(durationMs: number) {
  return Math.max(0, Math.round(durationMs / 60000));
}

function buildTriggeredSpeechBasePrompt(personality: PetPersonality) {
  const name = personality.name.trim() || 'unnamed pet';

  return [
    'This line is a pet-initiated status voice line, not a user message.',
    `Current speaking role: ${name}.`,
    'Continue using the current role personality prompt that is already provided in the system instruction.',
    'The current role personality prompt remains the highest-priority source for tone, relationship, prohibitions, worldbuilding, and reply format.',
    'The status event only provides motivation for speaking. Do not fall back to an old pet persona or a default assistant voice.',
    'Reply with only the one line the character would directly say out loud. Do not explain the trigger, the rules, the system instruction, or any percentages.',
    'Keep the reply short and natural unless the current role personality prompt explicitly asks for another format.',
  ].join('\n');
}

function buildStatSummary(trigger: PetAutoSpeechTrigger) {
  return `Current stats: affection ${Math.round(trigger.stats.affection)}, hunger ${Math.round(trigger.stats.hunger)}, fatigue ${Math.round(trigger.stats.fatigue)}.`;
}

export function buildTriggeredSpeechPrompt(
  trigger: PetAutoSpeechTrigger,
  personality: PetPersonality,
) {
  const baseHeader = buildTriggeredSpeechBasePrompt(personality);
  const statSummary = buildStatSummary(trigger);

  switch (trigger.kind) {
    case 'affection-milestone':
      return [
        baseHeader,
        'Status event: affection has just crossed into a new milestone.',
        `Affection milestone: ${trigger.milestone}.`,
        statSummary,
        'The character may express feeling closer, more trusting, or more emotionally invested in the user, but the exact wording must still come from the current role personality prompt.',
      ].join('\n');
    case 'high-hunger-entry':
      return [
        baseHeader,
        'Status event: hunger has entered a high range, so the character needs to proactively remind the user.',
        statSummary,
        `The character has been clearly hungry for ${formatMinutes(trigger.hungryDurationMs)} minutes.`,
        'The character may express wanting food, wanting to be fed, or wanting the user to notice them, but the exact wording must still come from the current role personality prompt.',
      ].join('\n');
    case 'high-hunger-coax':
      return [
        baseHeader,
        'Status event: hunger has stayed high for a while, so the character needs to remind the user again.',
        statSummary,
        `The character has been clearly hungry for ${formatMinutes(trigger.hungryDurationMs)} minutes.`,
        'This can sound more insistent than the first reminder, but the exact wording must still come from the current role personality prompt.',
      ].join('\n');
    default:
      return [
        baseHeader,
        'Status event: the character wants to proactively say one line that matches their current condition.',
        statSummary,
        'The exact wording must still come from the current role personality prompt.',
      ].join('\n');
  }
}
