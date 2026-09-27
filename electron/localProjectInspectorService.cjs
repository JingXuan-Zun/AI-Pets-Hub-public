const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const MAX_TOP_LEVEL_ENTRIES = 180;
const MAX_KEY_FILE_BYTES = 256 * 1024;
const README_LINE_LIMIT = 12;
const EXECUTABLE_EXTENSIONS = new Set(['.exe', '.bat', '.cmd', '.ps1', '.lnk', '.url', '.appref-ms']);
const READABLE_KEY_FILES = [
  'package.json',
  'pyproject.toml',
  'requirements.txt',
  'setup.py',
  'Cargo.toml',
  'go.mod',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'ProjectSettings/ProjectVersion.txt',
  'Packages/manifest.json',
];
const README_NAMES = [
  'README.md',
  'README.txt',
  'README',
  'readme.md',
  '说明.txt',
  '使用说明.txt',
];
const IGNORED_DIRECTORY_NAMES = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'dist',
  'build',
  'release',
  'target',
  '.venv',
  'venv',
  '__pycache__',
]);

function normalizeInputPath(value) {
  return String(value || '')
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim();
}

function getSafeStat(targetPath) {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
}

function normalizeEntry(entry, rootPath) {
  const fullPath = path.join(rootPath, entry.name);
  const stat = getSafeStat(fullPath);
  const extension = entry.isDirectory() ? '' : path.extname(entry.name).toLowerCase();

  return {
    extension,
    isDirectory: entry.isDirectory(),
    isFile: entry.isFile(),
    name: entry.name,
    path: fullPath,
    sizeBytes: stat?.isFile() ? stat.size : 0,
  };
}

function listTopLevelEntries(rootPath) {
  const rawEntries = fs.readdirSync(rootPath, { withFileTypes: true });
  const entries = rawEntries
    .filter((entry) => !IGNORED_DIRECTORY_NAMES.has(entry.name))
    .map((entry) => normalizeEntry(entry, rootPath))
    .sort((first, second) => (
      Number(second.isDirectory) - Number(first.isDirectory)
      || first.name.localeCompare(second.name, 'zh-Hans-CN', { numeric: true })
    ));

  return {
    entries: entries.slice(0, MAX_TOP_LEVEL_ENTRIES),
    totalEntryCount: rawEntries.length,
    truncated: rawEntries.length > MAX_TOP_LEVEL_ENTRIES,
  };
}

function getEntryByName(entries, name) {
  const normalizedName = name.toLowerCase();
  return entries.find((entry) => entry.name.toLowerCase() === normalizedName) ?? null;
}

function hasEntry(entries, name) {
  return Boolean(getEntryByName(entries, name));
}

function resolveInsideRoot(rootPath, relativePath) {
  const resolvedPath = path.resolve(rootPath, relativePath);
  const normalizedRoot = `${path.resolve(rootPath)}${path.sep}`;
  return resolvedPath === path.resolve(rootPath) || resolvedPath.startsWith(normalizedRoot)
    ? resolvedPath
    : null;
}

