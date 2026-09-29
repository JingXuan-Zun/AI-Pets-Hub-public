import { FileCheck2, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { GroupMemoryReadinessApprovalHistoryImportIssue } from '../../group-memory';
import { Button } from '../../../components/ui/button';
import { SettingsGroupMemoryReadinessManualReleaseReviewForm } from './SettingsGroupMemoryReadinessManualReleaseReviewForm';
import { useSettingsGroupMemoryReadinessManualReleaseReview } from './useSettingsGroupMemoryReadinessManualReleaseReview';

const ISSUE_LABELS: Record<GroupMemoryReadinessApprovalHistoryImportIssue, string> = {
  'expired-report': '审批历史报告已超过30天',
  'future-generated-at': '报告生成时间来自未来',
  'invalid-report': '报告结构、清单重算结果或安全边界无效',
};

export function SettingsGroupMemoryReadinessManualReleaseReview(props: {
  noDragRegionStyle?: CSSProperties;
}) {
  const { clear, loadFile, preview } = useSettingsGroupMemoryReadinessManualReleaseReview();
  return <div className="mt-2 space-y-2 rounded-sm border border-border/70 p-2 text-3xs">
    <div className="font-medium text-foreground">最终人工发布评审</div>
    <p className="text-muted-foreground">严格导入脱敏审批历史报告；只记录结论，不应用配置、不启用写入。</p>
    <div className="flex items-center gap-2">
      <label style={props.noDragRegionStyle} className="inline-flex h-7 cursor-pointer items-center border px-2">
        <FileCheck2 className="mr-1 h-3 w-3" />选择审批历史报告
        <input type="file" accept="application/json,.json" className="sr-only"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
            if (file) void loadFile(file);
          }} />
      </label>
      {preview.status !== 'idle' && <Button type="button" variant="ghost" size="sm"
        style={props.noDragRegionStyle} onClick={clear}><X className="mr-1 h-3 w-3" />清除</Button>}
    </div>
    {preview.status === 'reading' && <p>正在校验……</p>}
    {preview.status === 'valid' && <p className="text-emerald-600">报告结构和重算清单一致。</p>}
    {preview.status === 'read-failed' && <p className="text-destructive">文件读取失败。</p>}
    {preview.issues.map((issue) => <p key={issue} className="text-destructive">{ISSUE_LABELS[issue]}</p>)}
    {preview.report && <SettingsGroupMemoryReadinessManualReleaseReviewForm
      issues={preview.issues} noDragRegionStyle={props.noDragRegionStyle} report={preview.report} />}
  </div>;
}
