// Built-in Windows apps are registered under English names on many systems ("Notepad",
// Microsoft.WindowsNotepad_…!App), so asking for “记事本” matched nothing and the character fell
// back to a shell command — which needs the user's permission and cost several extra rounds.
// Keyed by the package family prefix of the AppID (before “_”) or the executable name.
const CHINESE_ALIASES_BY_APP = {
  'microsoft.windowsnotepad': ['记事本', '笔记本'],
  'notepad.exe': ['记事本'],
  'microsoft.windowscalculator': ['计算器'],
  'calc.exe': ['计算器'],
  'microsoft.paint': ['画图'],
  'mspaint.exe': ['画图'],
  'microsoft.screensketch': ['截图工具', '截图', '截屏工具'],
  'microsoft.windows.photos': ['照片', '图片查看器'],
  'microsoft.windowscamera': ['相机', '摄像头'],
  'microsoft.windowsalarms': ['时钟', '闹钟'],
  'microsoft.windowssoundrecorder': ['录音机'],
  'microsoft.zunemusic': ['媒体播放器', '音乐播放器'],
  'microsoft.windowsterminal': ['终端', '命令行'],
  'microsoft.windowsstore': ['应用商店', '微软商店'],
  'microsoft.microsoftedge': ['Edge 浏览器', '微软浏览器'],
  'msedge.exe': ['Edge 浏览器', '微软浏览器'],
  'windows.immersivecontrolpanel': ['设置', '系统设置', 'Windows 设置'],
  'microsoft.windows.explorer': ['文件资源管理器', '资源管理器', '我的电脑'],
  'explorer.exe': ['文件资源管理器', '资源管理器'],
  'taskmgr.exe': ['任务管理器'],
  'cmd.exe': ['命令提示符'],
};

// Start-menu shortcuts carry the English display name instead ("Task Manager.lnk").
const APP_KEY_BY_ENGLISH_NAME = {
  notepad: 'notepad.exe',
  calculator: 'calc.exe',
  paint: 'mspaint.exe',
  'snipping tool': 'microsoft.screensketch',
  photos: 'microsoft.windows.photos',
  camera: 'microsoft.windowscamera',
  'task manager': 'taskmgr.exe',
  'command prompt': 'cmd.exe',
  'file explorer': 'explorer.exe',
  settings: 'windows.immersivecontrolpanel',
  'microsoft edge': 'msedge.exe',
  'microsoft store': 'microsoft.windowsstore',
  terminal: 'microsoft.windowsterminal',
};

function resolveAppAliasKey(appIdOrPath) {
  const value = String(appIdOrPath || '').trim().toLowerCase();
  if (!value) return '';
  if (value.includes('!')) return value.split('!')[0].split('_')[0];
  return value.split(/[\/]/u).pop() || '';
}

/** Chinese names for a built-in Windows app, from its AppID, executable path or English name. */
function resolveChineseAppAliases(appIdOrPath, displayName = '') {
  const byId = CHINESE_ALIASES_BY_APP[resolveAppAliasKey(appIdOrPath)];
  if (byId) return byId;
  const nameKey = APP_KEY_BY_ENGLISH_NAME[String(displayName || '').trim().toLowerCase()];
  return (nameKey && CHINESE_ALIASES_BY_APP[nameKey]) || [];
}

module.exports = { resolveChineseAppAliases };
