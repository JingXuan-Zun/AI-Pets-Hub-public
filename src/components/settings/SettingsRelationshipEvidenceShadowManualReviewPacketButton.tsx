import { Download } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Button } from '../../../components/ui/button';
import type { RelationshipEvidenceShadowBatchReport } from '../../social-trend';
import { downloadRelationshipEvidenceShadowManualReviewPacket } from './relationshipEvidenceShadowManualReviewPacketDownload';

export function SettingsRelationshipEvidenceShadowManualReviewPacketButton(props: {
  batchReport: RelationshipEvidenceShadowBatchReport;
  noDragRegionStyle?: CSSProperties;
}) {
  return <Button type="button" variant="outline" size="sm" style={props.noDragRegionStyle}
    onClick={() => downloadRelationshipEvidenceShadowManualReviewPacket(props.batchReport)}
    className="h-7 rounded-full px-2 text-3xs">
    <Download className="mr-1 h-3 w-3" />导出匿名人工审查材料
  </Button>;
}
