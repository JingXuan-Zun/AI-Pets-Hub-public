// “用你的浏览器查”: she has her own browser (the app's browser profile, also used by the
// chrome-devtools plugin). In long instructions she still reached for web_search although its
// description says not to (benchmark 2026-11-06), so the search itself sends her back.
export const HER_BROWSER_REQUEST = /(?:用|在|拿|通过)(?:你|她)(?:自己)?的浏览器|(?:你|她)的浏览器(?:里|上)|自己的浏览器|打开网页(?:看|查|去)/u;
