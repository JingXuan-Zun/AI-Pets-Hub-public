import type { AgentRequestedActionKind, AgentActionCoverageDependencies } from '../agentActionCoverage';

export const AGENT_ACTION_KIND_LABELS: Record<AgentRequestedActionKind, string> = {
  'browser-navigation': 'open/search/navigate browser content',
  'close-window': 'close the requested app/window',
  'desktop-input': 'click/type/press/drag on the desktop',
  'desktop-organization-execute': 'execute desktop icon organization',
  'file-management-execute': 'execute local file management',
  'in-app-action': 'perform the requested action inside the app UI',
  'open-or-launch': 'open/focus/launch the requested app or resource',
  'window-move-or-control': 'move/control the requested window',
};

const AGENT_VIDEO_SOURCE_PATTERN = /(?:\b(?:video|clip|youtube|bilibili|bili|shorts?|stream|movie)\b|\u89c6\u9891|\u5f71\u7247|\u77ed\u7247|\u756a\u5267|\u5f71\u50cf)/iu;

const AGENT_VIDEO_SUMMARY_PATTERN = /(?:\b(?:watch|summari[sz]e|summary|recap|describe|explain)\b|\u770b|\u89c2\u770b|\u603b\u7ed3|\u6982\u62ec|\u6982\u8981|\u5206\u6790|\u8bb2\u4e86\u4ec0\u4e48|\u5185\u5bb9)/iu;

const AGENT_EXPLICIT_VIDEO_SEARCH_PATTERN = /(?:\b(?:search|find|lookup|look\s*up)\b|\u641c\u7d22|\u641c|\u67e5\u627e|\u627e\u4e00\u4e0b|\u627e\u51e0\u4e2a)/iu;

const AGENT_EXPLICIT_DIRECT_ACTION_PATTERN = /(?:\u6574\u7406|\u6392\u5217|\u6536\u62fe|\u5f52\u6574|\u6446\u653e|\u79fb\u52a8|\u642c\u5230|\u590d\u5236|\u91cd\u547d\u540d|\u6539\u540d|\u65b0\u5efa|\u521b\u5efa|\u5220\u9664|\u4e22\u8fdb\u56de\u6536\u7ad9|\u653e\u5230\u56de\u6536\u7ad9|\u6e05\u7406|\u6253\u5f00|\u5173\u95ed|\u8fd0\u884c|\u542f\u52a8(?!\u5668)|\u5f00\u542f|\u6267\u884c|\u5f00\u59cb|\u9009\u62e9|\u9009\u4e2d|\u5207\u6362|\u52fe\u9009|\u53d6\u6d88\u52fe\u9009|\u5c55\u5f00|\u6536\u8d77|\u6eda\u52a8|\u70b9\u51fb|\u70b9\u4e00\u4e0b|\u6309\u4e0b|\u8f93\u5165|\u6253\u5b57|\u62d6\u62fd|\\b(?:organize|arrange|move|copy|rename|create|trash|delete|open|close|run|start|launch|execute|select|choose|toggle|check|uncheck|expand|collapse|scroll(?:intoview|into\\s*view)?|click|press|type|drag)\\b)/iu;

const AGENT_EXPLICIT_ENGLISH_DIRECT_ACTION_PATTERN = /\b(?:organize|arrange|move|copy|rename|create|trash|delete|open|close|run|start|launch|execute|select|choose|toggle|check|uncheck|expand|collapse|scroll(?:intoview|into\s*view)?|click|press|type|drag)\b/iu;

const AGENT_NEGATED_SIDE_EFFECT_SCOPE_PATTERN = /(?:(?:\u4e0d(?:\u8981|\u7528)?|\u65e0\u9700)(?:\u518d)?(?:\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u805a\u7126|\u79fb\u52a8|\u70b9\u51fb|\u8f93\u5165|\u9009\u62e9|\u6267\u884c|\u63a7\u5236|\u5173\u95ed|\u6574\u7406|\u6392\u5217|\u590d\u5236|\u91cd\u547d\u540d|\u5220\u9664|\u4fee\u6539|\u521b\u5efa)(?:(?:\u3001|\uff0c|,|\/|\u6216|\u548c|\u4ee5\u53ca)(?:\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u805a\u7126|\u79fb\u52a8|\u70b9\u51fb|\u8f93\u5165|\u9009\u62e9|\u6267\u884c|\u63a7\u5236|\u5173\u95ed|\u6574\u7406|\u6392\u5217|\u590d\u5236|\u91cd\u547d\u540d|\u5220\u9664|\u4fee\u6539|\u521b\u5efa))*(?:\u4efb\u4f55)?(?:\u5185\u5bb9|\u72b6\u6001|\u5e94\u7528|\u7a97\u53e3|\u6587\u4ef6|\u6570\u636e|\u8bbe\u7f6e|\u9879\u76ee|\u64cd\u4f5c)?|donot(?:open|launch|start|run|focus|move|click|type|select|execute|control|close|organize|arrange|copy|rename|delete|modify|create)(?:(?:,|or|and)(?:open|launch|start|run|focus|move|click|type|select|execute|control|close|organize|arrange|copy|rename|delete|modify|create))*(?:anything)?)/iu;

