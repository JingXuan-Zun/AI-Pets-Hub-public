const path = require('path');
const { getSafeStat, readKeyTextFile } = require('./localProjectInspectorReader.cjs');

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

function prepareProjectTexts(rootPath, readFiles, warnings) {
  const texts = new Map();
  READABLE_KEY_FILES.forEach((relativePath) => {
    const text = readKeyTextFile(rootPath, relativePath, readFiles, warnings);
    if (text) {
      texts.set(relativePath, text);
    }
  });

  const readmeName = README_NAMES.find((name) => getSafeStat(path.join(rootPath, name))?.isFile()) ?? '';
  const readmeText = readmeName ? readKeyTextFile(rootPath, readmeName, readFiles, warnings) : null;
  return { texts, readmeText };
}

module.exports = { prepareProjectTexts };
