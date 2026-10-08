const path = require('path');
const { hasEntry, createDetection, createSuggestedAction } = require('./localProjectInspectorRules.cjs');

function inspectDotNet(entries, rootPath) {
  const solutionFile = entries.find((entry) => entry.isFile && entry.extension === '.sln');
  const csprojFile = entries.find((entry) => entry.isFile && entry.extension === '.csproj');
  if (solutionFile || csprojFile) {
    return {
      actions: [createSuggestedAction('.NET 运行或打开项目', csprojFile ? `dotnet run --project "${csprojFile.name}"` : `start "" "${solutionFile.name}"`, rootPath, csprojFile?.name ?? solutionFile?.name ?? '.NET', 'launch')],
      detection: createDetection('dotnet', '.NET/Visual Studio 项目', 82, '根目录存在 sln/csproj 文件'),
    };
  }

  return null;
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

  const dotnet = inspectDotNet(entries, rootPath);
  if (dotnet) results.push(dotnet);

  if (hasEntry(entries, 'index.html')) {
    results.push({
      actions: [createSuggestedAction('打开静态页面入口', path.join(rootPath, 'index.html'), rootPath, 'index.html', 'launch')],
      detection: createDetection('static-web', '静态网页目录', 64, '根目录存在 index.html'),
    });
  }

  return results;
}

module.exports = { inspectOtherProjectTypes };
