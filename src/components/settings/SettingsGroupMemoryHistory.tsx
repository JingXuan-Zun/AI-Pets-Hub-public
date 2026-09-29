import type {
  GroupMemoryOperationKind,
  GroupMemoryOperationReceipt,
  GroupMemoryReceiptArchive,
} from '../../group-memory';

const OPERATION_LABELS: Record<GroupMemoryOperationKind, string> = {
  invalidate: '标记失效',
  'move-group': '迁移记忆组',
  restore: '恢复记忆',
  'resolve-conflict': '冲突裁决',
  rollback: '回滚操作',
};

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
}

function ReceiptRow({ receipt }: { receipt: GroupMemoryOperationReceipt }) {
  return (
    <li className="space-y-1 rounded-sm border border-border/70 bg-background/25 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-2xs">
        <span className="font-medium text-foreground">{OPERATION_LABELS[receipt.kind]}</span>
        <span className="text-muted-foreground">{formatTimestamp(receipt.occurredAt)}</span>
      </div>
      <div className="break-all font-mono text-3xs text-muted-foreground">
        回执：{receipt.id}
      </div>
      <div className="break-all text-3xs text-muted-foreground">
        记录：{receipt.changes.map((change) => change.recordId).join('、')}
      </div>
      {receipt.revertsReceiptId ? (
        <div className="break-all text-3xs text-primary">
          回滚目标：{receipt.revertsReceiptId}
        </div>
      ) : null}
    </li>
  );
}

function ArchiveRows({ archives }: { archives: GroupMemoryReceiptArchive[] }) {
  if (!archives.length) return null;
  return (
    <div className="mt-3 space-y-1 border-t border-border/70 pt-2">
      <div className="text-3xs text-muted-foreground">压缩归档（仅审计，不可回滚）</div>
      {archives.slice(-3).reverse().map((archive) => (
        <div key={archive.id} className="break-all text-3xs text-muted-foreground">
          {archive.count} 条 · {formatTimestamp(archive.firstOccurredAt)} —{' '}
          {formatTimestamp(archive.lastOccurredAt)} · {archive.firstReceiptId}
        </div>
      ))}
    </div>
  );
}

export function SettingsGroupMemoryHistory({
  archives,
  receipts,
}: {
  archives: GroupMemoryReceiptArchive[];
  receipts: GroupMemoryOperationReceipt[];
}) {
  const recentReceipts = receipts.slice(-5).reverse();
  const archivedCount = archives.reduce((count, archive) => count + archive.count, 0);
  return (
    <details className="rounded-sm border border-border bg-background/20 px-3 py-2">
      <summary className="cursor-pointer text-2xs text-muted-foreground">
        操作回执（活动 {receipts.length}，已归档 {archivedCount}）
      </summary>
      {recentReceipts.length ? (
        <ul className="mt-2 space-y-2">
          {recentReceipts.map((receipt) => <ReceiptRow key={receipt.id} receipt={receipt} />)}
        </ul>
      ) : (
        <div className="py-3 text-center text-2xs text-muted-foreground">暂无操作回执。</div>
      )}
      <ArchiveRows archives={archives} />
    </details>
  );
}
