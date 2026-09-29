import {
  type AgentDesktopOrganizationDisplayTarget,
  type AgentDesktopOrganizationScope,
} from './agentChatCommand';

const DISPLAY_TARGET_VALUES = ['primary', 'secondary', 'current', 'all'] as const;
const DESKTOP_ORGANIZATION_SCOPE_VALUES = ['all-icons', 'display-icons'] as const;

function compactDesktopOrganizationText(value: string) {
  return value.trim().replace(/\s+/gu, '');
}

const DESKTOP_ORGANIZATION_DISPLAY_TEXT = '(?:副屏|副显示器|第二屏|第二个屏|扩展屏|外接屏|2号屏|二号屏|主屏|主显示器|第一屏|第一个屏|1号屏|一号屏)';
const DESKTOP_ORGANIZATION_SOURCE_TEXT = '(?:全部|所有|整个桌面|全桌面|桌面(?:的)?(?:全部|所有)?(?:图标|文件|快捷方式)?|图标|文件|快捷方式)';
const DESKTOP_ORGANIZATION_ACTION_TEXT = '(?:整理|排列|摆放|归整|分类|收拾)';
const DESKTOP_ORGANIZATION_PLACEMENT_TEXT = '(?:放到|放在|移动到|移到|拖到|摆到|排到|整理到|归整到|搬到|放去)';

export function normalizeDesktopOrganizationDisplayTargetValue(
  value: unknown,
): AgentDesktopOrganizationDisplayTarget | undefined {
  return DISPLAY_TARGET_VALUES.includes(value as AgentDesktopOrganizationDisplayTarget)
    ? value as AgentDesktopOrganizationDisplayTarget
    : undefined;
}

export function normalizeDesktopOrganizationScopeValue(
  value: unknown,
): AgentDesktopOrganizationScope | undefined {
  return DESKTOP_ORGANIZATION_SCOPE_VALUES.includes(value as AgentDesktopOrganizationScope)
    ? value as AgentDesktopOrganizationScope
    : undefined;
}

export function hasExplicitAllDesktopIconsToDisplayIntent(text: string) {
  const compactText = compactDesktopOrganizationText(text);
  return new RegExp(
    `(?:全部|所有|整个桌面|全桌面|桌面(?:的)?(?:全部|所有)?(?:图标|文件|快捷方式)?).{0,16}${DESKTOP_ORGANIZATION_PLACEMENT_TEXT}.{0,8}${DESKTOP_ORGANIZATION_DISPLAY_TEXT}`,
    'u',
  ).test(compactText);
}

export function hasExplicitDesktopOrganizationToDisplayIntent(text: string) {
  const compactText = compactDesktopOrganizationText(text);
  const chineseIntent = new RegExp(
    `(?:${DESKTOP_ORGANIZATION_ACTION_TEXT}.{0,24}${DESKTOP_ORGANIZATION_PLACEMENT_TEXT}|${DESKTOP_ORGANIZATION_SOURCE_TEXT}.{0,24}${DESKTOP_ORGANIZATION_PLACEMENT_TEXT}).{0,8}${DESKTOP_ORGANIZATION_DISPLAY_TEXT}`,
    'u',
  );
  const englishIntent = /(?:organize|arrange|sort|group|classify|tidy|clean\s*up).{0,48}(?:desktop|icons?|files?|shortcuts?).{0,48}(?:to|onto|on|in|into).{0,24}(?:secondary|primary|second\s*screen|main\s*screen|monitor|display|screen)/iu;

  return chineseIntent.test(compactText) || englishIntent.test(text);
}

export function resolveSafeDesktopOrganizationScope(options: {
  displayTarget?: AgentDesktopOrganizationDisplayTarget;
  requestedScope?: AgentDesktopOrganizationScope;
  sourceText?: string;
  structuredIntent?: boolean;
}) {
  const {
    displayTarget,
    requestedScope,
    sourceText = '',
    structuredIntent = false,
  } = options;

  if (!displayTarget || displayTarget === 'all') {
    return requestedScope;
  }

  if (requestedScope === 'all-icons' && structuredIntent) {
    return 'all-icons';
  }

  if (
    requestedScope === 'all-icons'
    && (
      hasExplicitAllDesktopIconsToDisplayIntent(sourceText)
      || hasExplicitDesktopOrganizationToDisplayIntent(sourceText)
    )
  ) {
    return 'all-icons';
  }

  if (requestedScope === 'all-icons') {
    return 'display-icons';
  }

  return requestedScope ?? 'display-icons';
}
