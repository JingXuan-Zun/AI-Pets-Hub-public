// A failed settings save used to show up only in the pet's runtime log, so changes were lost
// without the user noticing. Every failure now raises a dialog in plain words; the same
// error is not repeated while it keeps failing in quick succession (settings save in bursts).

const REPEAT_QUIET_MS = 8000;

const KNOWN_REASONS = [
  [/credential-endpoint-changed-reenter-key/u, '接口地址改了，但 API Key 还是旧的。为了安全，请在同一处重新填写 API Key 后再保存。'],
  [/credential-encryption-unavailable/u, '这台电脑的系统加密不可用，API Key 无法安全保存。'],
  [/credential-(?:decryption-failed|reference-unavailable)|invalid-protected-credential/u, '读取已保存的 API Key 失败，请重新填写 API Key。'],
  [/ENOSPC/u, '磁盘空间不足。'],
  [/EACCES|EPERM|EBUSY/u, '配置文件被占用或没有写入权限（可能被杀毒软件或另一个程序锁住）。'],
];

function describeConfigSaveFailure(error) {
  const text = String(error ?? '');
  const known = KNOWN_REASONS.find(([pattern]) => pattern.test(text));
  return known ? known[1] : `原因：${text.slice(0, 200) || '未知错误'}`;
}

function createConfigSaveFailureNotifier({ dialog, getParentWindow = () => null, now = Date.now }) {
  let last = { at: 0, error: '' };
  return function notifyConfigSaveFailure(result) {
    if (result?.ok) return false;
    const error = String(result?.error ?? 'unknown');
    const time = now();
    if (error === last.error && time - last.at < REPEAT_QUIET_MS) return false;
    last = { at: time, error };
    const parent = getParentWindow();
    const options = {
      buttons: ['知道了'],
      detail: describeConfigSaveFailure(error),
      message: '设置没有保存成功',
      noLink: true,
      title: '保存失败',
      type: 'warning',
    };
    // Not awaited: the save call must not wait for the user to close the dialog.
    void (parent && !parent.isDestroyed() ? dialog.showMessageBox(parent, options) : dialog.showMessageBox(options))
      .catch(() => undefined);
    return true;
  };
}

module.exports = { createConfigSaveFailureNotifier, describeConfigSaveFailure };
