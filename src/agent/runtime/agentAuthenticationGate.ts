export type AgentAuthenticationGateStatus =
  | 'authenticated'
  | 'login-required-ready'
  | 'login-required-needs-user'
  | 'unknown';

export interface AgentAuthenticationGateDecision {
  canSubmit: boolean;
  reason: string;
  requiresUser: boolean;
  status: AgentAuthenticationGateStatus;
}

interface AgentAuthenticationGateInput {
  controlText?: string | null;
  manualVerificationRequired?: boolean | null;
  postActionState?: string | null;
  text?: string | null;
}

function normalizeText(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim().toLowerCase()
    : '';
}

function hasLoginCue(text: string) {
  return /(?:login|log\s*in|sign\s*in|continue|confirm|submit|登录|登陆|继续|确认|提交)/iu.test(text);
}

function hasLoginGateCue(text: string) {
  return /(?:login\s+(?:page|screen|required|needed)|sign[-\s]?in\s+(?:page|screen|required|needed)|please\s+(?:log|sign)\s+in|needs?\s+login|登录(?:界面|页面|页|状态)|需要登录|未登录|账号密码|请输入(?:账号|账户|密码)|密码(?:为空|未填写)|账号(?:为空|未填写)|账户(?:为空|未填写))/iu.test(text);
}

const MANUAL_VERIFICATION_CUE = /(?:captcha|recaptcha|hcaptcha|verification\s*code|two[-\s]?factor|2fa|mfa|sms\s*code|qr\s*code|scan\s*(?:code|qr)|验证码|滑块|短信|动态码|二维码|扫码|二次验证)/iu;
const PRIVILEGE_GATE_CUE = /(?:administrator|admin|uac|管理员|权限)/iu;
const NEGATED_GATE_CUE = /(?:未(?:发现|检测到|见|出现|显示)|没有|无|不存在|不需要|无需|不含|not\s+(?:detected|found|present|required)|no|without)/iu;

function hasPositiveGateCue(text: string, cue: RegExp) {
  return text
    .split(/[。！？.!?\n,，;；]/u)
    .some((clause) => cue.test(clause) && !NEGATED_GATE_CUE.test(clause));
}

export function hasAgentAuthenticationManualVerificationCue(text: string) {
  return hasPositiveGateCue(text, MANUAL_VERIFICATION_CUE);
}

export function hasAgentAuthenticationHardGateCue(text: string) {
  return hasAgentAuthenticationManualVerificationCue(text)
    || hasPositiveGateCue(text, PRIVILEGE_GATE_CUE);
}

function hasMissingCredentialCue(text: string) {
  return /(?:empty|required|missing|please\s+(?:enter|provide)|not\s+(?:filled|provided)|账号(?:为空|未填写)|账户(?:为空|未填写)|密码(?:为空|未填写)|请输入(?:账号|账户|密码)|需要输入(?:账号|账户|密码))/iu.test(text);
}

function hasAuthenticatedCue(text: string) {
  return /(?:logged\s+in|already\s+(?:logged|signed)\s+in|login\s+(?:successful|succeeded|complete)|main\s+(?:interface|window|page)|home\s+page|friends?\s+list|已登录|登录成功|登陆成功|登录完成|主界面|主页|好友列表|无需登录)/iu.test(text)
    && !hasLoginGateCue(text);
}

export function resolveAgentAuthenticationGate(
  input: AgentAuthenticationGateInput,
): AgentAuthenticationGateDecision {
  const state = normalizeText(input.postActionState);
  const text = [input.text, input.controlText].filter(Boolean).map(normalizeText).join('\n');
  const loginRequired = state === 'login_required' || hasLoginGateCue(text);
  const manualVerificationRequired = input.manualVerificationRequired === true
    || hasAgentAuthenticationManualVerificationCue(text);

  if (hasAuthenticatedCue(text) && !loginRequired) {
    return {
      canSubmit: false,
      reason: 'The application is already authenticated; continue with the original task.',
      requiresUser: false,
      status: 'authenticated',
    };
  }

  if (!loginRequired) {
    return {
      canSubmit: false,
      reason: 'Authentication state is not established.',
      requiresUser: false,
      status: 'unknown',
    };
  }

  if (manualVerificationRequired || hasMissingCredentialCue(text)) {
    return {
      canSubmit: false,
      reason: manualVerificationRequired
        ? 'A manual verification step is required before login can continue.'
        : 'Required credentials are missing; the user must fill them before login can continue.',
      requiresUser: true,
      status: 'login-required-needs-user',
    };
  }

  if (!hasLoginCue(normalizeText(input.controlText))) {
    return {
      canSubmit: false,
      reason: 'Login is required, but no actionable login control was identified.',
      requiresUser: false,
      status: 'unknown',
    };
  }

  return {
    canSubmit: true,
    reason: 'Login is required and an actionable login control is available; submit through the approved desktop action.',
    requiresUser: false,
    status: 'login-required-ready',
  };
}
