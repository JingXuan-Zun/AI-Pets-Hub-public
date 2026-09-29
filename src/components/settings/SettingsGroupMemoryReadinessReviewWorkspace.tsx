import type { CSSProperties } from 'react';
import type { GroupMemoryReadinessComparison } from '../../group-memory';
import { SettingsGroupMemoryReadinessReview } from './SettingsGroupMemoryReadinessReview';
import { SettingsGroupMemoryReadinessReviewImport } from './SettingsGroupMemoryReadinessReviewImport';
import { SettingsGroupMemoryReadinessReviewHistory } from './SettingsGroupMemoryReadinessReviewHistory';
import { SettingsGroupMemoryReadinessReviewTrend } from './SettingsGroupMemoryReadinessReviewTrend';
import { SettingsGroupMemoryReadinessReviewTrendApproval } from './SettingsGroupMemoryReadinessReviewTrendApproval';
import { SettingsGroupMemoryReadinessReviewTrendApprovalHistory } from './SettingsGroupMemoryReadinessReviewTrendApprovalHistory';
import { SettingsGroupMemoryReadinessManualReleaseReview } from './SettingsGroupMemoryReadinessManualReleaseReview';

export function SettingsGroupMemoryReadinessReviewWorkspace(props: {
  comparison: GroupMemoryReadinessComparison;
  independentBatchesConfirmedByTester: boolean;
  noDragRegionStyle?: CSSProperties;
}) {
  return <>
    <SettingsGroupMemoryReadinessReview {...props} />
    <SettingsGroupMemoryReadinessReviewImport comparison={props.comparison}
      noDragRegionStyle={props.noDragRegionStyle} />
    <SettingsGroupMemoryReadinessReviewHistory comparison={props.comparison}
      noDragRegionStyle={props.noDragRegionStyle} />
    <SettingsGroupMemoryReadinessReviewTrend noDragRegionStyle={props.noDragRegionStyle} />
    <SettingsGroupMemoryReadinessReviewTrendApproval noDragRegionStyle={props.noDragRegionStyle} />
    <SettingsGroupMemoryReadinessReviewTrendApprovalHistory
      noDragRegionStyle={props.noDragRegionStyle} />
    <SettingsGroupMemoryReadinessManualReleaseReview
      noDragRegionStyle={props.noDragRegionStyle} />
  </>;
}
