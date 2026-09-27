import { desktopPetChatStore } from '../chatStore';
import { desktopPetShellRuntime } from '../desktopShellRuntime';
import { type PetConfig, type PetPersonality } from '../types';

const WEB_SEARCH_QUERY_MAX_LENGTH = 72;
const WEB_SEARCH_QUERY_MAX_PARTS = 10;
const WEB_SEARCH_EXPLICIT_INTENT_PATTERN = /(?:联网|网页|网络|浏览器|上网|搜索引擎|搜索|搜一下|搜搜|搜一搜|查一下|查一查|查查|查询|查找|检索|找一下|百度|谷歌|必应|google|bing|baidu|browser|web|internet|online|search|look\s*up|lookup|browse)/iu;
const WEB_SEARCH_EXTERNAL_TOPIC_PATTERN = /(?:天气|气温|空气质量|新闻|热搜|公告|官网|官方文档|文档|api\s*文档|版本|更新日志|changelog|release|发布|上市|价格|现价|报价|股价|汇率|利率|票房|赛程|比分|排名|排行榜|榜单|航班|机票|火车票|高铁|限行|政策|法规|法律|招聘|下载|库存|开源项目|github|npm|pypi|maven|nuget|steam|电影排片|演唱会|门票|weather|news|price|stock|schedule|score|ranking|exchange\s*rate|docs|documentation|official|download)/iu;
const WEB_SEARCH_FRESHNESS_PATTERN = /(?:今天|今日|今晚|明天|昨天|现在|当前|目前|最近|近期|最新|刚刚|实时|本周|本月|今年|latest|current|today|now|recent|this\s+week|this\s+month)/iu;
const WEB_SEARCH_INFORMATION_REQUEST_PATTERN = /[?？]|(?:什么|多少|几|哪里|在哪|什么时候|怎么|怎样|如何|为什么|是否|有没有|能不能|可不可以|介绍|解释|说明|讲讲|说说|告诉我|整理|总结|对比|推荐|what|who|where|when|why|how|tell me|explain|describe|compare|recommend)/iu;
const WEB_SEARCH_REAL_WORLD_FACT_PATTERN = /(?:公司|产品|人物|地点|城市|国家|地区|政策|法规|比赛|活动|会议|展会|电影|游戏|软件|模型|项目|库|框架|插件|论文|报告|数据|市场|价格|版本|新闻|天气|company|product|person|place|city|country|policy|law|event|movie|game|software|model|project|library|framework|plugin|paper|report|market|version|news|weather)/iu;
const WEB_SEARCH_QUERY_FILLER_PATTERNS = [
  /^(?:请|麻烦|拜托|可以|能不能|能否|你能|帮我|帮忙|给我|替我|麻烦你|请你)+/giu,
  /(?:用|打开|调用|通过|去|上|联网|网页|网络|浏览器|搜索引擎|搜索|搜一下|搜搜|搜|查一下|查查|查询|查找|检索|看看|看一下|找一下|了解一下|告诉我|说一下|讲一下|整理一下|总结一下|帮我|给我|一下|一下子)/giu,
  /(?:please|can you|could you|would you|help me|use|open|browser|web|internet|online|search|look up|lookup|find|check|tell me|show me|summarize|summary|for me)/giu,
  /(?:我想知道|我想看看|我想查|我需要知道|我需要查|想知道|需要知道|有没有|是什么|是啥|怎么样|怎么回事|如何|为什么|谁能|你知道)/gu,
  /(?:相关|资料|信息|内容|结果|新闻给我|消息给我|发给我|给我看|给我查)/gu,
];
const WEB_SEARCH_QUERY_STOP_WORDS = new Set([
  'please',
  'can',
  'could',
  'would',
  'you',
  'help',
  'me',
  'use',
  'open',
  'browser',
  'web',
  'internet',
  'online',
  'search',
  'lookup',
  'look',
  'find',
  'check',
  'tell',
  'show',
  'summarize',
  'summary',
  'for',
  'about',
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
]);

export type BrowserSearchMode = 'allow' | 'block' | 'force';
export type ExternalWebSearchSource = 'auto' | 'tool';

type CustomWebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

type BrowserSearchResult = {
  ok?: boolean;
  browserLabel?: string;
  error?: string;
  query?: string;
  text?: string;
  url?: string;
};

