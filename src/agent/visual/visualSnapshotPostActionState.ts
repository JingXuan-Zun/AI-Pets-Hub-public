import { type AgentStructuredToolEvidence } from '../agentChatCommand';
import { normalizeVisualSnapshotCompactMatchText } from './captureSourceMatching';
import { getVisualSnapshotStringField } from './visualSnapshotParsing';

export function isVisualSnapshotAuthenticatedState(value: unknown) {
  const text = typeof value === 'string'
    ? value.normalize('NFKC').trim().toLowerCase()
    : '';
  if (!text) {
    return false;
  }

  const authenticatedCue = /(?:logged\s+in|already\s+(?:logged|signed)\s+in|sign[-\s]?in\s+(?:successful|succeeded|complete)|login\s+(?:successful|succeeded|complete)|main\s+(?:interface|window|page)|home\s+page|friends?\s+list|已登录|已经登录|登录成功|登陆成功|登录完成|主界面|主页|好友列表|无需登录|非登录界面|logged[-\s]?in\s+state)/iu.test(text);
  const negatedLoginGateCue = /(?:does\s+not\s+show|not\s+(?:shown|visible|present)|no\s+(?:login|sign[-\s]?in)\s+(?:page|button)|无需|不需要|无须|未(?:显示|出现)|没有|无|不再|不是|非).{0,24}(?:login\s+page|sign[-\s]?in\s+page|login\s+button|sign[-\s]?in\s+button|登录界面|登录按钮|账号密码|验证码|二维码|captcha|two[-\s]?factor|2fa)|(?:login\s+page|sign[-\s]?in\s+page|login\s+button|sign[-\s]?in\s+button|登录界面|登录按钮|账号密码|验证码|二维码|captcha|two[-\s]?factor|2fa).{0,24}(?:does\s+not\s+show|not\s+(?:shown|visible|present)|not\s+needed|无需|不需要|无须|未(?:显示|出现)|没有|无|不再|不是|非)/iu.test(text);
  const loginGateCue = /(?:login\s+page|sign[-\s]?in\s+page|login\s+button|sign[-\s]?in\s+button|please\s+(?:log|sign)\s+in|needs?\s+login|登录界面|登录按钮|需要登录|未登录|账号密码|验证码|二维码|two[-\s]?factor|2fa|captcha)/iu.test(text)
    && !negatedLoginGateCue;
  return authenticatedCue && !loginGateCue;
}

