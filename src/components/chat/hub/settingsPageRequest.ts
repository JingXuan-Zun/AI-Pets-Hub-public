import { desktopPetShellRuntime } from '../../../desktopShellRuntime';
import type { SettingsControlCenterPageId } from '../../settings/settingsControlCenterNavigation';

/**
 * 从聊天 Hub 打开设置窗并跳到指定页面。
 *
 * settings-action IPC 只转发给主窗口，到不了设置窗；聊天窗和设置窗同源，
 * 所以用 localStorage 传递“想打开哪一页”：设置窗打开时读取一次，
 * 已经打开时通过 storage 事件收到。
 */
const SETTINGS_PAGE_REQUEST_KEY = 'desktop-pet.settings-page-request.v1';
/** 过期的请求（比如上次没打开成功留下的）不再生效。 */
const REQUEST_TTL_MS = 15_000;

interface SettingsPageRequest {
  pageId: SettingsControlCenterPageId;
  requestedAt: number;
}

export function openSettingsPage(pageId?: SettingsControlCenterPageId) {
  if (pageId) {
    try {
      const request: SettingsPageRequest = { pageId, requestedAt: Date.now() };
      window.localStorage.setItem(SETTINGS_PAGE_REQUEST_KEY, JSON.stringify(request));
    } catch {
      // 存不下就只打开设置窗，停在默认页。
    }
  }
  desktopPetShellRuntime.openSettingsWindow();
}

function parseRequest(raw: string | null): SettingsControlCenterPageId | null {
  if (!raw) return null;
  try {
    const request = JSON.parse(raw) as Partial<SettingsPageRequest>;
    if (typeof request.pageId !== 'string' || typeof request.requestedAt !== 'number') return null;
    return Date.now() - request.requestedAt <= REQUEST_TTL_MS ? request.pageId : null;
  } catch {
    return null;
  }
}

/** 读取并清除待处理的跳转请求。 */
export function consumeSettingsPageRequest(): SettingsControlCenterPageId | null {
  try {
    const pageId = parseRequest(window.localStorage.getItem(SETTINGS_PAGE_REQUEST_KEY));
    window.localStorage.removeItem(SETTINGS_PAGE_REQUEST_KEY);
    return pageId;
  } catch {
    return null;
  }
}

/** 设置窗已打开时，监听其他窗口发来的跳转请求。 */
export function subscribeSettingsPageRequests(onRequest: (pageId: SettingsControlCenterPageId) => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== SETTINGS_PAGE_REQUEST_KEY || !event.newValue) return;
    const pageId = consumeSettingsPageRequest();
    if (pageId) onRequest(pageId);
  };
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}
