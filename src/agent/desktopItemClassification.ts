export type DesktopItemGroupBy = 'none' | 'kind' | 'category' | 'extension';

export type DesktopItemKind = 'file' | 'folder' | 'shortcut' | 'system-icon' | 'unknown';

export type DesktopItemCategory =
  | 'app'
  | 'archive'
  | 'code'
  | 'document'
  | 'folder'
  | 'image'
  | 'media'
  | 'other'
  | 'shortcut'
  | 'system'
  | 'unknown';

export type DesktopItemClassificationConfidence = 'high' | 'medium' | 'low';

export interface DesktopItemClassification {
  category: DesktopItemCategory;
  confidence: DesktopItemClassificationConfidence;
  evidence: string[];
  extension?: string;
  groupKey: string;
  groupLabel: string;
  iconId: string;
  iconName: string;
  kind: DesktopItemKind;
}

export interface DesktopItemClassificationGroup {
  category?: DesktopItemCategory;
  count: number;
  key: string;
  kind?: DesktopItemKind;
  label: string;
}

const IMAGE_EXTENSIONS = new Set([
  'ai',
  'avif',
  'bmp',
  'gif',
  'heic',
  'heif',
  'ico',
  'jpeg',
  'jpg',
  'png',
  'psd',
  'svg',
  'tif',
  'tiff',
  'webp',
]);

const DOCUMENT_EXTENSIONS = new Set([
  'csv',
  'doc',
  'docx',
  'epub',
  'key',
  'log',
  'md',
  'numbers',
  'odp',
  'ods',
  'odt',
  'pages',
  'pdf',
  'ppt',
  'pptx',
  'rtf',
  'tex',
  'txt',
  'xls',
  'xlsx',
]);

const ARCHIVE_EXTENSIONS = new Set([
  '7z',
  'bz2',
  'gz',
  'iso',
  'rar',
  'tar',
  'tgz',
  'xz',
  'zip',
]);

const MEDIA_EXTENSIONS = new Set([
  'aac',
  'avi',
  'flac',
  'm4a',
  'm4v',
  'mkv',
  'mov',
  'mp3',
  'mp4',
  'mpeg',
  'mpg',
  'ogg',
  'wav',
  'webm',
  'wmv',
]);

const CODE_EXTENSIONS = new Set([
  'c',
  'cc',
  'cpp',
  'cs',
  'css',
  'go',
  'h',
  'hpp',
  'html',
  'java',
  'js',
  'json',
  'jsx',
  'kt',
  'lua',
  'php',
  'ps1',
  'py',
  'rs',
  'scss',
  'sh',
  'sql',
  'ts',
  'tsx',
  'vue',
  'xml',
  'yaml',
  'yml',
]);

const APP_EXTENSIONS = new Set([
  'appref-ms',
  'bat',
  'cmd',
  'com',
  'exe',
  'lnk',
  'msi',
  'url',
]);

const SHORTCUT_EXTENSIONS = new Set(['appref-ms', 'lnk', 'url']);

const SYSTEM_ICON_NAMES = new Set([
  'control panel',
  'network',
  'recycle bin',
  'this pc',
  '控制面板',
  '回收站',
  '网络',
  '此电脑',
  '我的电脑',
]);

const CATEGORY_LABELS: Record<DesktopItemCategory, string> = {
  app: '应用',
  archive: '压缩包',
  code: '代码',
  document: '文档',
  folder: '文件夹',
  image: '图片',
  media: '媒体',
  other: '其他文件',
  shortcut: '快捷方式',
  system: '系统图标',
  unknown: '未识别',
};

const KIND_LABELS: Record<DesktopItemKind, string> = {
  file: '文件',
  folder: '文件夹',
  shortcut: '快捷方式',
  'system-icon': '系统图标',
  unknown: '未识别',
};

