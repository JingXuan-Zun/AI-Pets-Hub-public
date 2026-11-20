// The 人格节点 (11-19): every knowledge-memory graph shows her persona node from the start, even
// an empty graph; it is added for display only (the stored graph is untouched), drawn by the
// graph view next to the memories, and never counted as a memory.
import assert from 'node:assert/strict';
import { memoryNotes } from '../src/components/settings/memory-notes/neuralMemoryNotes';
import { graphViewNodes, isPersonaNode, personaNodeId, withPersonaNode } from '../src/components/settings/memory-notes/personaNode';
import type { NeuralPersonaGraphSnapshot } from '../src/character-graph/neural-persona';

let checks = 0;
const check = (condition: boolean, label: string) => { assert.ok(condition, label); checks += 1; };
const empty = { edges: [], nodes: [], roleId: 'pet-4' } as unknown as NeuralPersonaGraphSnapshot;

const shown = withPersonaNode(empty, 'pet-4', '乙');
check(shown.nodes.length === 1 && isPersonaNode(shown.nodes[0]) && shown.nodes[0].nodeId === personaNodeId('pet-4'), 'an empty graph shows exactly her persona node');
check(empty.nodes.length === 0, 'the stored graph is not changed');
check(withPersonaNode(shown, 'pet-4', '乙') === shown, 'added only once');
check(graphViewNodes(shown).length === 1, 'the graph view draws it');
check(memoryNotes(shown).length === 0, 'it is not counted as a memory');

const memory = { ...shown.nodes[0], influenceSummary: '一起修过路由器', nodeId: 'memory-1', protected: false, type: 'experience' };
const withMemory = withPersonaNode({ ...empty, nodes: [memory] } as unknown as NeuralPersonaGraphSnapshot, 'pet-4', '乙');
check(graphViewNodes(withMemory).length === 2 && memoryNotes(withMemory).length === 1, 'persona node + memories together');

console.log(`persona node smoke ok: ${checks} checks`);
