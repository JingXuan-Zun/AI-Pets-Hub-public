export function SettingsGroupMemoryShadowCorpusGuide() {
  return (
    <details className="mt-2 rounded-sm border border-border/70 bg-background/30 px-2 py-1.5">
      <summary className="cursor-pointer text-3xs text-muted-foreground">人工标注与脱敏说明</summary>
      <ol className="mt-2 list-decimal space-y-1 pl-4 text-3xs leading-4 text-muted-foreground">
        <li>复制示例 sample，并为 sample、candidate、record 和 sourceMessage 设置唯一 ID。</li>
        <li>删除姓名、邮箱、电话、本机路径、账号、密钥、附件和原始聊天历史。</li>
        <li>实际工具结果标记为 eligible；普通讨论和角色观点标记为 manual-review。</li>
        <li>问题、推测、玩笑、临时测试内容和证据不一致项标记为 blocked。</li>
        <li>至少准备 20 条样本，其中应包含至少 5 条真实任务结果正例。</li>
        <li>全部脱敏完成后，手动把 redactionConfirmed 从 false 改为 true。</li>
      </ol>
      <p className="mt-2 text-3xs leading-4 text-amber-700">
        不要直接粘贴完整聊天导出；redactionConfirmed 只表示人工确认，导入器仍会再次扫描敏感内容。
      </p>
    </details>
  );
}