const AGENT_NEGATED_SIDE_EFFECT_SCOPE_GLOBAL_PATTERN = /(?:(?:\u4e0d(?:\u8981|\u7528)?|\u65e0\u9700)(?:\u518d)?(?:\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u805a\u7126|\u79fb\u52a8|\u70b9\u51fb|\u8f93\u5165|\u9009\u62e9|\u6267\u884c|\u63a7\u5236|\u5173\u95ed|\u6574\u7406|\u6392\u5217|\u590d\u5236|\u91cd\u547d\u540d|\u5220\u9664|\u4fee\u6539|\u521b\u5efa)(?:(?:\u3001|\uff0c|,|\/|\u6216|\u548c|\u4ee5\u53ca)(?:\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u805a\u7126|\u79fb\u52a8|\u70b9\u51fb|\u8f93\u5165|\u9009\u62e9|\u6267\u884c|\u63a7\u5236|\u5173\u95ed|\u6574\u7406|\u6392\u5217|\u590d\u5236|\u91cd\u547d\u540d|\u5220\u9664|\u4fee\u6539|\u521b\u5efa))*(?:\u4efb\u4f55)?(?:\u5185\u5bb9|\u72b6\u6001|\u5e94\u7528|\u7a97\u53e3|\u6587\u4ef6|\u6570\u636e|\u8bbe\u7f6e|\u9879\u76ee|\u64cd\u4f5c)?|donot(?:open|launch|start|run|focus|move|click|type|select|execute|control|close|organize|arrange|copy|rename|delete|modify|create)(?:(?:,|or|and)(?:open|launch|start|run|focus|move|click|type|select|execute|control|close|organize|arrange|copy|rename|delete|modify|create))*(?:anything)?)/giu;