export function normalizeVisualSnapshotPostActionState(value: unknown) {
  const text = typeof value === 'string'
    ? value.normalize('NFKC').trim().toLowerCase()
    : '';
  if (!text) {
    return '';
  }

  if (/(?:selection_mismatch|selected\s+(?:item|target)\s+(?:is|remains|still)\s+(?:not|different|wrong)|current\s+(?:selection|detail|page|title)\s+(?:is|remains|still)\s+(?:not|different|wrong)|target\s+(?:is\s+)?(?:visible|shown)\s+but\s+not\s+(?:selected|current)|not\s+selected|visible_only|visible\s+only|选中不匹配|当前选中不是|详情页不是|只是可见|仅可见|未选中)/iu.test(text)) {
    return /(?:selection_mismatch|mismatch|different|wrong|不匹配|不是)/iu.test(text)
      ? 'selection_mismatch'
      : 'visible_only';
  }

  if (/^(?:open|opened|launched|running|started|complete|completed)$/iu.test(text)) {
    return 'launched';
  }

  const hasNegatedError = /(?:no|without|not\s+(?:visible|shown|present)|absent|missing|cannot\s+see|can't\s+see|没有|无|未见|看不到)[^\n.]{0,36}(?:error|error_dialog|failed|failure|crash|exception|报错|错误|失败|异常|崩溃|无法)/iu.test(text);
  if (
    !hasNegatedError
    && /(?:error|error_dialog|failed|failure|crash|exception|报错|错误|失败|异常|崩溃|无法)/iu.test(text)
  ) {
    return 'error';
  }

  if (/(?:login_required|login|sign\s*in|password|account|qr\s*code|登录|登陆|账号|账户|密码|扫码|验证码|验证)/iu.test(text)) {
    return 'login_required';
  }

  if (/(?:updating|update|download|install|patch|verifying|extracting|preparing|queued|queue|waiting\s+in\s+queue|更新|下载|安装|修补|补丁|校验|验证中|解压|准备|排队)/iu.test(text)) {
    return 'updating';
  }

  if (/(?:loading|launching|starting|opening|initializing|connecting|please\s*wait|progress|spinner|waiting\s+for\s+(?:the\s+)?(?:game|app|application|window|client|server|target)|加载|启动中|正在启动|正在打开|初始化|连接中|正在连接|等待|进度)/iu.test(text)) {
    return 'loading';
  }

  if (/(?:unchanged|no\s+visible\s+change|same\s+screen|未变化|没有变化|仍然|还是原来|原页面)/iu.test(text)) {
    return 'unchanged';
  }

  if (/(?:blocked|permission|denied|blocked_by|被阻止|被拦截|权限|拒绝)/iu.test(text)) {
    return 'blocked';
  }

  if (/(?:launched|opened|running|started|已打开|已启动|进入|主界面|主页|运行中|完成)/iu.test(text)) {
    return 'launched';
  }

  if (/(?:unknown|unclear|不确定|不清楚|未知)/iu.test(text)) {
    return 'unknown';
  }

  return '';
}

export function normalizeVisualSnapshotSelectionVerificationStatus(value: unknown): AgentStructuredToolEvidence['selectionVerificationStatus'] {
  if (typeof value === 'boolean') {
    return value ? 'selected' : 'visible-only';
  }

  const text = typeof value === 'string'
    ? value.normalize('NFKC').trim().toLowerCase()
    : '';
  if (!text) {
    return null;
  }

  if (/^(?:selected|current|active|verified|confirmed|yes|true|已选中|选中|当前|已确认)$/iu.test(text)) {
    return 'selected';
  }
  if (/(?:mismatch|wrong|different|not\s+(?:target|selected|current)|selection_mismatch|不匹配|错误|不是目标|当前不是)/iu.test(text)) {
    return 'mismatch';
  }
  if (/(?:visible[_ -]?only|visible|shown|found|not\s+confirmed|unconfirmed|未确认|只是可见|仅可见|可见但未选中)/iu.test(text)) {
    return 'visible-only';
  }
  if (/(?:unknown|unclear|unsure|不确定|不清楚|未知)/iu.test(text)) {
    return 'unknown';
  }

  return null;
}

export function deriveVisualSnapshotSelectionVerificationStatus(options: {
  currentSelection: string;
  parsed: Record<string, unknown>;
  summaryText: string;
  targetMatched: string;
}): AgentStructuredToolEvidence['selectionVerificationStatus'] {
  const text = [
    options.summaryText,
    getVisualSnapshotStringField(options.parsed, ['selectionEvidence', 'selectionReason', 'currentPage', 'detailPage', 'mainContent']),
  ].filter(Boolean).join('\n').normalize('NFKC').toLowerCase();
  const current = normalizeVisualSnapshotCompactMatchText(options.currentSelection);
  const target = normalizeVisualSnapshotCompactMatchText(options.targetMatched);

  if (current && target) {
    return current.includes(target) || target.includes(current) ? 'selected' : 'mismatch';
  }

  if (/(?:current\s+(?:selection|detail|page|title).{0,32}(?:not|different|wrong)|selected\s+(?:item|target).{0,32}(?:not|different|wrong)|当前选中不是|详情页不是|选中不匹配)/iu.test(text)) {
    return 'mismatch';
  }
  if (/(?:visible\s+but\s+not\s+(?:selected|current)|visible[_ -]?only|only\s+visible|只是可见|仅可见|可见但未选中|未确认选中)/iu.test(text)) {
    return 'visible-only';
  }
  if (/(?:currently\s+selected|current\s+(?:selection|detail|page|title).{0,32}(?:is|matches)|已选中|当前选中|详情页显示)/iu.test(text)) {
    return 'selected';
  }

  return null;
}