const CATEGORY_ORDER: Record<DesktopItemCategory, number> = {
  folder: 0,
  system: 1,
  image: 2,
  document: 3,
  code: 4,
  media: 5,
  archive: 6,
  app: 7,
  shortcut: 8,
  other: 9,
  unknown: 10,
};

const KIND_ORDER: Record<DesktopItemKind, number> = {
  folder: 0,
  'system-icon': 1,
  file: 2,
  shortcut: 3,
  unknown: 4,
};

function getIconMetadata(icon: DesktopPetDesktopIconLike) {
  return icon as DesktopPetDesktopIconLike & {
    extension?: unknown;
    filePath?: unknown;
    isDirectory?: unknown;
    isFile?: unknown;
    isShortcut?: unknown;
    isSystemIcon?: unknown;
    itemKind?: unknown;
    path?: unknown;
    targetPath?: unknown;
  };
}

function normalizeMetadataString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeExtension(value: unknown) {
  const text = normalizeMetadataString(value)
    .replace(/^\./u, '')
    .trim()
    .toLowerCase();

  return /^[a-z0-9][a-z0-9-]{0,15}$/u.test(text) ? text : '';
}

function extractExtensionFromText(value: string) {
  const trimmed = value.trim();
  const match = /\.([a-z0-9][a-z0-9-]{0,15})$/iu.exec(trimmed);
  return normalizeExtension(match?.[1]);
}

function extractDesktopItemExtension(icon: DesktopPetDesktopIconLike) {
  const metadata = getIconMetadata(icon);
  return normalizeExtension(metadata.extension)
    || extractExtensionFromText(normalizeMetadataString(metadata.path))
    || extractExtensionFromText(normalizeMetadataString(metadata.filePath))
    || extractExtensionFromText(normalizeMetadataString(metadata.targetPath))
    || extractExtensionFromText(icon.name);
}

function normalizeSystemName(value: string) {
  return value.trim().replace(/\s+/gu, ' ').toLowerCase();
}

function isSystemDesktopIcon(icon: DesktopPetDesktopIconLike) {
  const metadata = getIconMetadata(icon);
  if (metadata.isSystemIcon === true) {
    return true;
  }

  return SYSTEM_ICON_NAMES.has(normalizeSystemName(icon.name));
}

function resolveCategoryFromExtension(extension: string): DesktopItemCategory {
  if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image';
  }
  if (DOCUMENT_EXTENSIONS.has(extension)) {
    return 'document';
  }
  if (ARCHIVE_EXTENSIONS.has(extension)) {
    return 'archive';
  }
  if (MEDIA_EXTENSIONS.has(extension)) {
    return 'media';
  }
  if (CODE_EXTENSIONS.has(extension)) {
    return 'code';
  }
  if (SHORTCUT_EXTENSIONS.has(extension)) {
    return 'shortcut';
  }
  if (APP_EXTENSIONS.has(extension)) {
    return 'app';
  }

  return 'other';
}

function createClassification(options: {
  category: DesktopItemCategory;
  confidence: DesktopItemClassificationConfidence;
  evidence: string[];
  extension?: string;
  icon: DesktopPetDesktopIconLike;
  kind: DesktopItemKind;
}): DesktopItemClassification {
  return {
    category: options.category,
    confidence: options.confidence,
    evidence: options.evidence,
    extension: options.extension,
    groupKey: options.category,
    groupLabel: CATEGORY_LABELS[options.category],
    iconId: options.icon.id,
    iconName: options.icon.name,
    kind: options.kind,
  };
}

