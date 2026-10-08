function createWindowIconResolver({ nativeImage, path, processRef, baseDirectory }) {

function resolveAppIconPath() {
  const candidates = [
    path.join(processRef.resourcesPath, 'icon.ico'),
    path.join(processRef.resourcesPath, 'icon.png'),
    path.join(baseDirectory, '..', 'build', 'icon.ico'),
    path.join(baseDirectory, '..', 'build', 'icon.png'),
  ];

  for (const iconPath of candidates) {
    const image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) {
      return iconPath;
    }
  }

  return null;
}

function getBrowserWindowIconOptions() {
  const iconPath = resolveAppIconPath();
  return iconPath ? { icon: iconPath } : {};
}

function resolveTrayIcon() {
  const candidates = [
    resolveAppIconPath(),
    processRef.execPath,
  ].filter(Boolean);

  for (const iconPath of candidates) {
    const image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) {
      return image.resize({ width: 16, height: 16 });
    }
  }

  return nativeImage.createEmpty();
}

  return { getBrowserWindowIconOptions, resolveTrayIcon };
}

module.exports = { createWindowIconResolver };
