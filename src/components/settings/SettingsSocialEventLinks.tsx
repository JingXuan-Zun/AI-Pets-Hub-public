import type { SocialEventLinkRelation, SocialEventTimelineEntry } from '../../social-timeline';

const LINK_LABELS: Record<SocialEventLinkRelation, string> = {
  'corrected-by': '后来被纠正',
  corrects: '纠正了',
  'derived-from': '派生自',
  'derived-into': '后来派生出',
  'reverted-by': '后来被撤销',
  reverts: '撤销了',
  'superseded-by': '后来被替代',
  supersedes: '替代了',
};

export function SettingsSocialEventLinks(props: {
  eventTitles: Record<string, string>;
  links: SocialEventTimelineEntry['links'];
}) {
  if (!props.links.length) return null;
  return (
    <div className="mt-2 space-y-1 rounded-sm border border-amber-500/30 bg-amber-500/5 p-2">
      <div className="text-2xs font-medium text-amber-700">纠正与派生关联</div>
      {props.links.map((link, index) => {
        const targetTitle = link.targetEventId ? props.eventTitles[link.targetEventId] : null;
        return (
          <div key={`${link.relation}:${link.targetReferenceId}:${index}`}
            className="break-words text-2xs leading-4 text-muted-foreground">
            <span className="font-medium text-foreground">{LINK_LABELS[link.relation]}：</span>
            {targetTitle || link.targetReferenceId}
            {!targetTitle && <span>{link.targetEventId
              ? '（目标事件未在当前 300 条中）'
              : '（目标详情已不在活动记录中）'}</span>}
          </div>
        );
      })}
    </div>
  );
}
