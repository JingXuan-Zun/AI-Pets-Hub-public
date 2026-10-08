const fs = require('fs');
const path = require('path');
const { OPEN_PATH_BLOCKED_EXTENSIONS } = require('./appLauncherConstants.cjs');
const { isSafeExternalUrl } = require('../ipcSenderGuard.cjs');

function createResourceOpener({ shellApi, launchLocalApp }) {
  function isLikelyUrlTarget(value) {
    const text = String(value || '').trim();
    if (!text || /\s/u.test(text)) {
      return false;
    }

    if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(text)) {
      return true;
    }

    return /^[^\s:/?#]+\.[^\s:/?#]{2,}(?:[/?#].*)?$/iu.test(text);
  }

  function normalizeUrlTarget(value) {
    const text = String(value || '').trim();
    if (!text) {
      return '';
    }

    if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(text)) {
      return text;
    }

    if (isLikelyUrlTarget(text)) {
      return `https://${text}`;
    }

    return '';
  }

  async function openResource(request = {}) {
    const target = String(
      request?.target
      || request?.query
      || request?.url
      || request?.path
      || request?.website
      || request?.site
      || '',
    ).trim().replace(/^["']|["']$/g, '');
    const requestedType = String(request?.resourceType || 'auto').trim().toLowerCase();
    const resourceType = ['auto', 'url', 'file', 'folder', 'app'].includes(requestedType)
      ? requestedType
      : 'auto';

    if (!target) {
      return {
        ok: false,
        error: 'Open target is empty.',
        resourceType,
        target,
      };
    }

    if (resourceType === 'app') {
      const launchResult = await launchLocalApp({
        forceNew: Boolean(request?.forceNew),
        query: target,
      });
      return {
        ...launchResult,
        resourceType: 'app',
        target,
      };
    }

    const url = resourceType === 'url' || (resourceType === 'auto' && isLikelyUrlTarget(target))
      ? normalizeUrlTarget(target)
      : '';
    if (url) {
      if (!isSafeExternalUrl(url)) {
        return {
          ok: false,
          error: 'Only http, https and mailto links can be opened.',
          resourceType: 'url',
          target,
          url,
        };
      }
      try {
        await shellApi.openExternal(url);
        return {
          ok: true,
          action: 'opened',
          resourceType: 'url',
          target,
          url,
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          resourceType: 'url',
          target,
          url,
        };
      }
    }

    if (resourceType === 'url') {
      return {
        ok: false,
        error: 'Target does not look like a valid URL or domain.',
        resourceType: 'url',
        target,
      };
    }

    if (path.isAbsolute(target)) {
      let isDirectory = false;
      try {
        isDirectory = fs.statSync(target).isDirectory();
      } catch {
        // Missing targets fall through to openPath, which reports the error.
      }
      if (!isDirectory && OPEN_PATH_BLOCKED_EXTENSIONS.has(path.extname(target).toLowerCase())) {
        return {
          ok: false,
          error: 'Executable, script and shortcut files are not opened as resources; use launch_local_app for apps.',
          resourceType: 'file',
          target,
        };
      }
      const error = await shellApi.openPath(target);
      let localResourceType = 'file';
      try {
        localResourceType = fs.existsSync(target) && fs.statSync(target).isDirectory() ? 'folder' : 'file';
      } catch {
        localResourceType = resourceType === 'folder' ? 'folder' : 'file';
      }

      return {
        ok: !error,
        action: error ? 'failed' : 'opened',
        error: error || undefined,
        resourceType: localResourceType,
        target,
      };
    }

    if (resourceType === 'file' || resourceType === 'folder') {
      return {
        ok: false,
        error: 'File or folder targets must be absolute local paths.',
        resourceType,
        target,
      };
    }

    const launchResult = await launchLocalApp({
      forceNew: Boolean(request?.forceNew),
      query: target,
    });
    return {
      ...launchResult,
      resourceType: 'app',
      target,
    };
  }

  return { openResource };
}

module.exports = { createResourceOpener };
