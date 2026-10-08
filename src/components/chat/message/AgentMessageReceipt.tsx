import { type ChatAgentExecutionReceipt } from '../../../types';

function resolveAgentReceiptStatusText(status: ChatAgentExecutionReceipt['status']) {
  switch (status) {
    case 'success':
      return '已验证';
    case 'failed':
      return '失败';
    case 'blocked':
      return '已拦截';
    default:
      return '未验证';
  }
}

function resolveAgentReceiptStatusClassName(status: ChatAgentExecutionReceipt['status']) {
  switch (status) {
    case 'success':
      return 'border-emerald-100 bg-emerald-50 text-emerald-700';
    case 'failed':
      return 'border-rose-100 bg-rose-50 text-rose-700';
    case 'blocked':
      return 'border-amber-100 bg-amber-50 text-amber-700';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

export function PetChatAgentExecutionReceipt({
  receipt,
}: {
  receipt?: ChatAgentExecutionReceipt | null;
}) {
  if (!receipt) {
    return null;
  }

  const evidenceLines = [
    receipt.verification ? `验证：${receipt.verification}` : '',
    ...(receipt.evidenceLines ?? []),
  ].filter(Boolean).slice(0, 5);

  return (
    <div className="mt-2 rounded-md border border-emerald-100 bg-emerald-50/45 px-2 py-1.5 text-2xs leading-relaxed text-foreground">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="min-w-0 font-semibold text-emerald-800">
          <span className="break-words">{receipt.title || '执行回执'}</span>
          {receipt.toolName ? <span className="ml-1 font-normal text-emerald-600">({receipt.toolName})</span> : null}
        </span>
        <span className={`shrink-0 rounded-full border px-1.5 py-0.5 ${resolveAgentReceiptStatusClassName(receipt.status)}`}>
          {resolveAgentReceiptStatusText(receipt.status)}
        </span>
      </div>
      {receipt.summaryLines.length ? (
        <ul className="space-y-0.5">
          {receipt.summaryLines.slice(0, 5).map((line, index) => (
            <li key={`receipt-summary-${index}`} className="break-words">
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      {evidenceLines.length ? (
        <div className="mt-1 space-y-0.5 border-t border-emerald-100 pt-1 text-emerald-700">
          {evidenceLines.map((line, index) => (
            <div key={`receipt-evidence-${index}`} className="break-words">
              {line}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
