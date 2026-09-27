import { Download } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Button } from '../../../components/ui/button';
import type { RelationshipEvidenceShadowValidatedManualReviewDecision } from '../../social-trend';
import { downloadRelationshipEvidenceShadowManualReviewReceipt } from './relationshipEvidenceShadowManualReviewReceiptDownload';

export function SettingsRelationshipEvidenceShadowManualReviewReceiptButton(props: {
  decision: RelationshipEvidenceShadowValidatedManualReviewDecision;
  noDragRegionStyle?: CSSProperties;
}) {
  return <Button type="button" variant="outline" size="sm" style={props.noDragRegionStyle}
    onClick={() => downloadRelationshipEvidenceShadowManualReviewReceipt(props.decision)}
    className="mt-1 h-7 rounded-full px-2 text-3xs">
    <Download className="mr-1 h-3 w-3" />导出不可执行校验回执
  </Button>;
}
