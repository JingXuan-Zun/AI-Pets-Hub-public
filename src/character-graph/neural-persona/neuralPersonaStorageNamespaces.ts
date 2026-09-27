export const NEURAL_PERSONA_FEEDBACK_STORAGE_PREFIX = 'feedback:';
export const NEURAL_PERSONA_LEARNING_PROPOSAL_STORAGE_PREFIX = 'learning-proposals:';

const RESERVED_PREFIXES = [
  NEURAL_PERSONA_FEEDBACK_STORAGE_PREFIX,
  NEURAL_PERSONA_LEARNING_PROPOSAL_STORAGE_PREFIX,
];

export function isReservedNeuralPersonaStorageRoleId(roleId: string) {
  return RESERVED_PREFIXES.some((prefix) => roleId.startsWith(prefix));
}
