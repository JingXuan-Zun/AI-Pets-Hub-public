import { Download } from 'lucide-react';
import type { CSSProperties } from 'react';
import {
  buildGroupMemoryAutoWriteReadinessReport,
  type GroupMemoryAutoWriteGateId,
  type GroupMemoryAutoWriteGateStatus,
  type GroupMemoryCandidateShadowReport,
  type GroupMemoryRepositoryData,
} from '../../group-memory';
import { Button } from '../../../components/ui/button';
import { downloadGroupMemoryAutoWriteReadinessReport } from './groupMemoryAutoWriteReadinessDownload';
import { SettingsGroupMemoryRollbackDrillChecklist } from './SettingsGroupMemoryRollbackDrillChecklist';
import { SettingsGroupMemoryReadinessComparison } from './SettingsGroupMemoryReadinessComparison';

const GATE_LABELS: Record<GroupMemoryAutoWriteGateId, string> = {
  'approved-candidate-screening': '已批准候选不存在规则阻断项',
  'candidate-review-rollback-drill': '候选审核回滚演练',
  'duplicate-conflicts': '正式记忆无未处理重复冲突',
  'duplicate-scan-coverage': '活动记录处于完整重复扫描范围',
  'false-eligible': '离线语料无危险误放行',
  'record-integrity': '正式记忆替代链完整',
  'record-operation-rollback-drill': '正式记忆操作回滚演练',
  'retained-candidate-audit': '候选逐条筛选证据仍可核验',
  'scope-correction-drill': '证据范围纠正演练',
  'shadow-corpus': '离线 Shadow 语料达到门槛',
};

const STATUS_LABELS: Record<GroupMemoryAutoWriteGateStatus, string> = {
  block: '阻断',
  'needs-evidence': '待演练',
  pass: '通过',
};

export function SettingsGroupMemoryAutoWriteReadiness(props: {
  noDragRegionStyle?: CSSProperties;
  repository: GroupMemoryRepositoryData;
  shadowReport: GroupMemoryCandidateShadowReport | null;
}) {
  const report = buildGroupMemoryAutoWriteReadinessReport(props.repository, props.shadowReport);
  return <div className="mt-3 space-y-2 rounded-sm border border-amber-500/30 bg-amber-500/5 p-2">
    <div className="flex flex-wrap items-center justify-between gap-2 text-3xs">
      <span className="font-medium text-foreground">自动长期记忆启用前门禁</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-amber-700">{report.decision}</span>
        <Button type="button" variant="outline" size="sm" style={props.noDragRegionStyle}
          onClick={() => downloadGroupMemoryAutoWriteReadinessReport(report)}
          className="h-7 px-2 text-3xs">
          <Download className="mr-1 h-3 w-3" />导出脱敏报告
        </Button>
      </div>
    </div>
    <SettingsGroupMemoryRollbackDrillChecklist report={report} />
    <SettingsGroupMemoryReadinessComparison noDragRegionStyle={props.noDragRegionStyle} />
    <div className="space-y-1">
      {report.gates.map((item) => <div key={item.id}
        className="flex items-center justify-between gap-2 text-3xs text-muted-foreground">
        <span>{GATE_LABELS[item.id]}</span>
        <span className={item.status === 'block' ? 'text-destructive' : ''}>
          {STATUS_LABELS[item.status]} · {item.count}
        </span>
      </div>)}
    </div>
    <p className="text-3xs leading-4 text-muted-foreground">
      本报告只评估记忆候选与审计能力，不检查、不限制用户聊天内容。即使显示 shadow-ready，
      自动正式写入仍保持关闭，必须经过单独版本决策才能启用。
    </p>
  </div>;
}
