import { unzipSync } from 'fflate';
import { parseAgentExternalSkillImport, type AgentExternalSkillDefinition } from './agentExternalSkillLibrary';

const MAX_FILE_BYTES = 64 * 1024;
export const MAX_AGENT_SKILL_ARCHIVE_BYTES = 200 * 1024 * 1024;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;

export interface AgentSkillArchiveImportResult {
  skills: AgentExternalSkillDefinition[];
  warnings: string[];
}

function safePath(path: string) {
  return !path.startsWith('/') && !path.includes('\\') && !path.includes(':')
    && !path.split('/').some((part) => part === '..' || part === '__MACOSX' || part === '.git');
}

export function parseAgentSkillZip(bytes: Uint8Array, sourceName: string): AgentSkillArchiveImportResult {
  if (bytes.length > MAX_AGENT_SKILL_ARCHIVE_BYTES) throw new Error('ZIP 压缩包不能超过 200 MB。');
  let total = 0;
  let count = 0;
  const warnings: string[] = [];
  const unsupportedFiles: string[] = [];
  const files = unzipSync(bytes, { filter: (file) => {
    if (++count > 4000) throw new Error('压缩包中的文件数量过多。');
    if (!safePath(file.name)) return false;
    if (!/\.(?:md|markdown|txt|json)$/iu.test(file.name)) {
      if (!file.name.endsWith('/')) unsupportedFiles.push(file.name);
      return false;
    }
    if (file.originalSize > MAX_FILE_BYTES) { warnings.push(`已跳过过大的文本：${file.name}`); return false; }
    total += file.originalSize;
    if (total > MAX_TEXT_BYTES) throw new Error('压缩包中的技能文本总量超过 2 MB。');
    return true;
  } });
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const skills: AgentExternalSkillDefinition[] = [];
  const ids = new Set<string>();
  const roots = Object.keys(files).filter((path) => /(?:^|\/)skill\.md$/iu.test(path));
  for (const path of roots) {
    try {
      const directory = path.slice(0, path.lastIndexOf('/') + 1);
      const fallbackName = directory.split('/').filter(Boolean).pop() || sourceName.replace(/\.zip$/iu, '');
      const preview = parseAgentExternalSkillImport(decoder.decode(files[path]), `${fallbackName}.md`);
      if (!preview.skill) { warnings.push(`${path}：${preview.errors.join('；')}`); continue; }
      const skill = { ...preview.skill, sourceName: `${sourceName} / ${path}` };
      const missingDependency = unsupportedFiles.find((file) => file.startsWith(directory) && skill.instructions.includes(file.slice(directory.length)));
      if (missingDependency) { warnings.push(`${skill.title}：依赖暂不支持的脚本或资源 ${missingDependency}，已跳过。`); continue; }
      if (ids.has(skill.id)) { warnings.push(`已跳过重复技能：${skill.id}`); continue; }
      // Bundle text references owned by this skill, excluding nested skills.
      const references = Object.keys(files).filter((candidate) => candidate !== path && candidate.startsWith(directory)
        && !roots.some((root) => root !== path && root.startsWith(directory) && root.slice(0, root.lastIndexOf('/') + 1).length > directory.length && candidate.startsWith(root.slice(0, root.lastIndexOf('/') + 1))));
      for (const reference of references) {
        if (!/\.(?:md|markdown|txt|json)$/iu.test(reference)) continue;
        const appendix = `\n\n--- 附带参考文件：${reference.slice(directory.length)} ---\n${decoder.decode(files[reference])}`;
        if (new TextEncoder().encode(skill.instructions + appendix).length > MAX_FILE_BYTES) {
          warnings.push(`${skill.title}：参考资料过大，未安装该技能。`);
          skill.instructions = '';
          break;
        }
        skill.instructions += appendix;
      }
      if (!skill.instructions) continue;
      ids.add(skill.id);
      skills.push(skill);
    } catch { warnings.push(`${path}：无法读取 UTF-8 技能文本。`); }
  }
  if (!skills.length) throw new Error('压缩包中未找到可安装的 SKILL.md。' + warnings.join('；'));
  return { skills, warnings };
}

export async function readAgentSkillImportFile(file: Pick<File, 'name' | 'size' | 'arrayBuffer' | 'text'>): Promise<AgentSkillArchiveImportResult> {
  if (/\.zip$/iu.test(file.name)) {
    if (file.size > MAX_AGENT_SKILL_ARCHIVE_BYTES) throw new Error('ZIP 压缩包不能超过 200 MB。');
    return parseAgentSkillZip(new Uint8Array(await file.arrayBuffer()), file.name);
  }
  if (file.size > MAX_FILE_BYTES) throw new Error('技能文件不能超过 64 KB。');
  const preview = parseAgentExternalSkillImport(await file.text(), file.name);
  if (!preview.skill) throw new Error(preview.errors.join('；'));
  return { skills: [preview.skill], warnings: [] };
}
