import { Download } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Button } from '../../../components/ui/button';
import type { RelationshipEvidenceShadowBatchReport } from '../../social-trend';
import {
  RELATIONSHIP_EVIDENCE_CALIBRATION_LABELS,
  RELATIONSHIP_EVIDENCE_PROFILE_LABELS,
} from './relationshipEvidenceShadowUiLabels';
import { SettingsRelationshipEvidenceShadowDriftReport } from './SettingsRelationshipEvidenceShadowDriftReport';
import { downloadRelationshipEvidenceShadowDerivedReport } from './relationshipEvidenceShadowDerivedReportDownload';
import { SettingsRelationshipEvidenceShadowConfidenceReport } from './SettingsRelationshipEvidenceShadowConfidenceReport';
import { SettingsRelationshipEvidenceShadowReasonReport } from './SettingsRelationshipEvidenceShadowReasonReport';
import { SettingsRelationshipEvidenceShadowReasonConfidenceReport } from './SettingsRelationshipEvidenceShadowReasonConfidenceReport';
import { SettingsRelationshipEvidenceShadowReasonDriftReport } from './SettingsRelationshipEvidenceShadowReasonDriftReport';
import { SettingsRelationshipEvidenceShadowReasonStabilityReport } from './SettingsRelationshipEvidenceShadowReasonStabilityReport';
import { SettingsRelationshipEvidenceShadowManualReviewReadiness } from './SettingsRelationshipEvidenceShadowManualReviewReadiness';
import { SettingsRelationshipEvidenceShadowManualReviewPacketButton } from './SettingsRelationshipEvidenceShadowManualReviewPacketButton';
import { SettingsRelationshipEvidenceShadowManualReviewDecision } from './SettingsRelationshipEvidenceShadowManualReviewDecision';

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function DerivedReportButton(props: {
  batchReport: RelationshipEvidenceShadowBatchReport;
  noDragRegionStyle?: CSSProperties;
}) {
  return <Button type="button" variant="outline" size="sm" style={props.noDragRegionStyle}
    onClick={() => downloadRelationshipEvidenceShadowDerivedReport(props.batchReport)}
    className="h-7 rounded-full px-2 text-3xs">
    <Download className="mr-1 h-3 w-3" />导出派生指标报告
  </Button>;
}

function ProfileComparisonTable(props: {
  batchReport: RelationshipEvidenceShadowBatchReport;
}) {
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[34rem] border-collapse text-left">
      <thead><tr className="text-muted-foreground">
        <th className="p-1">门槛版本</th><th className="p-1">结论</th>
        <th className="p-1">样本/每类</th><th className="p-1">召回</th>
        <th className="p-1">漏检上限</th>
      </tr></thead>
      <tbody>{props.batchReport.profileComparisons.map((comparison) => <tr
        key={comparison.profileId} className="border-t border-border">
        <td className="p-1">{RELATIONSHIP_EVIDENCE_PROFILE_LABELS[comparison.profileId]
          ?? comparison.profileId}</td>
        <td className="p-1">{RELATIONSHIP_EVIDENCE_CALIBRATION_LABELS[comparison.status]}</td>
        <td className="p-1 font-mono">{comparison.thresholds.minimumSamples}
          / {comparison.thresholds.minimumSamplesPerClass}</td>
        <td className="p-1 font-mono">≥{percent(comparison.thresholds.minimumSustainedRecall)}</td>
        <td className="p-1 font-mono">≤{percent(comparison.thresholds.maximumVolatileMissRate)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function ReviewControls(props: {
  batchReport: RelationshipEvidenceShadowBatchReport;
  noDragRegionStyle?: CSSProperties;
}) {
  return <>
    <SettingsRelationshipEvidenceShadowManualReviewReadiness
      report={props.batchReport.manualReviewReadiness}
    />
    <DerivedReportButton batchReport={props.batchReport}
      noDragRegionStyle={props.noDragRegionStyle} />
    <SettingsRelationshipEvidenceShadowManualReviewPacketButton
      batchReport={props.batchReport} noDragRegionStyle={props.noDragRegionStyle}
    />
    <SettingsRelationshipEvidenceShadowManualReviewDecision
      batchReport={props.batchReport} noDragRegionStyle={props.noDragRegionStyle}
    />
  </>;
}

export function SettingsRelationshipEvidenceShadowBatchReport(props: {
  batchReport: RelationshipEvidenceShadowBatchReport;
  noDragRegionStyle?: CSSProperties;
}) {
  const { batchReport } = props;
  return <div className="mt-2 space-y-2 border-t border-border pt-2 text-3xs">
    <div className="text-muted-foreground">
      聚合 {batchReport.corpusCount} 批，共 {batchReport.sampleCount} 条脱敏样本
    </div>
    <ProfileComparisonTable batchReport={batchReport} />
    {batchReport.corpusCount > 1 ? <details>
      <summary className="cursor-pointer text-muted-foreground">查看各批次结果</summary>
      <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto">
        {batchReport.corpusReports.map((item) => <li key={item.corpusId}
          className="flex justify-between gap-2 font-mono">
          <span className="truncate">{item.corpusId}</span>
          <span>{item.report.sampleCount} · {RELATIONSHIP_EVIDENCE_CALIBRATION_LABELS[
            item.report.calibrationStatus
          ]}</span>
        </li>)}
      </ul>
    </details> : null}
    <SettingsRelationshipEvidenceShadowConfidenceReport
      confidenceReport={batchReport.confidenceReport}
    />
    <SettingsRelationshipEvidenceShadowReasonReport
      report={batchReport.aggregateReport.reasonReport}
    />
    <SettingsRelationshipEvidenceShadowReasonConfidenceReport
      report={batchReport.reasonConfidenceReport}
    />
    <SettingsRelationshipEvidenceShadowDriftReport comparisons={batchReport.driftComparisons} />
    <SettingsRelationshipEvidenceShadowReasonDriftReport
      comparisons={batchReport.reasonDriftComparisons}
    />
    <SettingsRelationshipEvidenceShadowReasonStabilityReport
      report={batchReport.reasonStabilityReport}
    />
    <ReviewControls batchReport={batchReport} noDragRegionStyle={props.noDragRegionStyle} />
    <p className="text-muted-foreground">
      版本与漂移对比只用于离线观察；导出不含原始样本和批次ID，也不会自动选择生产阈值或开启正式关系写入。
    </p>
  </div>;
}
