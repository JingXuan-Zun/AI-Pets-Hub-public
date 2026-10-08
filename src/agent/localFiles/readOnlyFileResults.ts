import { type AgentChatCommandResult } from '../agentChatCommand';
import { createLocalFileReceipt } from './fileManagementTools';

function formatLocalFileKind(kind: unknown) {
  if (kind === 'directory') {
    return '目录';
  }

  if (kind === 'file') {
    return '文件';
  }

  if (kind === 'missing') {
    return '不存在';
  }

  if (kind === 'symlink') {
    return '符号链接';
  }

  if (kind === 'other') {
    return '其他';
  }

  return '未知';
}

function formatFileByteSize(bytes: unknown) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) {
    return '未知';
  }

  if (value < 1024) {
    return `${value} B`;
  }

  const kib = value / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(kib >= 10 ? 1 : 2)} KB`;
  }

  const mib = kib / 1024;
  if (mib < 1024) {
    return `${mib.toFixed(mib >= 10 ? 1 : 2)} MB`;
  }

  const gib = mib / 1024;
  return `${gib.toFixed(gib >= 10 ? 1 : 2)} GB`;
}

function formatLocalFileEntryLine(entry: DesktopPetLocalFileEntryLike, index: number) {
  const sizeText = entry.kind === 'file' ? `，${formatFileByteSize(entry.sizeBytes)}` : '';
  return `${index + 1}. [${formatLocalFileKind(entry.kind)}] ${entry.name}${sizeText} -> ${entry.path}`;
}

function compactTextFileSnippet(text: string, maxLength = 4000) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n...（内容过长，已截断显示）`;
}

export function createLocalPathInfoResult(localPath: string, result: DesktopPetPathInfoResultLike): AgentChatCommandResult {
  const exists = Boolean(result?.exists);
  const kindText = formatLocalFileKind(result?.kind);
  const pathText = result?.path || localPath;
  const observations = [
    `Path: ${pathText}`,
    `Exists: ${exists}`,
    `Kind: ${result?.kind ?? 'unknown'}`,
    result?.dirname ? `Dirname: ${result.dirname}` : '',
    result?.basename ? `Basename: ${result.basename}` : '',
    typeof result?.sizeBytes === 'number' ? `Size: ${result.sizeBytes} bytes` : '',
    result?.error ? `Error: ${result.error}` : '',
  ].filter(Boolean);

  if (result && !result.error && (result.ok || result.exists === false || result.kind === 'missing')) {
    const verification = exists
      ? `已确认路径存在，类型为${kindText}。`
      : '已确认该路径当前不存在。';
    return {
      observations,
      ok: true,
      receipt: createLocalFileReceipt({
        evidenceLines: observations,
        status: 'success',
        summaryLines: [
          '调用：get_path_info',
          `路径：${pathText}`,
          `类型：${kindText}`,
        ],
        toolName: 'get_path_info',
        verification,
      }),
      responseText: exists
        ? `路径存在：${pathText}\n类型：${kindText}${result.kind === 'file' ? `\n大小：${formatFileByteSize(result.sizeBytes)}` : ''}`
        : `路径不存在：${pathText}`,
      verification,
    };
  }

  return {
    errorText: result?.error || '路径信息读取失败。',
    observations,
    ok: false,
    receipt: createLocalFileReceipt({
      evidenceLines: observations,
      status: 'failed',
      summaryLines: [
        '调用：get_path_info',
        `路径：${pathText}`,
        `结果：${result?.error || '失败'}`,
      ],
      toolName: 'get_path_info',
      verification: result?.error ?? null,
    }),
    responseText: `没有成功读取路径信息：${result?.error || pathText}。`,
    verification: result?.error ?? null,
  };

}

export function createLocalDirectoryListResult(localPath: string, result: DesktopPetDirectoryListResultLike): AgentChatCommandResult {
  const entries = Array.isArray(result?.entries) ? result.entries : [];
  const visibleEntries = entries.slice(0, 30);
  const entryLines = visibleEntries.map(formatLocalFileEntryLine);
  const observations = [
    `Directory path: ${result?.path || localPath}`,
    `Entry count returned: ${entries.length}`,
    typeof result?.totalEntryCount === 'number' ? `Total entry count: ${result.totalEntryCount}` : '',
    result?.truncated ? 'Result was truncated by list limit.' : '',
    result?.error ? `Error: ${result.error}` : '',
    ...entryLines,
  ].filter(Boolean);

  if (result?.ok) {
    const totalText = typeof result.totalEntryCount === 'number'
      ? `${result.totalEntryCount} 项`
      : `${entries.length} 项`;
    const responseLines = entryLines.length
      ? entryLines
      : ['这个目录当前没有可显示的条目。'];
    const verification = `已只读列出目录：${result.path || localPath}，返回 ${entries.length} 项。`;

    return {
      observations,
      ok: true,
      receipt: createLocalFileReceipt({
        evidenceLines: observations.slice(0, 40),
        status: 'success',
        summaryLines: [
          '调用：list_directory',
          `目录：${result.path || localPath}`,
          `条目：${totalText}`,
        ],
        toolName: 'list_directory',
        verification,
      }),
      responseText: [
        `目录：${result.path || localPath}`,
        `共 ${totalText}${result.truncated ? `，本次显示前 ${entries.length} 项` : ''}：`,
        ...responseLines,
      ].join('\n'),
      verification,
    };
  }

  return {
    errorText: result?.error || '目录读取失败。',
    observations,
    ok: false,
    receipt: createLocalFileReceipt({
      evidenceLines: observations,
      status: 'failed',
      summaryLines: [
        '调用：list_directory',
        `目录：${result?.path || localPath}`,
        `结果：${result?.error || '失败'}`,
      ],
      toolName: 'list_directory',
      verification: result?.error ?? null,
    }),
    responseText: `没有成功列出目录：${result?.error || result?.path || localPath}。`,
    verification: result?.error ?? null,
  };

}

