import type { NeuralPersonaTagVocabularyItem } from './neuralPersonaTagSuggester';

export const DEFAULT_NEURAL_PERSONA_TAG_VOCABULARY: readonly NeuralPersonaTagVocabularyItem[] = Object.freeze([
  { aliases: ['陪着', '陪伴感'], canonicalId: 'relationship:companionship', label: '陪伴' },
  { aliases: ['相信', '信赖'], canonicalId: 'relationship:trust', label: '信任' },
  { aliases: ['帮助过', '帮忙'], canonicalId: 'event:help', label: '帮助' },
  { aliases: ['安静', '冷静'], canonicalId: 'tone:calm', label: '平静' },
  { aliases: ['开心', '高兴'], canonicalId: 'emotion:happy', label: '快乐' },
  { aliases: ['担忧', '害怕'], canonicalId: 'emotion:concern', label: '担心' },
  { aliases: ['学习', '研究'], canonicalId: 'topic:learning', label: '学习' },
  { aliases: ['游戏', '游玩'], canonicalId: 'topic:game', label: '游戏' },
  { aliases: ['工作', '任务'], canonicalId: 'topic:work', label: '工作' },
  { aliases: ['食物', '吃饭'], canonicalId: 'topic:food', label: '饮食' },
]);