function normalizePromptSnippet(text: string) {
  return text
    .replace(/\s+/gu, ' ')
    .trim();
}

function truncatePromptSnippet(text: string, maxLength: number) {
  const normalizedText = normalizePromptSnippet(text);
  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function trimWebSearchQueryParts(query: string) {
  const parts = query.split(/\s+/gu).filter(Boolean);
  if (parts.length <= WEB_SEARCH_QUERY_MAX_PARTS) {
    return query;
  }

  return parts.slice(0, WEB_SEARCH_QUERY_MAX_PARTS).join(' ');
}

function hasExplicitWebSearchIntent(input: string) {
  return WEB_SEARCH_EXPLICIT_INTENT_PATTERN.test(input)
    || /【\s*(?:查询|网页查询|搜索|联网查询)\s*[:：]?/u.test(input);
}

function hasExternalWebSearchIntent(input: string) {
  const looksLikeInformationRequest = WEB_SEARCH_INFORMATION_REQUEST_PATTERN.test(input);

  return looksLikeInformationRequest
    && (
      WEB_SEARCH_EXTERNAL_TOPIC_PATTERN.test(input)
      || (
        WEB_SEARCH_FRESHNESS_PATTERN.test(input)
        && WEB_SEARCH_REAL_WORLD_FACT_PATTERN.test(input)
      )
    );
}

export function shouldUseExternalWebSearch(
  input: string,
  browserSearchMode: BrowserSearchMode = 'allow',
  source: ExternalWebSearchSource = 'auto',
) {
  const normalizedInput = normalizePromptSnippet(input);
  if (!normalizedInput) {
    return false;
  }

  if (browserSearchMode === 'force') {
    return true;
  }

  if (source === 'tool') {
    return true;
  }

  return hasExplicitWebSearchIntent(normalizedInput) || hasExternalWebSearchIntent(normalizedInput);
}

export function buildWebSearchQuery(input: string) {
  const originalQuery = normalizePromptSnippet(input);
  if (!originalQuery) {
    return '';
  }

  const toolQueryMatch = originalQuery.match(/【\s*(?:查询|网页查询|搜索|联网查询)\s*[:：]?\s*([^】]{1,120})】/u);
  const quotedQueryMatch = originalQuery.match(/[“"「『《](.{2,80}?)[”"」』》]/u);
  const baseQuery = normalizePromptSnippet(
    toolQueryMatch?.[1]
    ?? (
      quotedQueryMatch
      && /搜索|搜|查询|查|检索|search|look\s*up|lookup|find|check/i.test(originalQuery)
        ? quotedQueryMatch[1]
        : originalQuery
    ),
  );

  let query = baseQuery
    .replace(/https?:\/\/\S+/giu, ' ')
    .replace(/[`~!@#$%^&*_+=|\\:;"'“”‘’<>,.?/，。！？、；：…（）()[\]{}【】《》]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

  for (const pattern of WEB_SEARCH_QUERY_FILLER_PATTERNS) {
    query = query.replace(pattern, ' ');
  }

  query = query
    .replace(/\s+/gu, ' ')
    .trim();

  const keywordParts = query
    .split(/\s+/gu)
    .map((part) => part.trim())
    .filter((part) => part && !WEB_SEARCH_QUERY_STOP_WORDS.has(part.toLowerCase()));

  query = trimWebSearchQueryParts(keywordParts.join(' ') || query || baseQuery || originalQuery);

  return truncatePromptSnippet(query || originalQuery, WEB_SEARCH_QUERY_MAX_LENGTH);
}

function getStringField(value: unknown, keys: string[]) {
  if (!value || typeof value !== 'object') {
    return '';
  }

  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const nextValue = record[key];
    if (typeof nextValue === 'string' && nextValue.trim()) {
      return nextValue.trim();
    }
  }

  return '';
}

function normalizeCustomWebSearchResults(payload: unknown): CustomWebSearchResult[] {
  if (typeof payload === 'string') {
    return payload.trim()
      ? [{ title: 'Search result', url: '', snippet: payload.trim() }]
      : [];
  }

  const nestedWebResults = payload && typeof payload === 'object'
    ? (payload as Record<string, unknown>).web
    : null;
  const rawItems = Array.isArray(payload)
    ? payload
    : getStringField(payload, ['text', 'content', 'answer'])
      ? [payload]
      : (payload && typeof payload === 'object'
        ? (
          (payload as Record<string, unknown>).results
          ?? (payload as Record<string, unknown>).items
          ?? (payload as Record<string, unknown>).data
          ?? (payload as Record<string, unknown>).organic
          ?? (nestedWebResults && typeof nestedWebResults === 'object'
            ? (nestedWebResults as Record<string, unknown>).results
            : null)
        )
        : null);

  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          title: `Search result ${index + 1}`,
          url: '',
          snippet: item.trim(),
        };
      }

      return {
        title: getStringField(item, ['title', 'name', 'headline']) || `Search result ${index + 1}`,
        url: getStringField(item, ['url', 'link', 'href']),
        snippet: getStringField(item, ['snippet', 'content', 'description', 'summary', 'text', 'body']),
      };
    })
    .filter((item) => item.title || item.url || item.snippet)
    .slice(0, 5);
}

function formatCustomWebSearchInstruction(results: CustomWebSearchResult[]) {
  if (results.length === 0) {
    return '';
  }

  return [
    'Web search results for reference:',
    'Use these results only when they are relevant. Do not invent sources. If the results are insufficient, say so naturally in character.',
    ...results.map((result, index) => [
      `${index + 1}. ${truncatePromptSnippet(result.title, 80)}`,
      result.url ? `   URL: ${truncatePromptSnippet(result.url, 160)}` : '',
      result.snippet ? `   Snippet: ${truncatePromptSnippet(result.snippet, 360)}` : '',
    ].filter(Boolean).join('\n')),
  ].join('\n');
}

async function fetchCustomWebSearchResults(query: string, settings: PetConfig['settings']) {
  const endpoint = settings.customWebSearchUrl.trim();
  if (!endpoint) {
    return '';
  }

  const queryParam = settings.customWebSearchQueryParam.trim() || 'q';
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
    ...(settings.customWebSearchApiKey.trim()
      ? { Authorization: `Bearer ${settings.customWebSearchApiKey.trim()}` }
      : {}),
  };
  const requestInit: RequestInit = {
    method: settings.customWebSearchMethod === 'post' ? 'POST' : 'GET',
    headers,
  };
  let requestUrl = endpoint;

  if (settings.customWebSearchMethod === 'post') {
    headers['Content-Type'] = 'application/json';
    requestInit.body = JSON.stringify({
      [queryParam]: query,
      query,
    });
  } else {
    const url = new URL(endpoint);
    url.searchParams.set(queryParam, query);
    requestUrl = url.toString();
  }

  const response = await fetch(requestUrl, requestInit);
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Custom search request failed (${response.status}): ${responseText || response.statusText}`);
  }

  let payload: unknown = responseText;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = responseText;
  }

  return formatCustomWebSearchInstruction(normalizeCustomWebSearchResults(payload));
}

