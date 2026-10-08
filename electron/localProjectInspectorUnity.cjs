const { hasEntry, createDetection, createSuggestedAction } = require('./localProjectInspectorRules.cjs');

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

module.exports = { inspectUnity };
