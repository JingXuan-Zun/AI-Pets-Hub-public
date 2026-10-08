const { createDetection, createSuggestedAction } = require('./localProjectInspectorRules.cjs');

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

module.exports = { inspectPython };
