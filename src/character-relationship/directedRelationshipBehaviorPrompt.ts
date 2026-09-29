import type { DirectedRelationshipBehaviorPolicy } from './directedRelationshipTypes';

const LABELS = {
  addressStyle: {
    'familiar-warm': '称呼和语气可以熟悉、温和，但不得覆盖角色本人的固定口吻',
    'formal-distance': '保持礼貌和距离，不主动制造亲密称呼',
    'neutral-polite': '使用自然、中性的礼貌表达',
  },
  disagreementStyle: {
    'evidence-first': '有分歧时先说明证据和理由，不因关系替任何一方改写事实',
    'firm-boundary': '有分歧时直接说明边界，并避免泄露私人信息',
    'warm-clarification': '先确认是否理解一致，再温和表达不同意见',
  },
  engagementStyle: {
    'acknowledge-and-build': '轮到你发言时，可自然回应并延续对方刚才的有效内容',
    'direct-and-limited': '轮到你发言时，只回应必要内容，不额外暴露私人细节',
    'normal-response': '轮到你发言时，按当前话题正常回应',
  },
  sharingStyle: {
    'minimal': '只分享完成当前对话所需的信息',
    'open-with-boundaries': '可以更开放交流，但用户隐私、秘密和权限边界仍不可突破',
    selective: '根据当前话题选择性分享，不主动扩大私人信息范围',
  },
  supportStyle: {
    'independent-evaluation': '是否支持对方仍按本轮事实独立判断',
    'support-with-evidence': '可表达支持，但必须保留事实核验和独立判断',
    'withhold-automatic-defense': '不要自动替对方辩护、背书或承担责任',
  },
  verificationStyle: {
    'cooperative-verify': '可以优先理解为善意信息，但重要事实仍需证据核验',
    'standard-verify': '按普通标准核验重要事实',
    'strict-verify': '提高核验要求，不把对方观点直接当成世界事实',
  },
} as const;

export function summarizeDirectedRelationshipBehaviorPolicy(policy: DirectedRelationshipBehaviorPolicy) {
  return [
    `对“${policy.targetRoleName}”的表达策略：`,
    `称呼距离：${LABELS.addressStyle[policy.addressStyle]}`,
    `接话方式：${LABELS.engagementStyle[policy.engagementStyle]}`,
    `事实核验：${LABELS.verificationStyle[policy.verificationStyle]}`,
    `信息分享：${LABELS.sharingStyle[policy.sharingStyle]}`,
    `分歧表达：${LABELS.disagreementStyle[policy.disagreementStyle]}`,
    `支持倾向：${LABELS.supportStyle[policy.supportStyle]}`,
  ].join('\n');
}

export function buildDirectedRelationshipBehaviorPromptLines(
  policies: DirectedRelationshipBehaviorPolicy[],
) {
  if (!policies.length) return [];
  return [
    `已批准正式关系对应的表达策略：\n${policies.map(summarizeDirectedRelationshipBehaviorPolicy).join('\n\n')}`,
    '这些策略只在你已经被调度为本轮发言者后影响表达，不得据此抢占发言、插话、强制沉默或修改发言队列。',
    '关系不得覆盖 Persona Anchor，不得把角色观点升级成世界事实，不得降低工具审批、权限、证据或用户隐私边界。',
  ];
}
