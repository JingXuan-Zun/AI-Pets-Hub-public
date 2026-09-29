import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const productionImportPattern = /import\s*\{([\s\S]*?)\}\s*from\s*(['"])\.\.\/src\/agent\/index\.ts\2;?/gu;

function listScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return listScriptFiles(path);
    }
    return /\.(?:ts|tsx|mjs|mts)$/u.test(entry.name) ? [path] : [];
  });
}

function containsLegacyVersionSpecifier(specifiers) {
  return /(?:^|\W)(?:AgentSessionV[23]|agentSessionV[23]|AGENT_SESSION_V[23]|\w*V[23]\w*|\w*v[23]\w*)(?:$|\W)/u.test(
    specifiers,
  );
}

export function auditAgentRuntimeLegacyImports(options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const scriptsDir = join(rootDir, 'scripts');
  const fix = options.fix === true;
  const changed = [];
  const violations = [];

  for (const filePath of listScriptFiles(scriptsDir)) {
    const source = readFileSync(filePath, 'utf8');
    let matchedLegacyImport = false;
    let nextSource = source.replace(
      productionImportPattern,
      (fullMatch, specifiers, quote) => {
        if (!containsLegacyVersionSpecifier(specifiers)) {
          return fullMatch;
        }
        matchedLegacyImport = true;
        return fullMatch.replace(
          `${quote}../src/agent/index.ts${quote}`,
          `${quote}../src/agent/legacy/index.ts${quote}`,
        );
      },
    );
    const legacyBarrelImported = nextSource.includes('../src/agent/legacy/index.ts');
    const legacyExportAssertionAgainstProduction = legacyBarrelImported
      && nextSource.includes('src/agent/index.ts')
      && nextSource.includes('\\.\\/agentSessionV3');
    const legacyV2ExportAssertionAgainstProduction = legacyBarrelImported
      && nextSource.includes('src/agent/index.ts')
      && (
        nextSource.includes("export \\* from '\\.\\/agentSessionV2")
        || nextSource.includes("export \\* from '\\.\\/agentTaskRuntimeV4SessionV2")
      );
    if (legacyExportAssertionAgainstProduction || legacyV2ExportAssertionAgainstProduction) {
      matchedLegacyImport = true;
      if (fix) {
        if (legacyExportAssertionAgainstProduction) {
          nextSource = nextSource
            .replaceAll('src/agent/index.ts', 'src/agent/legacy/index.ts')
            .replaceAll('\\.\\/agentSessionV3', '\\.\\.\\/agentSessionV3');
        } else {
          nextSource = nextSource
            .replaceAll("index: 'src/agent/index.ts'", "index: 'src/agent/legacy/index.ts'")
            .replaceAll("indexSource: 'src/agent/index.ts'", "indexSource: 'src/agent/legacy/index.ts'")
            .replaceAll("export \\* from '\\.\\/agentSessionV2", "export \\* from '\\.\\.\\/agentSessionV2")
            .replaceAll(
              "export \\* from '\\.\\/agentTaskRuntimeV4SessionV2",
              "export \\* from '\\.\\.\\/agentTaskRuntimeV4SessionV2",
            );
        }
      }
    }

    if (!matchedLegacyImport) {
      continue;
    }
    const relativePath = filePath.slice(rootDir.length + 1);
    if (fix && nextSource !== source) {
      writeFileSync(filePath, nextSource, 'utf8');
      changed.push(relativePath);
    } else {
      violations.push(relativePath);
    }
  }

  return { changed, violations };
}
