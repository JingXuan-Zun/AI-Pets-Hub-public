import type {
  RelationshipEvidenceShadowCalibrationStatus,
  RelationshipEvidenceShadowDriftMovement,
  RelationshipEvidenceShadowReasonDriftMovement,
  RelationshipEvidenceShadowReasonStabilityStatus,
  RelationshipEvidenceShadowManualReviewIssue,
  RelationshipEvidenceShadowManualReviewDecisionIssueCode,
  RelationshipEvidenceWindowReason,
} from '../../social-trend';

export const RELATIONSHIP_EVIDENCE_REVIEW_DECISION_ISSUE_LABELS: Record<
  RelationshipEvidenceShadowManualReviewDecisionIssueCode,
  string
> = {
  'acknowledgements-required': '必须确认已审查证据且不会自动应用',
  'accept-not-eligible': '当前证据尚未达到接受条件',
  'decision-file-too-large': '决定文件超过大小限制',
  'invalid-decision': '决定值无效',
  'invalid-evidence-reference': '证据引用格式无效',
  'invalid-json': '文件不是有效 JSON',
  'invalid-kind': '文件类型不正确',
  'invalid-rationale': '必须填写不超过2000字的理由',
  'invalid-reviewed-at': '审查时间无效',
  'invalid-root': '决定文件根结构无效',
  'stale-evidence-reference': '决定文件对应的证据已经变化',
  'unexpected-field': '文件包含未允许字段',
  'unsupported-schema': '决定文件版本不受支持',
};

export const RELATIONSHIP_EVIDENCE_MANUAL_REVIEW_ISSUE_LABELS: Record<
  RelationshipEvidenceShadowManualReviewIssue,
  string
> = {
  'aggregate-calibration-not-ready': '总体离线校准尚未通过',
  'aggregate-denominators-insufficient': '总体风险指标分母不足',
  'duplicate-corpus-ids': '存在重复批次 ID',
  'reason-denominators-insufficient': '八类原因精度或召回分母不足',
  'reason-stability-insufficient': '八类原因连续稳定性证据不足',
};

export const RELATIONSHIP_EVIDENCE_REASON_STABILITY_LABELS: Record<
  RelationshipEvidenceShadowReasonStabilityStatus,
  string
> = {
  'consistent-higher-movement': '连续明显升高',
  'consistent-lower-movement': '连续明显降低',
  'insufficient-comparable-batches': '连续可比较批次不足',
  'intermittent-movement': '间歇性明显变化',
  'mixed-direction-movement': '方向反复波动',
  'no-non-overlapping-movement': '未见区间不重叠变化',
};

export const RELATIONSHIP_EVIDENCE_REASON_DRIFT_LABELS: Record<
  RelationshipEvidenceShadowReasonDriftMovement,
  string
> = {
  'higher-non-overlapping': '区间不重叠，观察值升高',
  'insufficient-denominator': '分母不足',
  'lower-non-overlapping': '区间不重叠，观察值降低',
  'overlapping-intervals': '区间重叠',
};

export const RELATIONSHIP_EVIDENCE_REASON_LABELS: Record<
  RelationshipEvidenceWindowReason,
  string
> = {
  'contradictory-signals': '方向矛盾', 'high-rejection-rate': '拒绝率过高',
  'high-rollback-rate': '回滚率过高',
  'insufficient-distinct-messages': '不同消息不足',
  'insufficient-signals': '有效信号不足', 'short-duration': '持续时间不足',
  'sustained-pattern': '持续模式', 'unresolved-target': '目标未解析',
};

export const RELATIONSHIP_EVIDENCE_CALIBRATION_LABELS: Record<
  RelationshipEvidenceShadowCalibrationStatus,
  string
> = {
  'above-insufficient-misclassification': '证据不足样本误判率过高',
  'above-volatile-miss-rate': '矛盾样本漏检率过高',
  'below-sustained-recall': '持续模式召回率不足',
  'calibration-ready': '达到离线校准门槛',
  'insufficient-class-coverage': '三类样本覆盖不足',
  'insufficient-samples': '总样本数量不足',
  'unsafe-sustained-false-positive': '存在持续模式危险误判',
};

export const RELATIONSHIP_EVIDENCE_PROFILE_LABELS: Record<string, string> = {
  'calibration-strict-v1': '严格校准 v1',
  'calibration-v1': '基础校准 v1',
};

export const RELATIONSHIP_EVIDENCE_DRIFT_LABELS: Record<
  RelationshipEvidenceShadowDriftMovement,
  string
> = {
  'decreased-risk': '风险指标下降',
  'increased-risk': '风险指标上升',
  'insufficient-class-coverage': '类别覆盖不足，无法比较',
  'insufficient-denominator': '指标分母不足，暂不判断升降',
  mixed: '指标升降混合',
  stable: '指标保持稳定',
};