async function fetchTavilyWebSearchResults(query: string, settings: PetConfig['settings']) {
  const apiKey = settings.tavilyApiKey.trim();
  if (!apiKey) {
    return '';
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: 'basic',
      include_answer: true,
      include_raw_content: false,
      max_results: 5,
    }),
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Tavily search request failed (${response.status}): ${responseText || response.statusText}`);
  }

  let payload: unknown = responseText;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = responseText;
  }

  const answer = getStringField(payload, ['answer']);
  const results = normalizeCustomWebSearchResults(payload);
  const instruction = formatCustomWebSearchInstruction(results);

  return [
    answer ? `Tavily answer summary:\n${truncatePromptSnippet(answer, 700)}` : '',
    instruction,
  ].filter(Boolean).join('\n\n');
}

async function fetchSerperWebSearchResults(query: string, settings: PetConfig['settings']) {
  const apiKey = settings.serperApiKey.trim();
  if (!apiKey) {
    return '';
  }

  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify({
      q: query,
      num: 5,
      gl: 'cn',
      hl: 'zh-cn',
    }),
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Serper search request failed (${response.status}): ${responseText || response.statusText}`);
  }

  let payload: unknown = responseText;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = responseText;
  }

  const answer = getStringField(
    payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>).answerBox
      : null,
    ['answer', 'snippet', 'title'],
  );

  return [
    answer ? `Serper answer summary:\n${truncatePromptSnippet(answer, 700)}` : '',
    formatCustomWebSearchInstruction(normalizeCustomWebSearchResults(payload)),
  ].filter(Boolean).join('\n\n');
}

