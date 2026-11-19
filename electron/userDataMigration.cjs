const fs = require('fs');
const path = require('path');

// The app is called AI Pets Hub everywhere since 2026-11-18. Its data folder follows the package
// name, "ai-pets-hub" — public releases already used it. Development runs and builds made from the
// development copy used "react-example" (the old package name), so their data is moved over once:
//   - only when the new folder has no config yet and an old one has;
//   - an existing new folder without config (an earlier trial run) is renamed aside, not deleted;
//   - the move is a rename on the same drive (instant, nothing copied);
//   - a link is left at the old name, so builds from before the rename still find the data;
//   - if the move fails (a file is in use, e.g. an older build is running), this run simply keeps
//     using the old folder and the next start tries again.

const LEGACY_FOLDER_NAMES = ['react-example', 'AI Desktop Pet'];
const CONFIG_FILE = 'desktop-pet-config.v1.json';

const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

function isLink(folder) {
  try {
    return fs.lstatSync(folder).isSymbolicLink();
  } catch {
    return false;
  }
}

function configTime(folder) {
  try {
    return fs.statSync(path.join(folder, CONFIG_FILE)).mtimeMs;
  } catch {
    return -1;
  }
}

function stamp(now) {
  const date = new Date(now);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

/** Moves an old data folder to the current one if needed. Returns what happened (for the log). */
function migrateLegacyUserData({ app, now = Date.now(), legacyNames = LEGACY_FOLDER_NAMES }) {
  const target = app.getPath('userData');
  if (configTime(target) >= 0) return { status: 'current' };
  const appData = app.getPath('appData');
  const legacy = legacyNames
    .map((name) => path.join(appData, name))
    .filter((folder) => !samePath(folder, target) && !isLink(folder) && configTime(folder) >= 0)
    .sort((a, b) => configTime(b) - configTime(a))[0];
  if (!legacy) return { status: 'nothing-to-move' };

  let aside = null;
  try {
    if (fs.existsSync(target)) {
      aside = `${target}.before-rename-${stamp(now)}`;
      fs.renameSync(target, aside);
    }
    fs.renameSync(legacy, target);
  } catch (error) {
    // Put back what was moved aside, then keep using the old folder for this run.
    if (aside && !fs.existsSync(target)) {
      try { fs.renameSync(aside, target); aside = null; } catch { /* the aside copy stays where it is */ }
    }
    app.setPath('userData', legacy);
    return { aside, error: String(error?.code || error?.message || error), from: legacy, status: 'kept-old-folder' };
  }
  let linked = false;
  try {
    fs.symlinkSync(target, legacy, 'junction');
    linked = true;
  } catch {
    // Older builds would then start without data; the data itself is safe in the new folder.
  }
  try {
    fs.writeFileSync(path.join(target, 'moved-from.txt'), `${new Date(now).toISOString()} moved from ${legacy}${aside ? `; earlier folder kept at ${aside}` : ''}\n`);
  } catch {
    // only a note
  }
  return { aside, from: legacy, linked, status: 'moved', to: target };
}

module.exports = { LEGACY_FOLDER_NAMES, migrateLegacyUserData };
