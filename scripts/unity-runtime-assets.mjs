import { copyFile, lstat, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

export const unityRuntimeSourceDir = path.join(process.cwd(), 'release', 'unity-runtime');

export async function pathExists(targetPath) {
  try {
    await lstat(targetPath);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

async function copyRecursive(sourcePath, targetPath) {
  const stat = await lstat(sourcePath);
  if (stat.isDirectory()) {
    await mkdir(targetPath, { recursive: true });
    const entries = await readdir(sourcePath);
    for (const entry of entries) {
      await copyRecursive(path.join(sourcePath, entry), path.join(targetPath, entry));
    }
    return;
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
}

export async function copyUnityRuntimeIfPresent(targetResourcesDir) {
  if (!await pathExists(unityRuntimeSourceDir)) {
    return null;
  }

  const targetDir = path.join(targetResourcesDir, 'unity-runtime');
  await rm(targetDir, { recursive: true, force: true });
  await copyRecursive(unityRuntimeSourceDir, targetDir);
  return targetDir;
}