async function fetchBraveWebSearchResults(query: string, settings: PetConfig['settings']) {
  const apiKey = settings.braveSearchApiKey.trim();
  if (!apiKey) {
    return '';
  }

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', '5');
  url.searchParams.set('country', 'CN');
  url.searchParams.set('search_lang', 'zh-hans');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey,
    },
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Brave search request failed (${response.status}): ${responseText || response.statusText}`);
  }

  let payload: unknown = responseText;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = responseText;
  }

  return formatCustomWebSearchInstruction(normalizeCustomWebSearchResults(payload));
}

function formatBrowserWebSearchInstruction(result: BrowserSearchResult) {
  if (!result.ok || !result.text) {
    return [
      'Web search status:',
      'The character tried to use the configured local browser search, but the browser query failed.',
      result.error ? `Error: ${truncatePromptSnippet(result.error, 240)}` : '',
    ].filter(Boolean).join('\n');
  }

  return [
    'Web search results from local browser for reference:',
    `Browser: ${result.browserLabel || 'local browser'}`,
    result.url ? `URL: ${truncatePromptSnippet(result.url, 180)}` : '',
    'Use this extracted page text only when relevant. Do not invent sources. If the extracted text is insufficient, say so naturally in character.',
    truncatePromptSnippet(result.text, 2600),
  ].filter(Boolean).join('\n');
}

async function fetchBrowserWebSearchResults(
  query: string,
  settings: PetConfig['settings'],
  browserSearchMode: BrowserSearchMode = 'allow',
) {
  desktopPetChatStore.setWebSearchStatusMessage(`正在调用浏览器查询：${truncatePromptSnippet(query, 28)}`);

  try {
    const result = await desktopPetShellRuntime.browserSearch({
      query,
      settings: {
        browserSearchBrowserPath: settings.browserSearchBrowserPath,
        browserSearchDebugPort: settings.browserSearchDebugPort,
        browserSearchEngine: settings.browserSearchEngine,
        browserSearchUrlTemplate: settings.browserSearchUrlTemplate,
        browserSearchForceOpenBrowser: browserSearchMode === 'force',
      },
    }) as BrowserSearchResult;

    if (result?.browserLabel) {
      desktopPetChatStore.setWebSearchStatusMessage(`正在调用 ${result.browserLabel} 查询：${truncatePromptSnippet(query, 28)}`);
    }

    return formatBrowserWebSearchInstruction(result ?? {});
  } finally {
    globalThis.setTimeout(() => {
      desktopPetChatStore.setWebSearchStatusMessage('');
    }, 600);
  }
}

export async function buildExternalWebSearchInstruction(
  userInput: string,
  _personality: PetPersonality,
  settings: PetConfig['settings'],
  browserSearchMode: BrowserSearchMode = 'allow',
  source: ExternalWebSearchSource = 'auto',
) {
  if (!settings.webSearchEnabled || settings.webSearchProvider === 'gemini') {
    return '';
  }

  if (!shouldUseExternalWebSearch(userInput, browserSearchMode, source)) {
    return '';
  }

  const searchQuery = buildWebSearchQuery(userInput);
  if (!searchQuery) {
    return '';
  }

  try {
    if (settings.webSearchProvider === 'browser') {
      if (browserSearchMode === 'block') {
        return [
          'Web search status:',
          'The local browser search was skipped because this message was sent with browser search disabled.',
        ].join('\n');
      }

      return await fetchBrowserWebSearchResults(searchQuery, settings, browserSearchMode);
    }

    if (settings.webSearchProvider === 'tavily') {
      return await fetchTavilyWebSearchResults(searchQuery, settings);
    }

    if (settings.webSearchProvider === 'serper') {
      return await fetchSerperWebSearchResults(searchQuery, settings);
    }

    if (settings.webSearchProvider === 'brave') {
      return await fetchBraveWebSearchResults(searchQuery, settings);
    }

    return await fetchCustomWebSearchResults(searchQuery, settings);
  } catch (error) {
    console.error('External web search error:', error);
    return [
      'Web search status:',
      'The character tried to use the configured web search endpoint, but the search request failed.',
      error instanceof Error ? `Error: ${truncatePromptSnippet(error.message, 240)}` : '',
    ].filter(Boolean).join('\n');
  }
}
