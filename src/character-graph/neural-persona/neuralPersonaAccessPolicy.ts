import type {
  NeuralPersonaContextInput,
  NeuralPersonaNode,
} from './neuralPersonaTypes';

export function canReadNeuralPersonaNode(
  node: NeuralPersonaNode,
  input: NeuralPersonaContextInput,
) {
  if (node.status !== 'active' || node.ownerRoleId !== input.roleId) return false;
  if (node.expiresAt !== undefined && node.expiresAt <= input.now) return false;
  if (node.scope === 'private') return input.includePrivate;
  if (node.scope === 'group') return Boolean(node.groupId && input.groupIds.includes(node.groupId));
  if (node.scope === 'subgroup') {
    return Boolean(node.subgroupId && input.subgroupIds.includes(node.subgroupId));
  }
  return node.scope === 'runtime' || node.scope === 'world';
}
