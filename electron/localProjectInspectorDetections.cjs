const { inspectPackageJson } = require('./localProjectInspectorNode.cjs');
const { inspectPython } = require('./localProjectInspectorPython.cjs');
const { inspectUnity } = require('./localProjectInspectorUnity.cjs');
const { inspectExecutableFolder } = require('./localProjectInspectorExecutables.cjs');
const { inspectOtherProjectTypes } = require('./localProjectInspectorOtherTypes.cjs');

function appendProjectInspection(collection, inspection, detailKey) {
  collection.detectedProjectTypes.push(inspection.detection);
  collection.suggestedActions.push(...inspection.actions);
  if (detailKey) collection.details[detailKey] = inspection.info;
}

function collectProjectDetections({ texts, entries, rootPath, targetFilePath, warnings }) {
  const collection = { detectedProjectTypes: [], suggestedActions: [], details: {} };
  const nodeInspection = inspectPackageJson(texts.get('package.json'), entries, rootPath, warnings);
  if (nodeInspection) appendProjectInspection(collection, nodeInspection, 'node');

  const pythonInspection = inspectPython(
    entries, rootPath, texts.get('pyproject.toml'), texts.get('requirements.txt'),
  );
  if (pythonInspection) appendProjectInspection(collection, pythonInspection, 'python');

  const unityInspection = inspectUnity(
    entries, rootPath, texts.get('ProjectSettings/ProjectVersion.txt'), texts.get('Packages/manifest.json'),
  );
  if (unityInspection) appendProjectInspection(collection, unityInspection, 'unity');

  const executableInspection = inspectExecutableFolder(entries, rootPath, targetFilePath);
  if (executableInspection) appendProjectInspection(collection, executableInspection, 'windowsApp');

  inspectOtherProjectTypes(entries, rootPath).forEach((inspection) => {
    appendProjectInspection(collection, inspection);
  });
  return collection;
}

module.exports = { collectProjectDetections };
