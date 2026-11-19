const crypto = require('crypto');
const { redactDiagnosticsText } = require('../diagnosticsExport.cjs');

// Incidents ("病例", 2026-11-18, docs/self-repair-design-20261008.md §4): an error the app ran
// into, cleaned so it can leave the computer (no keys, no user name in paths, no chat text) and
// keyed by a fingerprint so the same problem seen many times — or on many computers — is one
// incident. This file only turns runtime-log entries into that shape; the store keeps them.

const MAX_TITLE = 200;
const MAX_FRAMES = 8;
// Process ends that are not problems: a window or helper closed normally, or one we stopped.
const QUIET_REASONS = new Set(['clean-exit', 'killed']);

/** A runtime-log entry that is an error worth keeping, as { source, kind, message, stack }; else null. */
function incidentFromLogEntry({ side, scope, message, details }) {
  if (side === 'backend' && scope === 'error') {
    if (message === 'uncaughtException' || message === 'unhandledRejection') {
      const text = typeof details === 'string' ? details : String(details?.stack || details?.message || details || '');
      const [first, ...rest] = text.split('\n');
      return { kind: message, message: first, source: 'main', stack: rest.join('\n') };
    }
    if (message === 'render-process-gone' && !QUIET_REASONS.has(details?.reason)) {
      return { kind: message, message: `窗口进程退出：${details?.reason ?? '未知'}（退出码 ${details?.exitCode ?? '?'}）`, source: 'crash', stack: '' };
    }
    if (message === 'child-process-gone' && !QUIET_REASONS.has(details?.reason)) {
      return { kind: message, message: `${details?.type ?? '子'}进程退出：${details?.reason ?? '未知'}（${details?.name || details?.serviceName || '无名'}，退出码 ${details?.exitCode ?? '?'}）`, source: 'crash', stack: '' };
    }
    return null;
  }
  // Windows put their name in front: "主界面/unhandled-error", "聊天/unhandled-error".
  if (side === 'frontend' && /(?:^|\/)unhandled-error$/u.test(String(scope))) {
    const errorMessage = details?.errorMessage || details?.error?.message || message;
    return { kind: details?.errorName || 'Error', message: String(errorMessage), source: 'window', stack: String(details?.errorStack || details?.error?.stack || '') };
  }
  return null;
}

/** "at fn (C:\…\app.asar\dist\assets\x-abc.js:12:5)" → { fn, file: 'dist/assets/x.js', line: '12:5' }. */
function parseFrames(stack) {
  const frames = [];
  for (const raw of String(stack || '').split('\n')) {
    const match = raw.trim().match(/^at\s+(?:(.+?)\s+\()?(.+?)(?::(\d+):(\d+))?\)?$/u);
    if (!match) continue;
    const location = match[2].replace(/\\/gu, '/');
    // Only the part inside the app: the install folder and the user's paths stay behind.
    const inApp = location.match(/(?:app\.asar|app-updates\/v[\d.]+|ai-desktop-pet)\/(.+)$/u)?.[1]
      ?? (location.startsWith('node:') ? location : location.split('/').pop());
    // Built file names carry a content hash (index-Ck897HSc.js): drop it so versions match.
    const file = inApp.replace(/-[A-Za-z0-9_]{8}(\.m?js)$/u, '$1').replace(/\?.*$/u, '');
    frames.push({ file, fn: (match[1] || '<匿名>').slice(0, 80), line: match[3] ? `${match[3]}:${match[4]}` : '' });
    if (frames.length >= MAX_FRAMES) break;
  }
  return frames;
}

/** The message with private bits taken out and long quoted text shortened. */
function cleanMessage(message, redactOptions) {
  return redactDiagnosticsText(String(message ?? ''), redactOptions)
    .replace(/[A-Za-z]:[\\/][^\s'"]*[\\/]([^\\/\s'"]+)/gu, '…/$1')
    // Quoted text longer than a code word may be something someone said or typed.
    .replace(/(["'“「])([^"'”」]{16,})(["'”」])/gu, (_all, open, _text, close) => `${open}…${close}`)
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, MAX_TITLE);
}

/** Same problem → same fingerprint, on any computer and across versions (no line numbers, ids or counts). */
function fingerprintIncident({ source, kind, title, frames }) {
  const shape = String(title)
    .replace(/\b[0-9a-f]{8,}\b|\b[0-9a-f-]{36}\b/giu, '#')
    .replace(/\d+/gu, '#')
    .replace(/(["'“「]).*?(["'”」])/gu, '$1…$2');
  const where = frames.filter((frame) => !frame.file.startsWith('node:')).slice(0, 3).map((frame) => `${frame.fn}@${frame.file}`).join('|');
  return crypto.createHash('sha256').update(`${source}\n${kind}\n${shape}\n${where}`).digest('hex').slice(0, 16);
}

/** A raw error → the cleaned incident fields shared by the store and the upload. */
function shapeIncident(raw, redactOptions) {
  const title = cleanMessage(raw.message, redactOptions) || raw.kind;
  const frames = parseFrames(raw.stack);
  return { fingerprint: fingerprintIncident({ frames, kind: raw.kind, source: raw.source, title }), frames, kind: raw.kind, source: raw.source, title };
}

module.exports = { cleanMessage, fingerprintIncident, incidentFromLogEntry, parseFrames, shapeIncident };
