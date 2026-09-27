import {
  deriveDirectedRelationshipBehaviorPolicy,
  type DirectedRelationshipRecord,
} from '../../character-relationship';

const LABELS = {
  addressStyle: { 'familiar-warm': '熟悉温和', 'formal-distance': '礼貌距离', 'neutral-polite': '中性礼貌' },
  engagementStyle: { 'acknowledge-and-build': '回应并延续', 'direct-and-limited': '直接且克制', 'normal-response': '正常回应' },
  disagreementStyle: { 'evidence-first': '证据优先', 'firm-boundary': '明确边界', 'warm-clarification': '温和澄清' },
  sharingStyle: { minimal: '最少分享', 'open-with-boundaries': '开放但守边界', selective: '选择性分享' },
  supportStyle: { 'independent-evaluation': '独立判断', 'support-with-evidence': '有证据地支持', 'withhold-automatic-defense': '不自动背书' },
  verificationStyle: { 'cooperative-verify': '合作核验', 'standard-verify': '标准核验', 'strict-verify': '严格核验' },
} as const;

export function SettingsDirectedRelationshipBehaviorPreview(props: {
  record: DirectedRelationshipRecord;
}) {
  const policy = deriveDirectedRelationshipBehaviorPolicy(props.record);
  const items = [
    ['称呼', LABELS.addressStyle[policy.addressStyle]],
    ['接话', LABELS.engagementStyle[policy.engagementStyle]],
    ['核验', LABELS.verificationStyle[policy.verificationStyle]],
    ['分享', LABELS.sharingStyle[policy.sharingStyle]],
    ['分歧', LABELS.disagreementStyle[policy.disagreementStyle]],
    ['支持', LABELS.supportStyle[policy.supportStyle]],
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(([label, value]) => (
        <span key={label} className="rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-3xs text-muted-foreground">
          {label}：{value}
        </span>
      ))}
    </div>
  );
}
