const { BROWSER_CATEGORY_QUERIES } = require('./appLauncherConstants.cjs');

function normalizeSearchText(value) {
  return String(value || '')
    .trim()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/\s+/g, '')
    .replace(/[()[\]{}【】（）「」『』"'“”‘’·._\-—:：，。,、]/g, '')
    .toLowerCase();
}

function scoreAppNameMatch(appName, query) {
  const normalizedName = normalizeSearchText(appName);
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedName || !normalizedQuery) {
    return 0;
  }

  if (normalizedName === normalizedQuery) {
    return 100;
  }

  if (normalizedName.startsWith(normalizedQuery)) {
    return 84;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return 72;
  }

  if (normalizedQuery.includes(normalizedName)) {
    return 44;
  }

  return 0;
}

function isBrowserCategoryQuery(query) {
  const normalizedQuery = normalizeSearchText(query);
  return BROWSER_CATEGORY_QUERIES
    .map(normalizeSearchText)
    .includes(normalizedQuery);
}

function uniquePaths(paths) {
  return Array.from(new Set(paths.filter((item) => item && typeof item === 'string')));
}

function uniqueCaseInsensitive(values) {
  const seenValues = new Set();
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seenValues.has(key)) {
        return false;
      }

      seenValues.add(key);
      return true;
    });
}

function normalizeAliasList(values) {
  const seenAliases = new Set();

  return (Array.isArray(values) ? values : [values])
    .flatMap((value) => String(value || '').split(/[,\n;；、]/u))
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = normalizeSearchText(value);
      if (!key || seenAliases.has(key)) {
        return false;
      }

      seenAliases.add(key);
      return true;
    });
}

function scoreRememberedAppMatch(appEntry, query) {
  const scores = [
    scoreAppNameMatch(appEntry.name, query),
    ...appEntry.aliases.map((alias) => scoreAppNameMatch(alias, query)),
  ];
  const normalizedQuery = normalizeSearchText(query);

  if (appEntry.aliases.some((alias) => normalizeSearchText(alias) === normalizedQuery)) {
    scores.push(120);
  }

  return Math.max(0, ...scores);
}

function scoreIndexedAppMatch(appEntry, query, options = {}) {
  const scores = [
    scoreAppNameMatch(appEntry.name, query),
    ...(Array.isArray(appEntry.aliases)
      ? appEntry.aliases.map((alias) => scoreAppNameMatch(alias, query))
      : []),
  ];

  if (appEntry.userDefined) {
    scores.push(scoreRememberedAppMatch(appEntry, query));
  }

  if (options.browserCategoryQuery && appEntry.category === 'browser') {
    scores.push(96);
  }

  return Math.max(0, ...scores);
}

function isLikelyAppContainerDirectory(name, query) {
  const normalizedName = normalizeSearchText(name);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedName) {
    return false;
  }

  return Boolean(
    normalizedQuery && (
      normalizedName.includes(normalizedQuery)
      || normalizedQuery.includes(normalizedName)
      || scoreAppNameMatch(name, query) >= 45
    ),
  ) || /^(?:program files|program files \(x86\)|games?|apps?|applications?|launchers?|tencent|riot games|steam|steamapps|steamlibrary|epic games|netease|mihoyo|hoyoplay|bilibili|wegame)$/iu.test(name);
}

module.exports = { normalizeSearchText, scoreAppNameMatch, isBrowserCategoryQuery, uniquePaths, uniqueCaseInsensitive, normalizeAliasList, scoreRememberedAppMatch, scoreIndexedAppMatch, isLikelyAppContainerDirectory };
