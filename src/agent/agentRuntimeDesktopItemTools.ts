import { desktopPetShellRuntime } from '../desktopShellRuntime';
import {
  type AgentChatCommandResult,
  type AgentDesktopOrganizationCommand,
  type AgentToolCallCommand,
} from './agentChatCommand';
import {
  findDesktopOrganizationTargetDisplay,
  getDesktopOrganizationDisplayLabel,
  isDesktopIconInsideDesktopOrganizationViewport,
  normalizeDesktopOrganizationDisplayRect,
} from './desktopOrganizationObservation';
import {
  classifyDesktopItem,
  createDesktopItemClassificationGroups,
  getDesktopItemGroupLabel,
  getDesktopItemGroupOrder,
  summarizeDesktopItemClassificationGroups,
  type DesktopItemClassification,
  type DesktopItemGroupBy,
} from './desktopItemClassification';
import { formatDisplayResolutionSummary } from './displayMetrics';

function getToolStringInput(toolCall: AgentToolCallCommand, keys: string[]) {
  const input = toolCall.input ?? {};
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function getToolNumberInput(toolCall: AgentToolCallCommand, key: string) {
  const value = toolCall.input?.[key];
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.trim())
      : NaN;

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function normalizeToolDisplayTargetValue(value: string): AgentDesktopOrganizationCommand['displayTarget'] | undefined {
  return value === 'primary' || value === 'secondary' || value === 'current' || value === 'all'
    ? value
    : undefined;
}

function getToolDisplayTargetInput(toolCall: AgentToolCallCommand): AgentDesktopOrganizationCommand['displayTarget'] | undefined {
  return normalizeToolDisplayTargetValue(getToolStringInput(toolCall, ['targetDisplay', 'displayTarget', 'display']));
}

function normalizeToolDesktopOrganizationScopeValue(value: string): AgentDesktopOrganizationCommand['scope'] | undefined {
  return value === 'all-icons' || value === 'display-icons'
    ? value
    : undefined;
}

function getToolDesktopOrganizationScopeInput(toolCall: AgentToolCallCommand): AgentDesktopOrganizationCommand['scope'] | undefined {
  return normalizeToolDesktopOrganizationScopeValue(getToolStringInput(toolCall, ['sourceScope', 'scope', 'iconScope']));
}

function normalizeDesktopItemObservationGroupBy(value: unknown): DesktopItemGroupBy {
  return value === 'none' || value === 'kind' || value === 'category' || value === 'extension'
    ? value
    : 'category';
}

function normalizeDesktopItemObservationExtension(value: string) {
  return value.trim().replace(/^\./u, '').toLowerCase();
}

function normalizeDesktopItemObservationText(value: string) {
  return value.trim().toLowerCase();
}

function normalizeDesktopItemObservationCategoryFilter(value: string) {
  const normalizedValue = normalizeDesktopItemObservationText(value).replace(/\s+/gu, '');
  const categoryByAlias: Record<string, string> = {
    app: 'app',
    application: 'app',
    archive: 'archive',
    archives: 'archive',
    code: 'code',
    document: 'document',
    documents: 'document',
    file: 'file',
    files: 'file',
    folder: 'folder',
    folders: 'folder',
    image: 'image',
    images: 'image',
    media: 'media',
    other: 'other',
    photo: 'image',
    photos: 'image',
    picture: 'image',
    pictures: 'image',
    shortcut: 'shortcut',
    shortcuts: 'shortcut',
    system: 'system',
    unknown: 'unknown',
    代码: 'code',
    其他: 'other',
    压缩包: 'archive',
    图像: 'image',
    图片: 'image',
    媒体: 'media',
    应用: 'app',
    快捷方式: 'shortcut',
    文件: 'file',
    文件夹: 'folder',
    文档: 'document',
    未识别: 'unknown',
    系统: 'system',
    系统图标: 'system',
    视频: 'media',
    音频: 'media',
  };

  return categoryByAlias[normalizedValue] ?? normalizedValue;
}

function normalizeDesktopItemObservationKindFilter(value: string) {
  const normalizedValue = normalizeDesktopItemObservationText(value).replace(/\s+/gu, '');
  const kindByAlias: Record<string, DesktopItemClassification['kind']> = {
    file: 'file',
    files: 'file',
    folder: 'folder',
    folders: 'folder',
    shortcut: 'shortcut',
    shortcuts: 'shortcut',
    system: 'system-icon',
    systemicon: 'system-icon',
    'system-icon': 'system-icon',
    unknown: 'unknown',
    快捷方式: 'shortcut',
    文件: 'file',
    文件夹: 'folder',
    未识别: 'unknown',
    系统: 'system-icon',
    系统图标: 'system-icon',
  };

  return kindByAlias[normalizedValue] ?? normalizedValue;
}

function getDesktopItemObservationClassificationLine(
  item: {
    classification: DesktopItemClassification;
    icon: DesktopPetDesktopIconLike;
  },
) {
  const { classification, icon } = item;
  const metadata = [
    classification.category,
    classification.kind,
    classification.extension ? `.${classification.extension}` : '',
    classification.confidence !== 'high' ? `confidence=${classification.confidence}` : '',
    icon.path ? 'path=yes' : '',
    icon.targetPath ? 'target=yes' : '',
  ].filter(Boolean).join(', ');

  return `${icon.name} [${metadata}] @ (${Math.round(icon.x)}, ${Math.round(icon.y)})`;
}

function summarizeDesktopIconSourceCounts(icons: DesktopPetDesktopIconLike[]) {
  const counts = new Map<string, number>();
  for (const icon of icons) {
    const source = icon.positionSource || 'shell-list-view';
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .map(([source, count]) => `${source}=${count}`)
    .join(', ');
}

export async function executeDiagnoseDesktopIcons(): Promise<AgentChatCommandResult> {
  if (!desktopPetShellRuntime.isDesktopMode()) {
    return {
      errorText: 'Desktop icon diagnostics require desktop mode.',
      ok: false,
      responseText: '桌面图标诊断需要在桌面版运行。',
    };
  }

  try {
    const [icons, displays] = await Promise.all([
      desktopPetShellRuntime.listDesktopIcons({
        coordinateSpace: 'native-screen',
        forceRefresh: true,
        includeFileSystemFallback: true,
        includeReadOnlyPositionFallback: true,
      }),
      desktopPetShellRuntime.listDisplays(),
    ]);
    const normalizedIcons = Array.isArray(icons) ? icons : [];
    const normalizedDisplays = Array.isArray(displays) ? displays : [];
    const usingFileSystemFallback = normalizedIcons.length > 0
      && normalizedIcons.every((icon) => icon.positionSource === 'filesystem-fallback');
    const hasScreenCoordinates = normalizedIcons.length > 0 && !usingFileSystemFallback;
    const movableCount = normalizedIcons.filter((icon) => icon.canMove !== false && icon.positionSource !== 'filesystem-fallback').length;
    const readOnlyPositionCount = normalizedIcons.filter((icon) => icon.canMove === false && icon.positionSource !== 'filesystem-fallback').length;
    const fileFallbackCount = normalizedIcons.filter((icon) => icon.positionSource === 'filesystem-fallback').length;
    const sourceSummary = summarizeDesktopIconSourceCounts(normalizedIcons) || 'none';
    const classifiedItems = normalizedIcons.map((icon) => classifyDesktopItem(icon));
    const groupSummary = summarizeDesktopItemClassificationGroups(
      createDesktopItemClassificationGroups(classifiedItems, 'category'),
    );
    const displayLines = normalizedDisplays.map((display, index) => {
      const viewport = normalizeDesktopOrganizationDisplayRect(display);
      const displayIconCount = hasScreenCoordinates
        ? normalizedIcons.filter((icon) => isDesktopIconInsideDesktopOrganizationViewport(icon, viewport)).length
        : null;
      const label = getDesktopOrganizationDisplayLabel(display, index);
      return [
        `${index + 1}. ${label}`,
        display.isPrimary ? 'primary' : 'secondary',
        formatDisplayResolutionSummary(display),
        `viewport=(${viewport.x},${viewport.y}) ${viewport.width}x${viewport.height}`,
        displayIconCount === null ? 'icons=unknown' : `icons=${displayIconCount}`,
      ].join('; ');
    });
    const observations = [
      `Desktop icon diagnostics total icons: ${normalizedIcons.length}`,
      `Desktop icon diagnostics sources: ${sourceSummary}`,
      `Desktop icon diagnostics movable icons: ${movableCount}`,
      `Desktop icon diagnostics read-only positioned icons: ${readOnlyPositionCount}`,
      `Desktop icon diagnostics filesystem fallback icons: ${fileFallbackCount}`,
      `Desktop icon diagnostics native-screen coordinates available: ${hasScreenCoordinates ? 'yes' : 'no'}`,
      groupSummary ? `Desktop icon diagnostics category groups: ${groupSummary}` : '',
      `Desktop icon diagnostics display count: ${normalizedDisplays.length}`,
      ...displayLines.map((line) => `Desktop icon diagnostics display: ${line}`),
    ].filter(Boolean);
    const responseLines = [
      `桌面图标诊断：读取到 ${normalizedIcons.length} 个项目。`,
      `来源：${sourceSummary}。`,
      `可移动坐标：${movableCount} 个；只读坐标：${readOnlyPositionCount} 个；文件夹兜底：${fileFallbackCount} 个。`,
      hasScreenCoordinates
        ? `屏幕归属可判断：${displayLines.join(' / ') || '没有显示器明细'}。`
        : '屏幕归属不可判断：当前只读到了桌面文件夹项目，没有读到屏幕上的图标坐标。',
      groupSummary ? `分类：${groupSummary}。` : '',
    ].filter(Boolean);

    return {
      observations,
      ok: true,
      responseText: responseLines.join('\n'),
      verification: hasScreenCoordinates
        ? `Desktop icon diagnostics found ${movableCount} movable icon coordinate(s).`
        : `Desktop icon diagnostics found ${fileFallbackCount} desktop file fallback item(s), but no native-screen coordinates.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      errorText: message,
      observations: [`Desktop icon diagnostics failed: ${message}`],
      ok: false,
      responseText: `桌面图标诊断失败：${message}`,
      verification: message,
    };
  }
}

export async function executeListDesktopItems(toolCall: AgentToolCallCommand): Promise<AgentChatCommandResult> {
  if (!desktopPetShellRuntime.isDesktopMode()) {
    return {
      errorText: 'Desktop item observation requires desktop mode.',
      ok: false,
      responseText: '桌面物品观察需要在桌面版运行。',
    };
  }

  const displayTarget = getToolDisplayTargetInput(toolCall);
  const scope = getToolDesktopOrganizationScopeInput(toolCall);
  const groupBy = normalizeDesktopItemObservationGroupBy(
    getToolStringInput(toolCall, ['groupBy', 'group', 'grouping', 'groupStrategy']) || undefined,
  );
  const query = getToolStringInput(toolCall, ['query', 'target', 'name', 'fileName', 'pattern']);
  const categoryFilter = normalizeDesktopItemObservationCategoryFilter(
    getToolStringInput(toolCall, ['category', 'itemCategory']),
  );
  const kindFilter = normalizeDesktopItemObservationKindFilter(
    getToolStringInput(toolCall, ['kind', 'itemKind']),
  );
  const extensionFilter = normalizeDesktopItemObservationExtension(
    getToolStringInput(toolCall, ['extension', 'fileExtension', 'suffix']),
  );
  const limit = Math.max(1, Math.min(50, Math.round(getToolNumberInput(toolCall, 'limit') ?? 16)));

  try {
    const [icons, displays] = await Promise.all([
      desktopPetShellRuntime.listDesktopIcons({
        coordinateSpace: 'native-screen',
        forceRefresh: true,
        includeFileSystemFallback: true,
        includeReadOnlyPositionFallback: true,
      }),
      desktopPetShellRuntime.listDisplays(),
    ]);
    const normalizedIcons = Array.isArray(icons) ? icons : [];
    const usingFileSystemFallback = normalizedIcons.length > 0
      && normalizedIcons.every((icon) => icon.positionSource === 'filesystem-fallback');
    const usingReadOnlyPositionFallback = normalizedIcons.length > 0
      && !usingFileSystemFallback
      && normalizedIcons.every((icon) => icon.canMove === false);
    const positionSources = Array.from(new Set(
      normalizedIcons.map((icon) => icon.positionSource || 'shell-list-view'),
    )).join(', ') || 'none';
    const normalizedDisplays = Array.isArray(displays) ? displays : [];
    const targetDisplay = findDesktopOrganizationTargetDisplay(normalizedDisplays, displayTarget);

    if (displayTarget === 'secondary' && !targetDisplay) {
      return {
        errorText: 'No secondary display was detected.',
        observations: [
          `Desktop item display target: ${displayTarget}`,
          `Desktop display count: ${normalizedDisplays.length}`,
        ],
        ok: false,
        responseText: '没有检测到可用的副屏，所以无法只观察副屏桌面物品。',
      };
    }

    const targetDisplayIndex = targetDisplay
      ? normalizedDisplays.findIndex((display) => String(display.id) === String(targetDisplay.id))
      : -1;
    const targetDisplayLabel = targetDisplay
      ? getDesktopOrganizationDisplayLabel(targetDisplay, targetDisplayIndex)
      : 'desktop';
    const targetViewport = targetDisplay ? normalizeDesktopOrganizationDisplayRect(targetDisplay) : null;
    const scopedIcons = !usingFileSystemFallback && targetViewport && scope !== 'all-icons'
        ? normalizedIcons.filter((icon) => isDesktopIconInsideDesktopOrganizationViewport(icon, targetViewport))
        : normalizedIcons;

    const classifiedItems = scopedIcons
      .map((icon) => ({
        classification: classifyDesktopItem(icon),
        icon,
      }))
      .filter((item) => {
        const normalizedName = normalizeDesktopItemObservationText(item.icon.name);
        const normalizedQuery = normalizeDesktopItemObservationText(query);
        if (normalizedQuery && !normalizedName.includes(normalizedQuery)) {
          return false;
        }

        if (
          categoryFilter
          && (
            categoryFilter === 'file'
              ? item.classification.kind !== 'file'
              : item.classification.category !== categoryFilter
          )
        ) {
          return false;
        }

        if (kindFilter && item.classification.kind !== kindFilter) {
          return false;
        }

        if (extensionFilter && item.classification.extension !== extensionFilter) {
          return false;
        }

        return true;
      })
      .sort((first, second) => (
        getDesktopItemGroupOrder(first.classification, groupBy) - getDesktopItemGroupOrder(second.classification, groupBy)
        || getDesktopItemGroupLabel(first.classification, groupBy)
          .localeCompare(getDesktopItemGroupLabel(second.classification, groupBy), 'zh-CN')
        || first.icon.name.localeCompare(second.icon.name, 'zh-CN')
        || first.icon.index - second.icon.index
      ));
    const groups = createDesktopItemClassificationGroups(
      classifiedItems.map((item) => item.classification),
      groupBy,
    );
    const visibleItems = classifiedItems.slice(0, limit);
    const groupSummary = summarizeDesktopItemClassificationGroups(groups);
    const observations = [
      `Desktop item observation total icons: ${normalizedIcons.length}`,
      `Desktop item observation scoped icons: ${scopedIcons.length}`,
      `Desktop item observation matched icons: ${classifiedItems.length}`,
      `Desktop item observation display target: ${targetDisplayLabel}`,
      `Desktop item observation groupBy: ${groupBy}`,
      usingFileSystemFallback
        ? 'Desktop item observation position source: filesystem-fallback; native-screen coordinates and display ownership are unavailable.'
        : usingReadOnlyPositionFallback
          ? `Desktop item observation position source: ${positionSources}; native-screen coordinates are available, but direct icon movement is unavailable.`
          : `Desktop item observation position source: ${positionSources}`,
      query ? `Desktop item observation query: ${query}` : '',
      categoryFilter ? `Desktop item category filter: ${categoryFilter}` : '',
      kindFilter ? `Desktop item kind filter: ${kindFilter}` : '',
      extensionFilter ? `Desktop item extension filter: .${extensionFilter}` : '',
      groupSummary ? `Desktop item groups: ${groupSummary}` : '',
      ...visibleItems.map(getDesktopItemObservationClassificationLine),
    ].filter(Boolean);
    const responseLines = [
      usingReadOnlyPositionFallback
        ? 'Read-only position fallback: visible desktop icon coordinates were observed, but the current mover still needs movable Explorer ListView indexes before changing positions.'
        : '',
      `观察到 ${classifiedItems.length}/${scopedIcons.length} 个匹配的桌面物品。`,
      usingFileSystemFallback
        ? '只读降级：读取到了桌面文件夹里的项目，但没有读取到屏幕上的图标坐标，所以不能判断它们属于主屏还是副屏，也不能直接移动图标位置。'
        : '',
      groupSummary ? `分组：${groupSummary}` : '',
      visibleItems.length ? `样例：\n${visibleItems.map(getDesktopItemObservationClassificationLine).join('\n')}` : '没有匹配的桌面物品。',
      classifiedItems.length > visibleItems.length ? `还有 ${classifiedItems.length - visibleItems.length} 个未展开显示。` : '',
    ].filter(Boolean);

    return {
      observations,
      ok: true,
      responseText: responseLines.join('\n'),
      verification: `Observed ${classifiedItems.length} desktop item(s) with groupBy=${groupBy}.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      errorText: message,
      observations: [`Desktop item observation failed: ${message}`],
      ok: false,
      responseText: `桌面物品观察失败：${message}`,
      verification: message,
    };
  }
}
