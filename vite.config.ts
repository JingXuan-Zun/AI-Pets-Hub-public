import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'path';
import { defineConfig } from 'vite';

function resolveAppVersion() {
  if (process.env.npm_package_version?.trim()) {
    return process.env.npm_package_version.trim();
  }
  try {
    const packageText = fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8');
    const packageValue = JSON.parse(packageText) as { version?: unknown };
    return typeof packageValue.version === 'string' && packageValue.version.trim()
      ? packageValue.version.trim() : '0.0.1';
  } catch {
    return '0.0.1';
  }
}

function getNodeModulePackageName(id: string) {
  const [, modulePath = ''] = id.split('node_modules/');
  const normalizedPath = modulePath.replace(/\\/g, '/');
  const pathParts = normalizedPath.split('/');

  if (!pathParts[0]) {
    return '';
  }

  if (pathParts[0].startsWith('@') && pathParts[1]) {
    return `${pathParts[0]}/${pathParts[1]}`;
  }

  return pathParts[0];
}

function resolveVendorChunk(id: string) {
  if (!id.includes('node_modules')) {
    return undefined;
  }

  const packageName = getNodeModulePackageName(id);
  const motionPackages = new Set([
    'motion',
    'motion-dom',
    'motion-utils',
    'framer-motion',
  ]);

  if (packageName === 'react' || packageName === 'react-dom' || packageName === 'scheduler') {
    return 'vendor-react';
  }

  if (packageName === '@google/genai') {
    return 'vendor-ai';
  }

  if (motionPackages.has(packageName)) {
    return 'vendor-motion';
  }

  if (
    packageName === 'three'
    || packageName === '@react-three/fiber'
    || packageName === 'react-reconciler'
  ) {
    return 'vendor-three';
  }

  if (packageName === 'lucide-react') {
    return 'vendor-icons';
  }

  if (
    packageName === '@base-ui/react'
    || packageName === 'class-variance-authority'
    || packageName === 'clsx'
    || packageName === 'tailwind-merge'
    || packageName === 'tw-animate-css'
    || packageName === '@fontsource-variable/geist'
  ) {
    return 'vendor-ui';
  }

  return undefined;
}

export default defineConfig(() => {
  const appVersion = resolveAppVersion();

  return {
    base: './',
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    resolve: {
      preserveSymlinks: true,
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      modulePreload: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            return resolveVendorChunk(id);
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify: file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
