import { FileCheck2, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import type {
  GroupMemoryReadinessComparison,
  GroupMemoryReadinessReviewReceiptIssue,
} from '../../group-memory';
import { Button } from '../../../components/ui/button';
import { useSettingsGroupMemoryReadinessReviewImport } from './useSettingsGroupMemoryReadinessReviewImport';

const ISSUE_LABELS: Record<GroupMemoryReadinessReviewReceiptIssue, string> = {
  'comparison-mismatch': '凭证对应的证据快照与当前对比结果不一致',
  'expired-receipt': '凭证已超过30天有效期',
  'future-reviewed-at': '凭证评审时间来自未来',
  'invalid-receipt': '文件结构、字段或安全边界不符合严格Schema',
};

export function SettingsGroupMemoryReadinessReviewImport(props: {
  comparison: GroupMemoryReadinessComparison;
  noDragRegionStyle?: CSSProperties;
}) {
  const { clear, loadFile, preview } = useSettingsGroupMemoryReadinessReviewImport(props.comparison);
  return <div className="mt-2 space-y-2 rounded-sm border border-border/70 p-2 text-3xs">
    <div className="font-medium text-foreground">校验已有评审凭证</div>
    <p className="text-muted-foreground">
      只在当前页面内存中严格校验，不保存、不上传，不会执行凭证或修改任何配置。
    </p>
    <div className="flex flex-wrap items-center gap-2">
      <label style={props.noDragRegionStyle}
        className="inline-flex h-7 cursor-pointer items-center rounded-full border border-border px-2">
        <FileCheck2 className="mr-1 h-3 w-3" />选择评审凭证
        <input type="file" accept="application/json,.json" className="sr-only"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
            if (file) void loadFile(file);
          }} />
      </label>
      {preview.status !== 'idle' && <Button type="button" variant="ghost" size="sm"
        style={props.noDragRegionStyle} onClick={clear} className="h-7 px-2 text-3xs">
        <X className="mr-1 h-3 w-3" />清除
      </Button>}
    </div>
    {preview.status === 'reading' && <p>正在校验…</p>}
    {preview.status === 'valid' && <p className="text-emerald-600">
      凭证有效且证据快照一致：{preview.receipt?.decision}
    </p>}
    {preview.status === 'read-failed' && <p className="text-destructive">文件读取失败。</p>}
    {preview.issues.length > 0 && <ul className="text-destructive">
      {preview.issues.map((issue) => <li key={issue}>{ISSUE_LABELS[issue]}</li>)}
    </ul>}
  </div>;
}
