const fs = require('fs');
const path = require('path');
const { normalizeInputPath, normalizeAbsolutePath, clampInteger, getPathKind, isPathInside } = require('./localFileSystemInputUtils.cjs');
const { getSafeStat } = require('./localFileSystemDestinationUtils.cjs');
const {
  normalizeDesktopFileOrganizationGroupBy,
  getDefaultDesktopPath,
  getDesktopFileOrganizationRoot,
  getDesktopFileCategory,
  getDesktopFileGroup,
  sanitizeDesktopFileOrganizationFolderName,
  shouldSkipDesktopFileOrganizationEntry,
} = require('./localFileSystemDesktopOrganizationRules.cjs');

const MAX_DESKTOP_FILE_ORGANIZATION_ITEMS = 200;

function resolvePlanPaths(request) {
  const desktopPathInput = normalizeInputPath(
    request.desktopPath || request.sourcePath || request.source || request.path,
  );
  const desktopPath = desktopPathInput ? normalizeAbsolutePath(desktopPathInput) : {
    ok: true,
    path: getDefaultDesktopPath(),
  };
  if (!desktopPath.ok) {
    return { error: desktopPath.error, ok: false, path: desktopPath.path };
  }
  const desktopStat = getSafeStat(desktopPath.path);
  if (!desktopStat?.isDirectory()) {
    return {
      error: 'Desktop path must be an existing folder.',
      ok: false,
      path: desktopPath.path,
    };
  }
  const destinationRoot = getDesktopFileOrganizationRoot(request, desktopPath.path);
  if (!destinationRoot.ok) {
    return { error: destinationRoot.error, ok: false, path: destinationRoot.path };
  }
  return { desktopPath, destinationRoot };
}

function readPlanOptions(request) {
  const groupBy = normalizeDesktopFileOrganizationGroupBy(request.groupBy || request.group || request.grouping);
  const includeDirectories = Boolean(request.includeDirectories);
  const includeHidden = Boolean(request.includeHidden);
  const includeShortcuts = Boolean(request.includeShortcuts);
  const limit = clampInteger(request.limit, MAX_DESKTOP_FILE_ORGANIZATION_ITEMS, 1, MAX_DESKTOP_FILE_ORGANIZATION_ITEMS);
  return { groupBy, includeDirectories, includeHidden, includeShortcuts, limit };
}

function getEntrySkipReason(entry, sourcePath, paths, options, state) {
  if (
    path.resolve(sourcePath) === path.resolve(paths.destinationRoot.path)
    || isPathInside(sourcePath, paths.destinationRoot.path)
  ) {
    return 'already-in-destination-root';
  }
  const skipReason = shouldSkipDesktopFileOrganizationEntry(entry, {
    includeDirectories: options.includeDirectories,
    includeHidden: options.includeHidden,
    includeShortcuts: options.includeShortcuts,
  });
  if (skipReason) {
    return skipReason;
  }
  if (state.items.length >= options.limit) {
    state.truncated = true;
    return 'limit-reached';
  }
  return '';
}

function createPlannedItem(entry, sourcePath, paths, options, stat) {
  const extension = entry.isFile() ? path.extname(entry.name).toLowerCase() : '';
  const category = entry.isFile() ? getDesktopFileCategory(extension) : 'other';
  const kind = getPathKind(stat);
  const group = getDesktopFileGroup({ category, extension, kind }, options.groupBy);
  const folderName = options.groupBy === 'none' ? 'Files' : sanitizeDesktopFileOrganizationFolderName(group.label);
  const destinationDirectory = path.join(paths.destinationRoot.path, folderName);
  const destinationPath = path.join(destinationDirectory, entry.name);
  const destinationExists = Boolean(getSafeStat(destinationPath));
  const item = {
    category,
    destinationDirectory,
    destinationPath,
    extension,
    groupKey: group.key,
    groupLabel: group.label,
    kind,
    name: entry.name,
    sourcePath,
    sizeBytes: stat.isFile() ? stat.size : 0,
  };
  return { item, group, destinationExists };
}

function addPlannedItem(state, item, group, destinationExists) {
  state.items.push(item);
  if (destinationExists) {
    state.conflicts.push({
      destinationPath: item.destinationPath,
      name: item.name,
      sourcePath: item.sourcePath,
    });
  }
  const currentGroup = state.groups.get(group.key) || {
    count: 0,
    destinationDirectory: item.destinationDirectory,
    key: group.key,
    label: group.label,
    order: group.order,
  };
  currentGroup.count += 1;
  state.groups.set(group.key, currentGroup);
}

function collectPlanEntry(entry, paths, options, state) {
  const sourcePath = path.join(paths.desktopPath.path, entry.name);
  const skipReason = getEntrySkipReason(entry, sourcePath, paths, options, state);
  if (skipReason) {
    state.skipped.push({ name: entry.name, reason: skipReason, sourcePath });
    return;
  }
  const stat = getSafeStat(sourcePath);
  if (!stat) {
    state.skipped.push({ name: entry.name, reason: 'stat-failed', sourcePath });
    return;
  }
  const { item, group, destinationExists } = createPlannedItem(entry, sourcePath, paths, options, stat);
  addPlannedItem(state, item, group, destinationExists);
}

function projectPlanGroups(groups) {
  return [...groups.values()].sort((first, second) => (
    first.order - second.order
    || first.label.localeCompare(second.label, 'zh-Hans-CN', { numeric: true })
  )).map(({ order, ...group }) => group);
}

function createDesktopFileOrganizationPlan(request = {}) {
  const paths = resolvePlanPaths(request);
  if (paths.ok === false) {
    return paths;
  }
  const options = readPlanOptions(request);
  const entries = fs.readdirSync(paths.desktopPath.path, { withFileTypes: true })
    .sort((first, second) => first.name.localeCompare(second.name, 'zh-Hans-CN', { numeric: true }));
  const state = { items: [], skipped: [], conflicts: [], groups: new Map(), truncated: false };
  for (const entry of entries) {
    collectPlanEntry(entry, paths, options, state);
  }
  return {
    conflicts: state.conflicts,
    destinationRoot: paths.destinationRoot.path,
    desktopPath: paths.desktopPath.path,
    groupBy: options.groupBy,
    groups: projectPlanGroups(state.groups),
    items: state.items,
    ok: true,
    skipped: state.skipped,
    truncated: state.truncated,
  };
}

module.exports = { createDesktopFileOrganizationPlan };
