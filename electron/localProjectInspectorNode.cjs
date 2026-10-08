const { createDetection, createSuggestedAction, selectPackageManager, createNodeRunCommand } = require('./localProjectInspectorRules.cjs');

function readPackageFields(packageJson) {
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
  return { scripts, dependencies };
}

function selectNodeScriptNames(scripts) {
  const preferredScripts = ['dev', 'start', 'serve', 'preview', 'desktop', 'electron'];
  const scriptNames = Object.keys(scripts);
  const orderedScriptNames = [
    ...preferredScripts.filter((scriptName) => scriptNames.includes(scriptName)),
    ...scriptNames.filter((scriptName) => !preferredScripts.includes(scriptName)),
  ].filter((scriptName) => /^[\w:-]+$/u.test(scriptName)).slice(0, 8);
  return orderedScriptNames;
}

function getNodeFrameworkHints(dependencies) {
  const frameworkHints = [
    dependencies.electron ? 'Electron' : '',
    dependencies.vite ? 'Vite' : '',
    dependencies.next ? 'Next.js' : '',
    dependencies.react ? 'React' : '',
    dependencies.vue ? 'Vue' : '',
    dependencies.svelte ? 'Svelte' : '',
    dependencies.express ? 'Express' : '',
  ].filter(Boolean);
  return frameworkHints;
}

function createNodeProjectActions(orderedScriptNames, packageManager, rootPath) {
  return orderedScriptNames
    .map((scriptName) => createSuggestedAction(
      `运行 package.json 脚本：${scriptName}`,
      createNodeRunCommand(packageManager, scriptName),
      rootPath,
      'package.json',
      'launch',
    ))
    .filter((action) => action.command);
}

function inspectPackageJson(packageJsonText, entries, rootPath, warnings) {
  if (!packageJsonText) {
    return null;
  }

  try {
    const packageJson = JSON.parse(packageJsonText);
    const { scripts, dependencies } = readPackageFields(packageJson);
    const packageManager = selectPackageManager(entries);
    const orderedScriptNames = selectNodeScriptNames(scripts);
    const frameworkHints = getNodeFrameworkHints(dependencies);

    return {
      actions: createNodeProjectActions(orderedScriptNames, packageManager, rootPath),
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

module.exports = { inspectPackageJson };
