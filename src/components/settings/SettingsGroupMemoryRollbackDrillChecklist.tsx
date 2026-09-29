import type {
  GroupMemoryAutoWriteGateId,
  GroupMemoryAutoWriteReadinessReport,
} from '../../group-memory';

const DRILLS: Array<{
  gateId: GroupMemoryAutoWriteGateId;
  steps: string[];
  title: string;
}> = [{
  gateId: 'candidate-review-rollback-drill', title: '候选审核回滚', steps: [
    '选择一条可丢弃的测试候选并人工批准。',
    '立即执行审核回滚，确认候选恢复 pending，正式记录恢复到批准前状态。',
    '刷新设置页，确认回滚回执仍存在且不会重复执行。',
  ],
}, {
  gateId: 'record-operation-rollback-drill', title: '正式记忆操作回滚', steps: [
    '选择测试记忆执行失效、恢复或迁移操作。',
    '点击“回滚上次操作”，确认记录内容和记忆组精确恢复。',
    '核对审计记录，确认同一操作回执不能被再次指定回滚。',
  ],
}, {
  gateId: 'scope-correction-drill', title: '证据范围纠正', steps: [
    '为测试快照追加一条带原因的范围纠正。',
    '再次追加纠正，确认前一条没有被覆盖且形成替代链。',
    '在社会事件时间线确认“纠正了／后来被纠正”双向关联。',
  ],
}];

export function SettingsGroupMemoryRollbackDrillChecklist(props: {
  report: GroupMemoryAutoWriteReadinessReport;
}) {
  const statusById = new Map(props.report.gates.map((item) => [item.id, item.status]));
  return <details className="rounded-sm border border-border/70 bg-background/30 px-2 py-1.5">
    <summary className="cursor-pointer text-3xs text-muted-foreground">
      回滚与误记纠正演练清单
    </summary>
    <div className="mt-2 space-y-2">
      {DRILLS.map((drill) => <div key={drill.gateId} className="text-3xs leading-4">
        <div className="font-medium text-foreground">
          {drill.title} · {statusById.get(drill.gateId) === 'pass' ? '已有回执' : '尚待演练'}
        </div>
        <ol className="list-decimal pl-4 text-muted-foreground">
          {drill.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </div>)}
    </div>
    <p className="mt-2 text-3xs leading-4 text-amber-700">
      仅在测试配置中使用明确标记的测试候选和测试记忆；清单不会自行执行任何操作。
    </p>
  </details>;
}