export function createLocalFileSearchResult(localPath: string, query: string, result: DesktopPetFileSearchResultLike): AgentChatCommandResult {
  const matches = Array.isArray(result?.matches) ? result.matches : [];
  const visibleMatches = matches.slice(0, 30);
  const matchLines = visibleMatches.map(formatLocalFileEntryLine);
  const observations = [
    `Search root: ${result?.path || localPath}`,
    `Search query: ${result?.query || query}`,
    `Match count returned: ${matches.length}`,
    typeof result?.visitedDirectoryCount === 'number' ? `Visited directories: ${result.visitedDirectoryCount}` : '',
    typeof result?.visitedFileCount === 'number' ? `Visited files: ${result.visitedFileCount}` : '',
    result?.truncated ? 'Result was truncated by search limit.' : '',
    result?.error ? `Error: ${result.error}` : '',
    ...matchLines,
  ].filter(Boolean);

  if (result?.ok) {
    const verification = `已只读搜索文件名：${result.path || localPath}，匹配 ${matches.length} 项。`;
    return {
      observations,
      ok: true,
      receipt: createLocalFileReceipt({
        evidenceLines: observations.slice(0, 40),
        status: 'success',
        summaryLines: [
          '调用：search_files',
          `目录：${result.path || localPath}`,
          `关键词：${result.query || query}`,
          `匹配：${matches.length} 项`,
        ],
        toolName: 'search_files',
        verification,
      }),
      responseText: matches.length
        ? [
            `在 ${result.path || localPath} 中按文件名搜索「${result.query || query}」，找到 ${matches.length} 项${result.truncated ? '（结果已截断）' : ''}：`,
            ...matchLines,
          ].join('\n')
        : `在 ${result.path || localPath} 中没有找到文件名包含「${result.query || query}」的文件。`,
      verification,
    };
  }

  return {
    errorText: result?.error || '文件搜索失败。',
    observations,
    ok: false,
    receipt: createLocalFileReceipt({
      evidenceLines: observations,
      status: 'failed',
      summaryLines: [
        '调用：search_files',
        `目录：${result?.path || localPath}`,
        `关键词：${query}`,
        `结果：${result?.error || '失败'}`,
      ],
      toolName: 'search_files',
      verification: result?.error ?? null,
    }),
    responseText: `没有成功搜索文件：${result?.error || result?.path || localPath}。`,
    verification: result?.error ?? null,
  };

}

export function createLocalTextReadResult(localPath: string, result: DesktopPetTextFileReadResultLike): AgentChatCommandResult {
  const pathText = result?.path || localPath;
  const text = typeof result?.text === 'string' ? result.text : '';
  const snippet = compactTextFileSnippet(text);
  const observations = [
    `Text file path: ${pathText}`,
    typeof result?.sizeBytes === 'number' ? `Size: ${result.sizeBytes} bytes` : '',
    result?.encoding ? `Encoding: ${result.encoding}` : '',
    result?.extension ? `Extension: ${result.extension}` : '',
    result?.truncated ? 'Runtime read was truncated by byte cap.' : '',
    result?.error ? `Error: ${result.error}` : '',
    result?.ok ? `Text snippet: ${compactTextFileSnippet(text, 1200)}` : '',
  ].filter(Boolean);

  if (result?.ok) {
    const verification = `已只读读取文本文件：${pathText}，返回 ${text.length} 个字符。`;
    return {
      observations,
      ok: true,
      receipt: createLocalFileReceipt({
        evidenceLines: [
          `路径：${pathText}`,
          `大小：${formatFileByteSize(result.sizeBytes)}`,
          result.truncated ? '读取结果已按字节上限截断。' : '读取结果未按字节上限截断。',
        ],
        status: 'success',
        summaryLines: [
          '调用：read_text_file',
          `文件：${pathText}`,
          `字符：${text.length}`,
        ],
        toolName: 'read_text_file',
        verification,
      }),
      responseText: [
        `已读取文本文件：${pathText}`,
        `大小：${formatFileByteSize(result.sizeBytes)}${result.truncated ? '，内容已截断' : ''}`,
        '内容：',
        snippet,
      ].join('\n'),
      verification,
    };
  }

  return {
    errorText: result?.error || '文本文件读取失败。',
    observations,
    ok: false,
    receipt: createLocalFileReceipt({
      evidenceLines: observations,
      status: 'failed',
      summaryLines: [
        '调用：read_text_file',
        `文件：${pathText}`,
        `结果：${result?.error || '失败'}`,
      ],
      toolName: 'read_text_file',
      verification: result?.error ?? null,
    }),
    responseText: `没有成功读取文本文件：${result?.error || pathText}。`,
    verification: result?.error ?? null,
  };

}
