import { FileCheck2, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { GroupMemoryReadinessReviewTrendImportIssue } from '../../group-memory';
import { Button } from '../../../components/ui/button';
import { SettingsGroupMemoryReadinessReviewTrendApprovalForm } from './SettingsGroupMemoryReadinessReviewTrendApprovalForm';
import { useSettingsGroupMemoryReadinessReviewTrendApproval } from './useSettingsGroupMemoryReadinessReviewTrendApproval';

const ISSUE_LABELS: Record<GroupMemoryReadinessReviewTrendImportIssue, string> = {
  'expired-report': '报告已超过30天', 'future-generated-at': '报告生成时间来自未来',
  'invalid-report': '报告结构、清单重算结果或安全边界无效',
};

export function SettingsGroupMemoryReadinessReviewTrendApproval(props: {
  noDragRegionStyle?: CSSProperties;
}) {
  const { clear, loadFile, preview } = useSettingsGroupMemoryReadinessReviewTrendApproval();
  return <div className="mt-2 space-y-2 rounded-sm border border-border/70 p-2 text-3xs">
    <div className="font-medium text-foreground">趋势评审报告严格导入与审批</div>
    <p className="text-muted-foreground">
      只做结构一致性校验，不是密码学真实性证明；仅内存，不保存、不执行。
    </p>
    <div className="flex items-center gap-2">
      <label style={props.noDragRegionStyle} className="inline-flex h-7 cursor-pointer items-center border px-2">
        <FileCheck2 className="mr-1 h-3 w-3" />选择趋势评审报告
        <input type="file" accept="application/json,.json" className="sr-only"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
            if (file) void loadFile(file);
          }} />
      </label>
      {preview.status !== 'idle' && <Button type="button" variant="ghost" size="sm"
        style={props.noDragRegionStyle} onClick={clear}><X className="mr-1 h-3 w-3" />清除</Button>}
    </div>
    {preview.status === 'reading' && <p>正在校验…</p>}
    {preview.status === 'valid' && <p className="text-emerald-600">报告结构与重算清单一致。</p>}
    {preview.status === 'read-failed' && <p className="text-destructive">文件读取失败。</p>}
    {preview.issues.map((issue) => <p key={issue} className="text-destructive">{ISSUE_LABELS[issue]}</p>)}
    {preview.report && <SettingsGroupMemoryReadinessReviewTrendApprovalForm
      issues={preview.issues} noDragRegionStyle={props.noDragRegionStyle} report={preview.report} />}
  </div>;
}