function readKeyTextFile(rootPath, relativePath, readFiles, warnings) {
  const filePath = resolveInsideRoot(rootPath, relativePath);
  if (!filePath) {
    return null;
  }

  const stat = getSafeStat(filePath);
  if (!stat?.isFile()) {
    return null;
  }

  if (stat.size > MAX_KEY_FILE_BYTES) {
    warnings.push(`跳过过大的关键文件：${relativePath}`);
    return null;
  }

  try {
    const text = fs.readFileSync(filePath, 'utf8');
    readFiles.push(relativePath);
    return text;
  } catch (error) {
    warnings.push(`读取 ${relativePath} 失败：${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function createDetection(id, label, confidence, reason) {
  return {
    confidence,
    id,
    label,
    reason,
  };
}

function createSuggestedAction(label, command, cwd, source, risk = 'read') {
  const normalizedCommand = String(command || '').trim();
  const kind = /^https?:\/\//iu.test(normalizedCommand)
    ? 'open-url'
    : path.isAbsolute(normalizedCommand)
      ? 'open-path'
      : 'terminal-command';

  return {
    command,
    cwd,
    kind,
    label,
    risk,
    source,
  };
}

function selectPackageManager(entries) {
  if (hasEntry(entries, 'pnpm-lock.yaml')) {
    return 'pnpm';
  }

  if (hasEntry(entries, 'yarn.lock')) {
    return 'yarn';
  }

  return 'npm';
}

function createNodeRunCommand(packageManager, scriptName) {
  const safeScriptName = /^[\w:-]+$/u.test(scriptName) ? scriptName : '';
  if (!safeScriptName) {
    return '';
  }

  if (packageManager === 'yarn') {
    return safeScriptName === 'start' ? 'yarn start' : `yarn ${safeScriptName}`;
  }

  if (packageManager === 'pnpm') {
    return safeScriptName === 'start' ? 'pnpm start' : `pnpm run ${safeScriptName}`;
  }

  return safeScriptName === 'start' ? 'npm start' : `npm run ${safeScriptName}`;
}

function inspectPackageJson(packageJsonText, entries, rootPath, warnings) {
  if (!packageJsonText) {
    return null;
  }

  try {
    const packageJson = JSON.parse(packageJsonText);
    const scripts = packageJson && typeof packageJson.scripts === 'object' && packageJson.scripts
      ? packageJson.scripts
      : {};
    const dependencies = {
      ...(
        packageJson && typeof packageJson.dependencies === 'object' && packageJson.dependencies
          ? packageJson.dependencies
          : {}
      ),
      ...(
        packageJson && typeof packageJson.devDependencies === 'object' && packageJson.devDependencies
          ? packageJson.devDependencies
          : {}
      ),
    };
    const packageManager = selectPackageManager(entries);
    const preferredScripts = ['dev', 'start', 'serve', 'preview', 'desktop', 'electron'];
    const scriptNames = Object.keys(scripts);
    const orderedScriptNames = [
      ...preferredScripts.filter((scriptName) => scriptNames.includes(scriptName)),
      ...scriptNames.filter((scriptName) => !preferredScripts.includes(scriptName)),
    ].filter((scriptName) => /^[\w:-]+$/u.test(scriptName)).slice(0, 8);
    const frameworkHints = [
      dependencies.electron ? 'Electron' : '',
      dependencies.vite ? 'Vite' : '',
      dependencies.next ? 'Next.js' : '',
      dependencies.react ? 'React' : '',
      dependencies.vue ? 'Vue' : '',
      dependencies.svelte ? 'Svelte' : '',
      dependencies.express ? 'Express' : '',
    ].filter(Boolean);

    return {
      actions: orderedScriptNames
        .map((scriptName) => createSuggestedAction(
          `运行 package.json 脚本：${scriptName}`,
          createNodeRunCommand(packageManager, scriptName),
          rootPath,
          'package.json',
          'launch',
        ))
        .filter((action) => action.command),
      detection: createDetection(
        dependencies.electron ? 'electron-node' : 'node',
        frameworkHints.length ? `${frameworkHints.join(' + ')} 项目` : 'Node.js 项目',
        dependencies.electron ? 96 : 88,
        '根目录存在 package.json',
      ),
      info: {
        frameworkHints,
        name: typeof packageJson?.name === 'string' ? packageJson.name : '',
        packageManager,
        scripts,
      },
    };
  } catch (error) {
    warnings.push(`package.json 解析失败：${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function inspectPython(entries, rootPath, pyprojectText, requirementsText) {
  const pythonFiles = entries
    .filter((entry) => entry.isFile && entry.extension === '.py')
    .map((entry) => entry.name);
  const priorityFiles = ['main.py', 'app.py', 'server.py', 'manage.py', 'run.py'];
  const entryFiles = [
    ...priorityFiles.filter((fileName) => pythonFiles.some((item) => item.toLowerCase() === fileName.toLowerCase())),
    ...pythonFiles.filter((fileName) => !priorityFiles.includes(fileName)).slice(0, 4),
  ];

  if (!pyprojectText && !requirementsText && !entryFiles.length) {
    return null;
  }

  const actions = [];
  if (requirementsText) {
    actions.push(createSuggestedAction('安装 Python 依赖', 'pip install -r requirements.txt', rootPath, 'requirements.txt', 'launch'));
  }
  entryFiles.slice(0, 4).forEach((fileName) => {
    actions.push(createSuggestedAction(`运行 Python 入口：${fileName}`, `python ${fileName}`, rootPath, fileName, 'launch'));
  });
  if (entryFiles.includes('manage.py')) {
    actions.unshift(createSuggestedAction('启动 Django 开发服务', 'python manage.py runserver', rootPath, 'manage.py', 'launch'));
  }

  return {
    actions,
    detection: createDetection('python', 'Python 项目或脚本', pyprojectText ? 88 : 76, pyprojectText ? '根目录存在 pyproject.toml' : '根目录存在 Python 脚本'),
    info: {
      entryFiles,
      hasPyproject: Boolean(pyprojectText),
      hasRequirements: Boolean(requirementsText),
    },
  };
}

function inspectUnity(entries, rootPath, projectVersionText, manifestText) {
  const hasUnityShape = hasEntry(entries, 'Assets') && hasEntry(entries, 'ProjectSettings');
  if (!hasUnityShape && !projectVersionText && !manifestText) {
    return null;
  }

  const versionMatch = projectVersionText?.match(/m_EditorVersion:\s*(.+)/u);
  return {
    actions: [
      createSuggestedAction('用 Unity Hub 或 Unity Editor 打开项目目录', rootPath, rootPath, 'ProjectSettings/ProjectVersion.txt', 'launch'),
    ],
    detection: createDetection('unity', 'Unity 项目', 95, '根目录包含 Assets 和 ProjectSettings'),
    info: {
      editorVersion: versionMatch?.[1]?.trim() ?? '',
      hasPackageManifest: Boolean(manifestText),
    },
  };
}

function inspectExecutableFolder(entries, rootPath, targetFilePath) {
  const executableEntries = entries
    .filter((entry) => entry.isFile && EXECUTABLE_EXTENSIONS.has(entry.extension))
    .sort((first, second) => {
      const firstScore = first.extension === '.exe' ? 0 : 1;
      const secondScore = second.extension === '.exe' ? 0 : 1;
      return firstScore - secondScore || first.name.localeCompare(second.name, 'zh-Hans-CN');
    });

  if (targetFilePath) {
    const targetExtension = path.extname(targetFilePath).toLowerCase();
    if (EXECUTABLE_EXTENSIONS.has(targetExtension)) {
      executableEntries.unshift({
        extension: targetExtension,
        isDirectory: false,
        isFile: true,
        name: path.basename(targetFilePath),
        path: targetFilePath,
        sizeBytes: getSafeStat(targetFilePath)?.size ?? 0,
      });
    }
  }

  const uniqueEntries = Array.from(new Map(executableEntries.map((entry) => [entry.path.toLowerCase(), entry])).values());
  if (!uniqueEntries.length) {
    return null;
  }

  return {
    actions: uniqueEntries.slice(0, 6).map((entry) => createSuggestedAction(
      `打开候选程序：${entry.name}`,
      entry.path,
      rootPath,
      entry.name,
      'launch',
    )),
    detection: createDetection('windows-app-folder', 'Windows 程序目录', 82, '目录中存在 exe/快捷方式/脚本启动文件'),
    info: {
      executableCandidates: uniqueEntries.slice(0, 12).map((entry) => ({
        name: entry.name,
        path: entry.path,
        type: entry.extension.replace(/^\./u, ''),
      })),
    },
  };
}

function inspectOtherProjectTypes(entries, rootPath) {
  const results = [];

  if (hasEntry(entries, 'Cargo.toml')) {
    results.push({
      actions: [createSuggestedAction('运行 Rust 项目', 'cargo run', rootPath, 'Cargo.toml', 'launch')],
      detection: createDetection('rust', 'Rust 项目', 86, '根目录存在 Cargo.toml'),
    });
  }

  if (hasEntry(entries, 'go.mod')) {
    results.push({
      actions: [createSuggestedAction('运行 Go 项目', 'go run .', rootPath, 'go.mod', 'launch')],
      detection: createDetection('go', 'Go 项目', 86, '根目录存在 go.mod'),
    });
  }

  if (hasEntry(entries, 'pom.xml')) {
    results.push({
      actions: [createSuggestedAction('运行 Maven 项目', 'mvn spring-boot:run', rootPath, 'pom.xml', 'launch')],
      detection: createDetection('maven-java', 'Maven/Java 项目', 78, '根目录存在 pom.xml'),
    });
  }

  if (hasEntry(entries, 'build.gradle') || hasEntry(entries, 'build.gradle.kts')) {
    results.push({
      actions: [createSuggestedAction('运行 Gradle 项目', 'gradlew run', rootPath, 'build.gradle', 'launch')],
      detection: createDetection('gradle-java', 'Gradle/Java 项目', 78, '根目录存在 Gradle 构建文件'),
    });
  }

  const solutionFile = entries.find((entry) => entry.isFile && entry.extension === '.sln');
  const csprojFile = entries.find((entry) => entry.isFile && entry.extension === '.csproj');
  if (solutionFile || csprojFile) {
    results.push({
      actions: [createSuggestedAction('.NET 运行或打开项目', csprojFile ? `dotnet run --project "${csprojFile.name}"` : `start "" "${solutionFile.name}"`, rootPath, csprojFile?.name ?? solutionFile?.name ?? '.NET', 'launch')],
      detection: createDetection('dotnet', '.NET/Visual Studio 项目', 82, '根目录存在 sln/csproj 文件'),
    });
  }

  if (hasEntry(entries, 'index.html')) {
    results.push({
      actions: [createSuggestedAction('打开静态页面入口', path.join(rootPath, 'index.html'), rootPath, 'index.html', 'launch')],
      detection: createDetection('static-web', '静态网页目录', 64, '根目录存在 index.html'),
    });
  }

  return results;
}

function extractReadmeHints(readmeText) {
  if (!readmeText) {
    return [];
  }

  return readmeText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => (
      line.length >= 3
      && line.length <= 180
      && /(?:npm|pnpm|yarn|python|pip|cargo|go run|mvn|gradle|unity|start|dev|serve|install|run|启动|运行|安装|使用)/iu.test(line)
    ))
    .slice(0, README_LINE_LIMIT);
}

function summarizeDirectoryEntries(entries) {
  const directories = entries.filter((entry) => entry.isDirectory).map((entry) => entry.name);
  const files = entries.filter((entry) => entry.isFile).map((entry) => entry.name);

  return {
    directories: directories.slice(0, 24),
    files: files.slice(0, 36),
  };
}

function createLocalProjectInspectorService({ log } = {}) {
  function logMessage(message, details) {
    if (typeof log === 'function') {
      log(message, details);
    }
  }

  function inspectLocalProject(request = {}) {
    const rawPath = normalizeInputPath(request?.path || request?.projectPath || request?.folderPath || request?.filePath || request?.query);
    if (!rawPath) {
      return {
        ok: false,
        error: 'Missing project path.',
      };
    }

    if (!path.isAbsolute(rawPath)) {
      return {
        ok: false,
        error: 'Project path must be an absolute local path.',
        path: rawPath,
      };
    }

    const targetPath = path.resolve(rawPath);
    const targetStat = getSafeStat(targetPath);
    if (!targetStat) {
      return {
        ok: false,
        error: 'Path does not exist.',
        path: targetPath,
      };
    }

    const rootPath = targetStat.isDirectory() ? targetPath : path.dirname(targetPath);
    const targetFilePath = targetStat.isFile() ? targetPath : '';
    const rootStat = getSafeStat(rootPath);
    if (!rootStat?.isDirectory()) {
      return {
        ok: false,
        error: 'Unable to resolve containing folder.',
        path: targetPath,
      };
    }

    const warnings = [];
    const readFiles = [];
    const { entries, totalEntryCount, truncated } = listTopLevelEntries(rootPath);
    const texts = new Map();
    READABLE_KEY_FILES.forEach((relativePath) => {
      const text = readKeyTextFile(rootPath, relativePath, readFiles, warnings);
      if (text) {
        texts.set(relativePath, text);
      }
    });

    const readmeName = README_NAMES.find((name) => getSafeStat(path.join(rootPath, name))?.isFile()) ?? '';
    const readmeText = readmeName ? readKeyTextFile(rootPath, readmeName, readFiles, warnings) : null;
    const detectedProjectTypes = [];
    const suggestedActions = [];
    const details = {};

    const nodeInspection = inspectPackageJson(texts.get('package.json'), entries, rootPath, warnings);
    if (nodeInspection) {
      detectedProjectTypes.push(nodeInspection.detection);
      suggestedActions.push(...nodeInspection.actions);
      details.node = nodeInspection.info;
    }

    const pythonInspection = inspectPython(
      entries,
      rootPath,
      texts.get('pyproject.toml'),
      texts.get('requirements.txt'),
    );
    if (pythonInspection) {
      detectedProjectTypes.push(pythonInspection.detection);
      suggestedActions.push(...pythonInspection.actions);
      details.python = pythonInspection.info;
    }

    const unityInspection = inspectUnity(
      entries,
      rootPath,
      texts.get('ProjectSettings/ProjectVersion.txt'),
      texts.get('Packages/manifest.json'),
    );
    if (unityInspection) {
      detectedProjectTypes.push(unityInspection.detection);
      suggestedActions.push(...unityInspection.actions);
      details.unity = unityInspection.info;
    }

    const executableInspection = inspectExecutableFolder(entries, rootPath, targetFilePath);
    if (executableInspection) {
      detectedProjectTypes.push(executableInspection.detection);
      suggestedActions.push(...executableInspection.actions);
      details.windowsApp = executableInspection.info;
    }

    inspectOtherProjectTypes(entries, rootPath).forEach((inspection) => {
      detectedProjectTypes.push(inspection.detection);
      suggestedActions.push(...inspection.actions);
    });

    if (truncated) {
      warnings.push(`目录项目较多，只读取了前 ${MAX_TOP_LEVEL_ENTRIES} 项顶层文件。`);
    }

    if (!detectedProjectTypes.length) {
      detectedProjectTypes.push(createDetection('unknown-folder', '暂未识别的本机目录', 20, '没有发现常见项目入口文件'));
      warnings.push('没有发现常见启动入口。可以告诉我更具体的入口文件，或让我继续做更深层只读扫描。');
    }

    const sortedDetections = detectedProjectTypes.sort((first, second) => second.confidence - first.confidence);
    const uniqueActions = Array.from(new Map(
      suggestedActions.map((action) => [`${action.command}|${action.cwd}`, action]),
    ).values()).slice(0, 12);

    const result = {
      details,
      detectedProjectTypes: sortedDetections,
      entrySummary: summarizeDirectoryEntries(entries),
      ok: true,
      path: targetPath,
      primaryType: sortedDetections[0] ?? null,
      readFiles,
      readmeHints: extractReadmeHints(readmeText),
      rootPath,
      scannedAt: Date.now(),
      suggestedActions: uniqueActions,
      targetKind: targetStat.isDirectory() ? 'directory' : 'file',
      totalEntryCount,
      warnings,
    };

    logMessage('local project inspected', {
      actionCount: uniqueActions.length,
      primaryType: result.primaryType?.id ?? 'unknown',
      readFileCount: readFiles.length,
      rootPath,
    });

    return result;
  }

  function normalizeActionIndex(value) {
    const index = Number(value);
    if (!Number.isFinite(index)) {
      return null;
    }

    const roundedIndex = Math.round(index);
    if (roundedIndex <= 0) {
      return 0;
    }

    return roundedIndex - 1;
  }

  function findSuggestedActionSelection(inspection, request = {}) {
    const actions = Array.isArray(inspection?.suggestedActions) ? inspection.suggestedActions : [];
    if (!actions.length) {
      return null;
    }

    const actionIndex = normalizeActionIndex(request?.actionIndex ?? request?.index);
    if (actionIndex !== null) {
      const action = actions[actionIndex] ?? null;
      return action
        ? {
            action,
            index: actionIndex,
            reason: 'index',
          }
        : null;
    }

    const requestedCommand = String(request?.command || '').trim();
    if (requestedCommand) {
      const normalizedCommand = requestedCommand.toLowerCase();
      const index = actions.findIndex((action) => String(action.command || '').trim().toLowerCase() === normalizedCommand);
      return index >= 0
        ? {
            action: actions[index],
            index,
            reason: 'command',
          }
        : null;
    }

    const requestedLabel = String(request?.label || '').trim();
    if (requestedLabel) {
      const normalizedLabel = requestedLabel.toLowerCase();
      const index = actions.findIndex((action) => String(action.label || '').trim().toLowerCase().includes(normalizedLabel));
      return index >= 0
        ? {
            action: actions[index],
            index,
            reason: 'label',
          }
        : null;
    }

    return actions[0]
      ? {
          action: actions[0],
          index: 0,
          reason: 'default',
        }
      : null;
  }

  function selectSuggestedAction(inspection, request = {}) {
    return findSuggestedActionSelection(inspection, request)?.action ?? null;
  }

  function runTerminalCommand(action) {
    const startedAt = Date.now();
    if (process.platform !== 'win32') {
      return {
        ok: false,
        error: 'Project command execution is currently only supported on Windows.',
        execution: {
          kind: 'terminal-command',
          startedAt,
        },
      };
    }

    const cwd = String(action.cwd || '').trim();
    const command = String(action.command || '').trim();
    if (!cwd || !path.isAbsolute(cwd) || !getSafeStat(cwd)?.isDirectory()) {
      return {
        ok: false,
        error: 'Invalid working directory.',
        execution: {
          command,
          cwd,
          kind: 'terminal-command',
          startedAt,
        },
      };
    }

    if (!command) {
      return {
        ok: false,
        error: 'Missing command.',
        execution: {
          cwd,
          kind: 'terminal-command',
          startedAt,
        },
      };
    }

    try {
      const child = spawn('cmd.exe', ['/d', '/s', '/k', command], {
        cwd,
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      });
      child.unref();

      return {
        execution: {
          command,
          cwd,
          kind: 'terminal-command',
          observation: '已创建新的可见命令行窗口。后续输出和退出码在该窗口内显示，当前 Agent 只确认启动请求已发出。',
          processName: 'cmd.exe',
          startedAt,
          visibleWindow: true,
        },
        ok: true,
        pid: child.pid ?? null,
        verification: {
          confidence: 'started',
          ok: true,
          reason: 'visible-terminal-window-created',
          summary: '已创建新的可见命令行窗口；当前没有读取 stdout/stderr 或退出码。',
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        execution: {
          command,
          cwd,
          kind: 'terminal-command',
          observation: '命令行窗口创建失败。',
          processName: 'cmd.exe',
          startedAt,
          visibleWindow: true,
        },
        verification: {
          confidence: 'failed',
          ok: false,
          reason: 'terminal-window-create-failed',
          summary: '命令行窗口创建失败。',
        },
      };
    }
  }

  async function openPathAction(action, shell) {
    const startedAt = Date.now();
    const targetPath = String(action.command || '').trim();
    if (!targetPath) {
      return {
        ok: false,
        error: 'Missing path.',
        execution: {
          kind: 'open-path',
          startedAt,
        },
        verification: {
          confidence: 'failed',
          ok: false,
          reason: 'missing-path',
          summary: '缺少要打开的路径。',
        },
      };
    }

    if (!shell || typeof shell.openPath !== 'function') {
      return {
        ok: false,
        error: 'Electron shell.openPath is unavailable.',
        execution: {
          kind: 'open-path',
          startedAt,
          target: targetPath,
        },
        verification: {
          confidence: 'failed',
          ok: false,
          reason: 'shell-open-path-unavailable',
          summary: 'Electron shell.openPath 不可用。',
        },
      };
    }

    try {
      const error = await shell.openPath(targetPath);
      return error
        ? {
            ok: false,
            error,
            execution: {
              kind: 'open-path',
              observation: '系统打开路径请求返回错误。',
              startedAt,
              target: targetPath,
            },
            verification: {
              confidence: 'failed',
              ok: false,
              reason: 'shell-open-path-error',
              summary: '系统打开路径请求返回错误。',
            },
          }
        : {
            execution: {
              kind: 'open-path',
              observation: '系统打开路径请求没有返回错误。',
              startedAt,
              target: targetPath,
            },
            ok: true,
            verification: {
              confidence: 'request-accepted',
              ok: true,
              reason: 'shell-open-path-accepted',
              summary: '系统打开路径请求没有返回错误；当前没有进一步确认目标程序窗口。',
            },
          };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        execution: {
          kind: 'open-path',
          observation: '系统打开路径请求异常。',
          startedAt,
          target: targetPath,
        },
        verification: {
          confidence: 'failed',
          ok: false,
          reason: 'shell-open-path-exception',
          summary: '系统打开路径请求异常。',
        },
      };
    }
  }

  async function openUrlAction(action, shell) {
    const startedAt = Date.now();
    const targetUrl = String(action.command || '').trim();
    if (!targetUrl) {
      return {
        ok: false,
        error: 'Missing URL.',
        execution: {
          kind: 'open-url',
          startedAt,
        },
        verification: {
          confidence: 'failed',
          ok: false,
          reason: 'missing-url',
          summary: '缺少要打开的 URL。',
        },
      };
    }

    if (!shell || typeof shell.openExternal !== 'function') {
      return {
        ok: false,
        error: 'Electron shell.openExternal is unavailable.',
        execution: {
          kind: 'open-url',
          startedAt,
          target: targetUrl,
        },
        verification: {
          confidence: 'failed',
          ok: false,
          reason: 'shell-open-url-unavailable',
          summary: 'Electron shell.openExternal 不可用。',
        },
      };
    }

    try {
      await shell.openExternal(targetUrl);
      return {
        execution: {
          kind: 'open-url',
          observation: '系统打开 URL 请求没有返回错误。',
          startedAt,
          target: targetUrl,
        },
        ok: true,
        verification: {
          confidence: 'request-accepted',
          ok: true,
          reason: 'shell-open-url-accepted',
          summary: '系统打开 URL 请求没有返回错误；当前没有进一步确认浏览器页面状态。',
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        execution: {
          kind: 'open-url',
          observation: '系统打开 URL 请求异常。',
          startedAt,
          target: targetUrl,
        },
        verification: {
          confidence: 'failed',
          ok: false,
          reason: 'shell-open-url-exception',
          summary: '系统打开 URL 请求异常。',
        },
      };
    }
  }

  async function runLocalProjectAction(request = {}) {
    const inspection = request?.inspection && typeof request.inspection === 'object'
      ? request.inspection
      : inspectLocalProject(request);
    if (!inspection?.ok) {
      return {
        ok: false,
        error: inspection?.error ?? 'Unable to inspect project before running.',
        inspection,
      };
    }

    const selection = findSuggestedActionSelection(inspection, request);
    const action = selection?.action ?? null;
    if (!action) {
      return {
        ok: false,
        error: 'No matching suggested action found.',
        inspection,
      };
    }

    if (action.risk !== 'launch') {
      return {
        ok: false,
        action,
        error: 'Selected action is not a launch action.',
        inspection,
        selectedActionIndex: selection?.index ?? null,
      };
    }

    if (request?.dryRun) {
      return {
        action,
        dryRun: true,
        inspection,
        ok: true,
        selectedActionIndex: selection?.index ?? null,
        selectionReason: selection?.reason ?? null,
      };
    }

    const shell = request?.shell;
    const runResult = action.kind === 'open-url'
      ? await openUrlAction(action, shell)
      : action.kind === 'open-path'
        ? await openPathAction(action, shell)
        : runTerminalCommand(action);

    logMessage('local project action run', {
      actionKind: action.kind,
      command: action.command,
      ok: Boolean(runResult.ok),
      rootPath: inspection.rootPath,
      selectedActionIndex: selection?.index ?? null,
    });

    return {
      action,
      error: runResult.error,
      execution: runResult.execution ?? null,
      inspection,
      ok: Boolean(runResult.ok),
      pid: runResult.pid ?? null,
      selectedActionIndex: selection?.index ?? null,
      selectionReason: selection?.reason ?? null,
      verification: runResult.verification ?? null,
    };
  }

  return {
    inspectLocalProject,
    runLocalProjectAction,
  };
}

module.exports = {
  createLocalProjectInspectorService,
};