const AGENT_NEGATED_ACTION_CLAUSE_PATTERN = /(?:(?:\u4e0d\u8981|\u4e0d\u7528|\u65e0\u9700)(?:\u518d)?(?:\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u805a\u7126|\u79fb\u52a8|\u70b9\u51fb|\u8f93\u5165|\u9009\u62e9|\u6267\u884c|\u63a7\u5236|\u64cd\u4f5c|\u4ea4\u4e92|\u8c03\u7528|\u89e6\u53d1|\u5173\u95ed|\u6574\u7406|\u6392\u5217|\u590d\u5236|\u91cd\u547d\u540d|\u5220\u9664|\u4fee\u6539|\u521b\u5efa)(?:(?:\u3001|\uff0c|,|\/|\u6216|\u548c|\u4ee5\u53ca)(?:\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u805a\u7126|\u79fb\u52a8|\u70b9\u51fb|\u8f93\u5165|\u9009\u62e9|\u6267\u884c|\u63a7\u5236|\u64cd\u4f5c|\u4ea4\u4e92|\u8c03\u7528|\u89e6\u53d1|\u5173\u95ed|\u6574\u7406|\u6392\u5217|\u590d\u5236|\u91cd\u547d\u540d|\u5220\u9664|\u4fee\u6539|\u521b\u5efa))*[^\uff0c,\u3002\uff1b;!?\uff01\uff1f]*|\b(?:do\s+not|don't|dont|without)\s+(?:open|launch|start|run|focus|move|click|type|select|execute|control|operate|interact|invoke|trigger|close|organize|arrange|copy|rename|delete|modify|create)(?:(?:\s*,?\s*(?:or|and)\s+)(?:open|launch|start|run|focus|move|click|type|select|execute|control|operate|interact|invoke|trigger|close|organize|arrange|copy|rename|delete|modify|create))*[^,.;!?]*)/iu;

const AGENT_NEGATED_ACTION_CLAUSE_GLOBAL_PATTERN = /(?:(?:\u4e0d\u8981|\u4e0d\u7528|\u65e0\u9700)(?:\u518d)?(?:\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u805a\u7126|\u79fb\u52a8|\u70b9\u51fb|\u8f93\u5165|\u9009\u62e9|\u6267\u884c|\u63a7\u5236|\u64cd\u4f5c|\u4ea4\u4e92|\u8c03\u7528|\u89e6\u53d1|\u5173\u95ed|\u6574\u7406|\u6392\u5217|\u590d\u5236|\u91cd\u547d\u540d|\u5220\u9664|\u4fee\u6539|\u521b\u5efa)(?:(?:\u3001|\uff0c|,|\/|\u6216|\u548c|\u4ee5\u53ca)(?:\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u805a\u7126|\u79fb\u52a8|\u70b9\u51fb|\u8f93\u5165|\u9009\u62e9|\u6267\u884c|\u63a7\u5236|\u64cd\u4f5c|\u4ea4\u4e92|\u8c03\u7528|\u89e6\u53d1|\u5173\u95ed|\u6574\u7406|\u6392\u5217|\u590d\u5236|\u91cd\u547d\u540d|\u5220\u9664|\u4fee\u6539|\u521b\u5efa))*[^\uff0c,\u3002\uff1b;!?\uff01\uff1f]*|\b(?:do\s+not|don't|dont|without)\s+(?:open|launch|start|run|focus|move|click|type|select|execute|control|operate|interact|invoke|trigger|close|organize|arrange|copy|rename|delete|modify|create)(?:(?:\s*,?\s*(?:or|and)\s+)(?:open|launch|start|run|focus|move|click|type|select|execute|control|operate|interact|invoke|trigger|close|organize|arrange|copy|rename|delete|modify|create))*[^,.;!?]*)/giu;

const AGENT_NEGATED_OPERATION_SCOPE_PATTERN = /(?:\u4e0d(?:\u518d)?(?:\u8fdb\u884c|\u6267\u884c|\u505a|\u4f5c)(?:\u4efb\u4f55)?(?:\u5e94\u7528(?:\u7a0b\u5e8f)?(?:\u5185|\u5185\u90e8)?|\u5185\u90e8|\u754c\u9762(?:\u5185|\u5185\u90e8)?)?(?:\u64cd\u4f5c|\u4ea4\u4e92|\u70b9\u51fb|\u8f93\u5165|\u9009\u62e9|\u8c03\u7528|\u89e6\u53d1|\u4fee\u6539))/iu;

const AGENT_NEGATED_OPERATION_SCOPE_GLOBAL_PATTERN = /(?:\u4e0d(?:\u518d)?(?:\u8fdb\u884c|\u6267\u884c|\u505a|\u4f5c)(?:\u4efb\u4f55)?(?:\u5e94\u7528(?:\u7a0b\u5e8f)?(?:\u5185|\u5185\u90e8)?|\u5185\u90e8|\u754c\u9762(?:\u5185|\u5185\u90e8)?)?(?:\u64cd\u4f5c|\u4ea4\u4e92|\u70b9\u51fb|\u8f93\u5165|\u9009\u62e9|\u8c03\u7528|\u89e6\u53d1|\u4fee\u6539))/giu;

const AGENT_OPEN_OR_LAUNCH_REQUEST_PATTERN = /(?:\b(?:open(?:ing)?|launch(?:ing)?|start(?:ing)?|run(?:ning)?)\b|\u6253\u5f00|\u542f\u52a8(?!\u5668)|\u5f00\u542f|\u8fd0\u884c|\u6253\u5f00)/iu;

const AGENT_IN_APP_ACTION_REQUEST_PATTERN = /(?:\b(?:inside|within|in|from)\b.{0,100}\b(?:open(?:ing)?|launch(?:ing)?|start(?:ing)?|run(?:ning)?|play(?:ing)?|click(?:ing)?|press(?:ing)?)\b|\b(?:open(?:ing)?|launch(?:ing)?|start(?:ing)?|run(?:ning)?|play(?:ing)?|click(?:ing)?|press(?:ing)?)\b.{0,100}\b(?:inside|within|in|from)\b|\b(?:open(?:ing)?|launch(?:ing)?|start(?:ing)?|run(?:ning)?|play(?:ing)?)\b.{0,100}\b(?:using|via|through|with)\b.{1,80}(?:\b(?:launcher|client|app|application|platform)\b|$)|(?:\u5728|\u4ece).{0,80}(?:\u91cc|\u5185|\u4e2d|\u4e0a|\u5e73\u53f0|\u542f\u52a8\u5668).{0,80}(?:\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u5f00\u59cb|\u64ad\u653e|\u70b9\u51fb|\u70b9|\u6309)|(?:\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u5f00\u59cb|\u64ad\u653e|\u70b9\u51fb|\u70b9|\u6309).{0,80}(?:\u91cc|\u5185|\u4e2d|\u4e0a|\u5e73\u53f0|\u542f\u52a8\u5668)\u7684?|(?:\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c).{1,60}(?:\u5e76|\u7136\u540e|\u540e|\u518d).{0,60}(?:\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u5f00\u59cb|\u70b9\u51fb|\u70b9|\u6309))/iu;

const AGENT_AUTHENTICATION_ACTION_REQUEST_PATTERN = /(?:\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u5f00\u59cb|\u8fdb\u5165|open|launch|start|run|enter).{0,100}(?:\u767b\u5f55|\u767b\u9646|login|log\s*in|sign\s*in)|(?:\u767b\u5f55|\u767b\u9646|login|log\s*in|sign\s*in).{0,80}(?:\u6309\u94ae|\u63a7\u4ef6|\u8d26\u53f7|\u8d26\u6237|\u5e94\u7528|\u5ba2\u6237\u7aef|\u7cfb\u7edf|\u540e\u7eed|\u7136\u540e|button|control|account|app|client|system|continue)|^(?:\u767b\u5f55|\u767b\u9646|login|log\s*in|sign\s*in)$/iu;

const AGENT_AUTHENTICATION_OBSERVATION_PATTERN = /(?:\u68c0\u67e5|\u67e5\u770b|\u89c2\u5bdf|\u67e5\u8be2|\u786e\u8ba4|\u662f\u5426|\u6709\u6ca1\u6709|check|inspect|observe|status|whether).{0,24}(?:\u767b\u5f55|\u767b\u9646|login|log\s*in|sign\s*in)/iu;

const AGENT_DESKTOP_INPUT_REQUEST_PATTERN = /(?:\b(?:click|press|type|input|drag|hotkey|shortcut|send\s*keys?)\b|\u70b9\u51fb|\u70b9\u4e00\u4e0b|\u70b9|\u6309\u4e0b|\u6309|\u8f93\u5165|\u6253\u5b57|\u62d6\u62fd|\u62d6\u5230|\u5feb\u6377\u952e|\u7ec4\u5408\u952e)/iu;

const AGENT_BROWSER_NAVIGATION_REQUEST_PATTERN = /(?:https?:\/\/|www\.|[\w-]+\.(?:com|cn|net|org|io|dev|app|gg|tv)\b|\b(?:search|visit|navigate|go\s*to|open)\b.{0,100}\b(?:website|site|url|web\s*page|page|tab)\b|\u7f51\u5740|\u7f51\u7ad9|\u7f51\u9875|\u94fe\u63a5|\u641c\u7d22|\u67e5\u8be2)/iu;

const AGENT_CLOSE_WINDOW_REQUEST_PATTERN = /(?:\b(?:close|quit|exit)\b|\u5173\u95ed|\u9000\u51fa)/iu;

const AGENT_FILE_MANAGEMENT_REQUEST_PATTERN = /(?:\b(?:copy|move|rename|create|trash|delete)\b.{0,80}\b(?:file|folder|directory|path)\b|\u590d\u5236|\u91cd\u547d\u540d|\u6539\u540d|\u65b0\u5efa|\u521b\u5efa|\u5220\u9664|\u4e22\u8fdb\u56de\u6536\u7ad9|\u653e\u5230\u56de\u6536\u7ad9)/iu;

const AGENT_LOCAL_PATH_PATTERN = /(?:[a-z]:[\\/]|\\\\[^\\/\s]+[\\/][^\\/\s]+|\/(?:users|home|mnt|opt|applications|volumes)\b)/iu;

const AGENT_LAUNCHER_OBSERVATION_QUERY_PATTERN = /(?:\b(?:check|inspect|see|look\s*(?:for|up)?|find|search|contains?|whether|which|where)\b|\u67e5|\u67e5\u4e00\u4e0b|\u67e5\u770b|\u770b\u770b|\u770b\u4e00\u4e0b|\u770b\u4e0b|\u627e|\u627e\u4e00\u4e0b|\u641c|\u641c\u4e00\u4e0b|\u641c\u7d22|\u6709\u6ca1\u6709|\u662f\u4e0d\u662f\u6709|\u662f\u5426\u6709|\u54ea\u4e2a|\u54ea\u4e9b|\u5728\u54ea)/iu;

const AGENT_LAUNCHER_OBSERVATION_TARGET_PATTERN = /(?:\b(?:launcher|shortcut|executable|startup\s*method|start\s*method|entrypoint|entry\s*point)\b|\.exe\b|\.lnk\b|\.url\b|\.appref-ms\b|\u542f\u52a8\u65b9\u5f0f|\u8fd0\u884c\u65b9\u5f0f|\u5feb\u6377\u65b9\u5f0f|\u542f\u52a8\u5668|\u542f\u52a8\u9879|\u542f\u52a8\u6587\u4ef6|\u5165\u53e3\u6587\u4ef6|\u53ef\u6267\u884c\u6587\u4ef6)/iu;

export function normalizeAgentIntentText(...values: string[]) {
  return values
    .join(' ')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/gu, '');
}

function normalizeAgentSpacedIntentText(...values: string[]) {
  return values
    .join(' ')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeAgentVideoIntentText(...values: string[]) {
  return values
    .join(' ')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}

export function isAgentVideoSummaryIntent(sourceText: string, userGoal: string) {
  const text = normalizeAgentVideoIntentText(sourceText, userGoal);
  return AGENT_VIDEO_SOURCE_PATTERN.test(text)
    && AGENT_VIDEO_SUMMARY_PATTERN.test(text);
}

export function hasAgentExplicitVideoSearchIntent(sourceText: string, userGoal: string) {
  return AGENT_EXPLICIT_VIDEO_SEARCH_PATTERN.test(
    normalizeAgentVideoIntentText(sourceText, userGoal),
  );
}

export function isAgentPreviewOnlyIntent(sourceText: string, userGoal: string) {
  const text = normalizeAgentIntentText(sourceText, userGoal);
  return isAgentExplicitReadOnlyObservationIntent(sourceText, userGoal)
    || /(?:\u53ea(?:\u9884\u89c8|\u89c2\u5bdf|\u67e5\u770b\u8ba1\u5212|\u770b\u770b\u8ba1\u5212|\u770b\u4e00\u4e0b\u8ba1\u5212|\u770b\u8ba1\u5212|\u5217\u8ba1\u5212)|(?:\u4e0d\u8981|\u5148\u522b)\u6267\u884c|(?:\u600e\u4e48|\u5982\u4f55).{0,10}(?:\u6574\u7406|\u6392\u5217|\u79fb\u52a8|\u590d\u5236|\u91cd\u547d\u540d|\u5220\u9664|\u8fd0\u884c|\u542f\u52a8|\u6253\u5f00|\u5173\u95ed)|(?:\u770b\u770b|\u770b\u4e00\u4e0b|\u770b\u4e0b).{0,10}(?:\u600e\u4e48|\u5982\u4f55|\u8ba1\u5212)|previewonly|planonly|dryrun)/iu.test(text);
}

export function isAgentExplicitReadOnlyObservationIntent(sourceText: string, userGoal: string) {
  const text = normalizeAgentIntentText(sourceText, userGoal);
  const hasReadOnlyScope = /(?:\u53ea|\u4ec5)(?:\u8bfb\u53d6|\u8bfb|\u67e5\u770b|\u89c2\u5bdf|\u67e5\u8be2)|readonly|read-only/iu.test(text);
  const hasObservationSummaryScope = /(?:\u5217\u51fa|\u6c47\u603b|\u603b\u7ed3|\u8fd4\u56de|\u67e5\u770b|\u89c2\u5bdf|\u67e5\u8be2|\u8bfb\u53d6).{0,16}(?:\u89c2\u5bdf\u7ed3\u679c|\u67e5\u8be2\u7ed3\u679c|\u8bfb\u53d6\u7ed3\u679c|\u5e94\u7528\u7a97\u53e3|\u7a97\u53e3\u5217\u8868|\u5f53\u524d\u72b6\u6001|\u53ef\u89c1\u4fe1\u606f)/iu.test(text);
  const hasNoActionScope = /(?:\u4e0d|\u4e0d\u8981|\u4e0d\u7528|\u65e0\u9700)(?:\u6267\u884c(?:\u4efb\u4f55)?\u64cd\u4f5c|\u8fdb\u884c(?:\u4efb\u4f55)?\u64cd\u4f5c|\u64cd\u4f5c)|noactions?|donot(?:execute|act)/iu.test(text)
    || AGENT_NEGATED_SIDE_EFFECT_SCOPE_PATTERN.test(text)
    || AGENT_NEGATED_ACTION_CLAUSE_PATTERN.test(text);
  if ((!hasReadOnlyScope && !hasObservationSummaryScope) || !hasNoActionScope) {
    return false;
  }

  const remainingText = text
    .replace(/(?:\u53ea|\u4ec5)(?:\u8bfb\u53d6|\u8bfb|\u67e5\u770b|\u89c2\u5bdf|\u67e5\u8be2)|readonly|read-only/giu, '')
    .replace(/(?:\u4e0d|\u4e0d\u8981|\u4e0d\u7528|\u65e0\u9700)(?:\u6267\u884c(?:\u4efb\u4f55)?\u64cd\u4f5c|\u8fdb\u884c(?:\u4efb\u4f55)?\u64cd\u4f5c|\u64cd\u4f5c)|noactions?|donot(?:execute|act)/giu, '')
    .replace(AGENT_NEGATED_SIDE_EFFECT_SCOPE_GLOBAL_PATTERN, '')
    .replace(AGENT_NEGATED_ACTION_CLAUSE_GLOBAL_PATTERN, '')
    .replace(/(?:\u5f53\u524d)?(?:\u6b63\u5728)?\u8fd0\u884c(?:\u4e2d)?(?:\u7684)?(?:\u5e94\u7528|\u7a0b\u5e8f|\u7a97\u53e3|\u8fdb\u7a0b)/giu, '');
  return !AGENT_EXPLICIT_DIRECT_ACTION_PATTERN.test(remainingText);
}

export function isAgentPlainEnglishCheckObservationIntent(sourceText: string, userGoal: string) {
  const spacedText = normalizeAgentSpacedIntentText(sourceText, userGoal);
  if (
    !/\bcheck\b/iu.test(spacedText)
    || /(?:checkbox|check\s*box|toggle|option|setting|radio\s*button|radiobutton|\u52fe\u9009|\u9009\u9879|\u5f00\u5173|\u8bbe\u7f6e)/iu.test(spacedText)
  ) {
    return false;
  }

  const spacedTextWithoutPlainCheck = spacedText.replace(/\bcheck\b/giu, ' ');
  const compactTextWithoutPlainCheck = spacedTextWithoutPlainCheck.replace(/\s+/gu, '');
  return !AGENT_EXPLICIT_DIRECT_ACTION_PATTERN.test(compactTextWithoutPlainCheck)
    && !/(?:select|choose|toggle|uncheck|expand|collapse|scroll(?:intoview|into\s*view)?|organize|arrange|move|copy|rename|create|trash|delete|open|close|run|start|launch|execute|click|press|type|drag)/iu.test(spacedTextWithoutPlainCheck);
}

function isAgentLocalLauncherObservationIntent(sourceText: string, userGoal: string) {
  const spacedText = normalizeAgentSpacedIntentText(sourceText, userGoal);
  return AGENT_LOCAL_PATH_PATTERN.test(spacedText)
    && AGENT_LAUNCHER_OBSERVATION_QUERY_PATTERN.test(spacedText)
    && AGENT_LAUNCHER_OBSERVATION_TARGET_PATTERN.test(spacedText);
}

function isAgentGenericObservationIntent(sourceText: string, userGoal: string) {
  const text = normalizeAgentSpacedIntentText(sourceText, userGoal);
  const hasObservationVerb = /(?:\b(?:list|show|check|observe|inspect|find|search|where|status)\b|\u67e5\u770b|\u89c2\u5bdf|\u68c0\u67e5|\u67e5\u8be2|\u627e\u5230?|\u663e\u793a|\u5217\u51fa|\u72b6\u6001)/iu.test(text);
  if (!hasObservationVerb) {
    return false;
  }

  return !/(?:\b(?:open|launch|start|run|focus|move|click|type|select|invoke|control|close|organize|arrange|copy|rename|delete|execute)\b|\u6253\u5f00|\u542f\u52a8|\u5f00\u59cb|\u8fd0\u884c(?!\u4e2d)|\u805a\u7126|\u79fb\u52a8|\u70b9\u51fb|\u8f93\u5165|\u9009\u62e9|\u63a7\u5236|\u5173\u95ed|\u6574\u7406|\u590d\u5236|\u91cd\u547d\u540d|\u5220\u9664|\u6267\u884c)/iu.test(text);
}

export function hasAgentDirectActionIntent(sourceText: string, userGoal: string) {
  if (isAgentPreviewOnlyIntent(sourceText, userGoal) || isAgentGenericObservationIntent(sourceText, userGoal)) {
    return false;
  }

  const text = normalizeAgentIntentText(sourceText, userGoal);
  const spacedText = normalizeAgentSpacedIntentText(sourceText, userGoal);
  if (
    isAgentPlainEnglishCheckObservationIntent(sourceText, userGoal)
    || isAgentLocalLauncherObservationIntent(sourceText, userGoal)
  ) {
    return false;
  }
  if (
    AGENT_EXPLICIT_DIRECT_ACTION_PATTERN.test(spacedText)
    || AGENT_EXPLICIT_ENGLISH_DIRECT_ACTION_PATTERN.test(spacedText)
  ) {
    return true;
  }
  if (/(?:\u9009\u62e9|\u9009\u4e2d|\u52fe\u9009|\u5c55\u5f00|\u6536\u8d77|\u6298\u53e0|\u6eda\u52a8|\u6eda\u5230|\u6ed1\u5230|\u663e\u793a\u51fa\u6765|\u79fb\u5230\u53ef\u89c1|select|choose|toggle|check|uncheck|expand|collapse|scroll(?:intoview|into\s*view)?)/iu.test(text)) {
    return true;
  }
  return /(?:\u6574\u7406|\u6392\u5217|\u6536\u62fe|\u5f52\u6574|\u6446\u653e|\u79fb\u52a8|\u642c\u5230|\u590d\u5236|\u91cd\u547d\u540d|\u6539\u540d|\u65b0\u5efa|\u521b\u5efa|\u5220\u9664|\u4e22\u8fdb\u56de\u6536\u7ad9|\u653e\u5230\u56de\u6536\u7ad9|\u6e05\u7406|\u6253\u5f00|\u5173\u95ed|\u8fd0\u884c|\u542f\u52a8(?!\u5668)|\u6267\u884c|\u5f00\u59cb|\u70b9\u51fb|\u70b9\u4e00\u4e0b|\u6309\u4e0b|\u8f93\u5165|\u62d6\u62fd|organize|arrange|move|copy|rename|create|trash|delete|open|close|run|start|execute|click|press|type|drag)/iu.test(text);
}

export function hasAgentExplicitDirectActionIntent(sourceText: string, userGoal: string) {
  if (
    isAgentPreviewOnlyIntent(sourceText, userGoal)
    || isAgentGenericObservationIntent(sourceText, userGoal)
    || isAgentPlainEnglishCheckObservationIntent(sourceText, userGoal)
    || isAgentLocalLauncherObservationIntent(sourceText, userGoal)
  ) {
    return false;
  }

  const spacedText = normalizeAgentSpacedIntentText(sourceText, userGoal);
  return AGENT_EXPLICIT_DIRECT_ACTION_PATTERN.test(spacedText)
    || AGENT_EXPLICIT_ENGLISH_DIRECT_ACTION_PATTERN.test(spacedText);
}

export function hasAgentEffectiveDirectActionIntent(sourceText: string, userGoal: string) {
  return hasAgentDirectActionIntent(sourceText, userGoal)
    || hasAgentExplicitDirectActionIntent(sourceText, userGoal);
}

function normalizeAgentActionCoverageText(sourceText: string, userGoal: string) {
  const normalizedSourceText = sourceText.normalize('NFKC').toLowerCase().trim();
  const normalizedUserGoal = userGoal.normalize('NFKC').toLowerCase().trim();
  const combinedText = normalizedSourceText === normalizedUserGoal
    ? normalizedSourceText
    : `${normalizedSourceText} ${normalizedUserGoal}`;
  return combinedText
    .replace(AGENT_NEGATED_ACTION_CLAUSE_GLOBAL_PATTERN, ' ')
    .replace(AGENT_NEGATED_SIDE_EFFECT_SCOPE_GLOBAL_PATTERN, ' ')
    .replace(AGENT_NEGATED_OPERATION_SCOPE_GLOBAL_PATTERN, ' ')
    .replace(
      /(?:(?:\u5f53\u524d|\u76ee\u524d|\u73b0\u6709)(?:\u5df2\u7ecf|\u5df2|\u6b63\u5728)?|(?:\u5df2\u7ecf|\u5df2|\u6b63\u5728))(?:\u6253\u5f00|\u5f00\u542f|\u542f\u52a8|\u8fd0\u884c)(?:\u4e2d)?\u7684?|\b(?:currently|already|presently)\s+(?:open|opened|running|started|launched)\b/giu,
      ' ',
    )
    .replace(/\s+/gu, ' ')
    .trim();
}

function collectAgentNegatedActionClauses(sourceText: string, userGoal: string) {
  const text = normalizeAgentSpacedIntentText(sourceText, userGoal);
  return [...new Set([
    ...(text.match(AGENT_NEGATED_ACTION_CLAUSE_GLOBAL_PATTERN) ?? []),
    ...(text.match(AGENT_NEGATED_SIDE_EFFECT_SCOPE_GLOBAL_PATTERN) ?? []),
    ...(text.match(AGENT_NEGATED_OPERATION_SCOPE_GLOBAL_PATTERN) ?? []),
  ])];
}

export function createAgentExplicitlyProhibitedActionCoverage(options: {
  sourceText: string;
  userGoal: string;
}) {
  const coverage = new Set<AgentRequestedActionKind>();
  const clauses = collectAgentNegatedActionClauses(options.sourceText, options.userGoal);
  for (const clause of clauses) {
    const blanketProhibition = /(?:\u4efb\u4f55\u64cd\u4f5c|\u4efb\u4f55\u5185\u5bb9|\b(?:any|all)\s+(?:action|operation)s?\b|\bno\s+actions?\b)/iu.test(clause);
    if (blanketProhibition) {
      for (const kind of Object.keys(AGENT_ACTION_KIND_LABELS) as AgentRequestedActionKind[]) {
        addAgentActionCoverage(coverage, kind);
      }
      continue;
    }

    const prohibitsDesktopInput = /(?:\u70b9\u51fb|\u8f93\u5165|\u9009\u62e9|\u6309\u4e0b|\u6253\u5b57|\u62d6\u62fd|\u6eda\u52a8|\u64cd\u4f5c|\u4ea4\u4e92|\u8c03\u7528|\u89e6\u53d1|\b(?:click|type|input|select|choose|press|drag|scroll|operate|interact|invoke|trigger)\b)/iu.test(clause);
    const prohibitsInAppAction = prohibitsDesktopInput
      && /(?:\u5e94\u7528\u5185\u90e8|\u5185\u90e8|\u63a7\u4ef6|\u6309\u94ae|\u754c\u9762|\u9875\u9762|\b(?:in[-\s]?app|inside|internal|control|button|ui|page)\b)/iu.test(clause);
    if (prohibitsDesktopInput) {
      addAgentActionCoverage(coverage, 'desktop-input');
    }
    if (prohibitsInAppAction) {
      addAgentActionCoverage(coverage, 'in-app-action');
    }
    if (/(?:\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u5f00\u542f|\b(?:open|launch|start|run)\b)/iu.test(clause)) {
      addAgentActionCoverage(coverage, 'open-or-launch');
    }
    if (/(?:\u5173\u95ed|\u9000\u51fa|\b(?:close|quit|exit)\b)/iu.test(clause)) {
      addAgentActionCoverage(coverage, 'close-window');
    }
    if (/(?:\u805a\u7126|\u79fb\u52a8|\u63a7\u5236).{0,20}(?:\u7a97\u53e3|\u5e94\u7528)|\b(?:focus|move|control)\b.{0,30}\b(?:window|app|application)\b/iu.test(clause)) {
      addAgentActionCoverage(coverage, 'window-move-or-control');
    }
    if (/(?:\u6574\u7406|\u6392\u5217|\u6536\u62fe|\u5f52\u6574|\b(?:organize|arrange)\b)/iu.test(clause)) {
      addAgentActionCoverage(coverage, 'desktop-organization-execute');
    }
    if (/(?:\u590d\u5236|\u91cd\u547d\u540d|\u5220\u9664|\u4fee\u6539|\u521b\u5efa|\b(?:copy|rename|delete|modify|create)\b)/iu.test(clause)) {
      addAgentActionCoverage(coverage, 'file-management-execute');
    }
    if (/(?:\u7f51\u9875|\u7f51\u5740|\u7f51\u7ad9|\u641c\u7d22|\b(?:url|website|webpage|search|navigate)\b)/iu.test(clause)) {
      addAgentActionCoverage(coverage, 'browser-navigation');
    }
  }
  return coverage;
}

export function addAgentActionCoverage(
  coverage: Set<AgentRequestedActionKind>,
  kind: AgentRequestedActionKind,
) {
  coverage.add(kind);
}

export function createAgentRequestedActionCoverage(options: {
  dependencies: Pick<AgentActionCoverageDependencies, 'hasDesktopOrganizationRequest' | 'hasWindowMoveToDisplayRequest'>;
  sourceText: string;
  userGoal: string;
}) {
  const text = normalizeAgentActionCoverageText(options.sourceText, options.userGoal);
  const coverage = new Set<AgentRequestedActionKind>();
  if (isAgentLocalLauncherObservationIntent(options.sourceText, options.userGoal)) {
    return coverage;
  }

  const isInAppRequest = AGENT_IN_APP_ACTION_REQUEST_PATTERN.test(text);
  const isAuthenticationActionRequest = AGENT_AUTHENTICATION_ACTION_REQUEST_PATTERN.test(text)
    && !AGENT_AUTHENTICATION_OBSERVATION_PATTERN.test(text);

  if (isInAppRequest || isAuthenticationActionRequest) {
    addAgentActionCoverage(coverage, 'in-app-action');
  }

  if (AGENT_OPEN_OR_LAUNCH_REQUEST_PATTERN.test(text)) {
    addAgentActionCoverage(coverage, 'open-or-launch');
  }

  if (AGENT_DESKTOP_INPUT_REQUEST_PATTERN.test(text)) {
    addAgentActionCoverage(coverage, 'desktop-input');
  }

  if (
    AGENT_BROWSER_NAVIGATION_REQUEST_PATTERN.test(text)
    && !isAgentVideoSummaryIntent(options.sourceText, options.userGoal)
  ) {
    addAgentActionCoverage(coverage, 'browser-navigation');
  }

  if (AGENT_CLOSE_WINDOW_REQUEST_PATTERN.test(text)) {
    addAgentActionCoverage(coverage, 'close-window');
  }

  if (AGENT_FILE_MANAGEMENT_REQUEST_PATTERN.test(text)) {
    addAgentActionCoverage(coverage, 'file-management-execute');
  }

  if (options.dependencies.hasWindowMoveToDisplayRequest(text)) {
    addAgentActionCoverage(coverage, 'window-move-or-control');
  }

  if (
    options.dependencies.hasDesktopOrganizationRequest(text)
    && !isAgentPreviewOnlyIntent(options.sourceText, options.userGoal)
  ) {
    addAgentActionCoverage(coverage, 'desktop-organization-execute');
  }

  return coverage;
}
