import type { NeuralPersonaGeneratedNodeType } from './neuralPersonaNodeGenerationTypes';

export const NEURAL_PERSONA_SOURCE_BLOCK_MAX_CHARACTERS = 240;
const PREFERRED_MIN_CHARACTERS = 80;

export interface NeuralPersonaSourceBlock {
  content: string;
  sourceId: string;
}

function preferredBoundary(window: string, pattern: RegExp) {
  for (let index = window.length - 1; index >= PREFERRED_MIN_CHARACTERS; index -= 1) {
    if (pattern.test(window[index] ?? '')) return index + 1;
  }
  return -1;
}

function splitLongParagraph(value: string) {
  const blocks: string[] = [];
  let remaining = value.trim();
  while (remaining.length > NEURAL_PERSONA_SOURCE_BLOCK_MAX_CHARACTERS) {
    const window = remaining.slice(0, NEURAL_PERSONA_SOURCE_BLOCK_MAX_CHARACTERS);
    const sentence = preferredBoundary(window, /[。！？!?；;]/u);
    const soft = preferredBoundary(window, /[，,、：:\n\s]/u);
    const cut = sentence > 0 ? sentence
      : soft > 0 ? soft : NEURAL_PERSONA_SOURCE_BLOCK_MAX_CHARACTERS;
    blocks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining.trim()) blocks.push(remaining.trim());
  return blocks;
}

export function createNeuralPersonaSourceBlocks(sourceText: string) {
  const paragraphs = sourceText.split(/\r?\n\s*\r?\n+/u)
    .map((paragraph) => paragraph.trim()).filter(Boolean);
  return paragraphs.flatMap(splitLongParagraph).map((content, index) => ({
    content,
    sourceId: `source-block-${index + 1}`,
  } satisfies NeuralPersonaSourceBlock));
}

export function inferNeuralPersonaSourceBlockType(
  value: string,
): NeuralPersonaGeneratedNodeType {
  if (/喜欢|偏好|讨厌|厌恶/u.test(value)) return 'preference';
  if (/希望|目标|愿望|想要/u.test(value)) return 'desire-or-goal';
  if (/情绪|害羞|紧张|开心|难过|愤怒/u.test(value)) return 'emotional-tendency';
  if (/关系|用户|主人|朋友|家人/u.test(value)) return 'relationship-influence';
  if (/曾经|经历|过去|记得/u.test(value)) return 'experience';
  if (/禁止|风险|担心|害怕|避免/u.test(value)) return 'concern-or-risk';
  if (/认为|相信|原则|应该/u.test(value)) return 'belief-or-viewpoint';
  return 'style-tendency';
}