export function classifyDesktopItem(icon: DesktopPetDesktopIconLike): DesktopItemClassification {
  const metadata = getIconMetadata(icon);
  const extension = extractDesktopItemExtension(icon);

  if (isSystemDesktopIcon(icon)) {
    return createClassification({
      category: 'system',
      confidence: 'high',
      evidence: ['system-icon-name'],
      extension: extension || undefined,
      icon,
      kind: 'system-icon',
    });
  }

  if (metadata.isDirectory === true || metadata.itemKind === 'folder') {
    return createClassification({
      category: 'folder',
      confidence: 'high',
      evidence: ['desktop-metadata-folder'],
      extension: extension || undefined,
      icon,
      kind: 'folder',
    });
  }

  if (metadata.isShortcut === true) {
    return createClassification({
      category: extension ? resolveCategoryFromExtension(extension) : 'shortcut',
      confidence: 'high',
      evidence: ['desktop-metadata-shortcut'],
      extension: extension || undefined,
      icon,
      kind: 'shortcut',
    });
  }

  if (extension) {
    const category = resolveCategoryFromExtension(extension);
    return createClassification({
      category,
      confidence: category === 'other' ? 'medium' : 'high',
      evidence: [`extension:${extension}`],
      extension,
      icon,
      kind: SHORTCUT_EXTENSIONS.has(extension) ? 'shortcut' : 'file',
    });
  }

  return createClassification({
    category: 'unknown',
    confidence: 'low',
    evidence: ['name-only-no-extension'],
    icon,
    kind: 'unknown',
  });
}

export function getDesktopItemGroupKey(
  classification: DesktopItemClassification,
  groupBy: DesktopItemGroupBy,
) {
  if (groupBy === 'kind') {
    return classification.kind;
  }

  if (groupBy === 'extension') {
    return classification.extension ? `.${classification.extension}` : 'no-extension';
  }

  return classification.category;
}

export function getDesktopItemGroupLabel(
  classification: DesktopItemClassification,
  groupBy: DesktopItemGroupBy,
) {
  if (groupBy === 'kind') {
    return KIND_LABELS[classification.kind];
  }

  if (groupBy === 'extension') {
    return classification.extension ? `.${classification.extension}` : '无扩展名';
  }

  return CATEGORY_LABELS[classification.category];
}

export function getDesktopItemGroupOrder(
  classification: DesktopItemClassification,
  groupBy: DesktopItemGroupBy,
) {
  if (groupBy === 'kind') {
    return KIND_ORDER[classification.kind] ?? 99;
  }

  if (groupBy === 'extension') {
    return classification.extension ? 0 : 1;
  }

  return CATEGORY_ORDER[classification.category] ?? 99;
}

export function createDesktopItemClassificationGroups(
  classifications: DesktopItemClassification[],
  groupBy: DesktopItemGroupBy,
): DesktopItemClassificationGroup[] {
  const groups = new Map<string, DesktopItemClassificationGroup>();

  for (const classification of classifications) {
    const key = getDesktopItemGroupKey(classification, groupBy);
    const group = groups.get(key);
    if (group) {
      group.count += 1;
      continue;
    }

    groups.set(key, {
      category: classification.category,
      count: 1,
      key,
      kind: classification.kind,
      label: getDesktopItemGroupLabel(classification, groupBy),
    });
  }

  return Array.from(groups.values()).sort((first, second) => {
    const firstClassification = classifications.find((item) => getDesktopItemGroupKey(item, groupBy) === first.key);
    const secondClassification = classifications.find((item) => getDesktopItemGroupKey(item, groupBy) === second.key);
    const firstOrder = firstClassification ? getDesktopItemGroupOrder(firstClassification, groupBy) : 99;
    const secondOrder = secondClassification ? getDesktopItemGroupOrder(secondClassification, groupBy) : 99;
    return firstOrder - secondOrder || first.label.localeCompare(second.label, 'zh-CN');
  });
}

export function summarizeDesktopItemClassificationGroups(
  groups: DesktopItemClassificationGroup[],
  limit = 6,
) {
  const visibleGroups = groups.slice(0, limit);
  const text = visibleGroups.map((group) => `${group.label} ${group.count} 个`).join('、');
  return `${text}${groups.length > visibleGroups.length ? ` 等 ${groups.length} 类` : ''}`;
}
