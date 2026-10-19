const { createBaseInputPowerShell } = require('./desktopInputBaseScript.cjs');
const { createForegroundGuardPowerShell } = require('./desktopInputForegroundGuard.cjs');
const { escapeSendKeysText, splitHotkey, virtualKeyFromToken } = require('./desktopInputRules.cjs');

// Paste is the main path: it is atomic and an active Chinese IME cannot turn letters into
// pinyin. Typed keys (SendKeys, or Unicode SendInput) dropped or repeated characters in live
// runs. The user's clipboard text is put back afterwards; a non-text clipboard (an image,
// files) is left alone and the text is typed instead, so nothing of theirs is overwritten.
const PASTE_TEXT_POWERSHELL = String.raw`$method = 'paste'
$previousText = $null
$clipboardUsable = $false
try {
  if ([System.Windows.Forms.Clipboard]::ContainsText()) {
    $previousText = [System.Windows.Forms.Clipboard]::GetText()
    $clipboardUsable = $true
  } elseif (-not [System.Windows.Forms.Clipboard]::GetDataObject() -or [System.Windows.Forms.Clipboard]::GetDataObject().GetFormats().Length -eq 0) {
    $clipboardUsable = $true
  }
} catch {
  $clipboardUsable = $false
}
$pasted = $false
if ($clipboardUsable) {
  try {
    [System.Windows.Forms.Clipboard]::SetText($text)
    Start-Sleep -Milliseconds 60
    [System.Windows.Forms.SendKeys]::SendWait('^v')
    Start-Sleep -Milliseconds 300
    $pasted = $true
  } catch {
    $pasted = $false
  }
  try {
    if ($previousText -ne $null) { [System.Windows.Forms.Clipboard]::SetText($previousText) } else { [System.Windows.Forms.Clipboard]::Clear() }
  } catch {
  }
}
if (-not $pasted) {
  $method = 'unicode'
}
`;

function createTextScript(options) {
  const text = String(options.text ?? options.value ?? '').slice(0, 2000);
  if (!text) {
    return null;
  }

  return createBaseInputPowerShell(String.raw`
${createForegroundGuardPowerShell(options, 'type_text')}
$text = @'
${JSON.stringify(text)}
'@ | ConvertFrom-Json
${PASTE_TEXT_POWERSHELL}if (-not $pasted -and -not [DesktopPetInput]::TypeUnicode($text)) {
  # SendKeys goes through the IME, so it is only the last fallback.
  $method = 'sendkeys'
  $escaped = @'
${JSON.stringify(escapeSendKeysText(text))}
'@ | ConvertFrom-Json
  [System.Windows.Forms.SendKeys]::SendWait($escaped)
}
@{ ok = $true; action = 'type_text'; method = $method; textLength = $text.Length } | ConvertTo-Json -Depth 4 -Compress
`);
}

function createSendKeysScript(options) {
  const keys = String(options.keys ?? options.sequence ?? '').trim().slice(0, 400);
  if (!keys) {
    return null;
  }

  return createBaseInputPowerShell(String.raw`
${createForegroundGuardPowerShell(options, 'send_keys')}
$keys = @'
${JSON.stringify(keys)}
'@ | ConvertFrom-Json
[System.Windows.Forms.SendKeys]::SendWait($keys)
@{ ok = $true; action = 'send_keys'; keys = $keys } | ConvertTo-Json -Depth 4 -Compress
`);
}

function createHotkeyScript(options) {
  const tokens = splitHotkey(options.hotkey ?? options.keys ?? options.sequence);
  const virtualKeys = tokens.map(virtualKeyFromToken).filter((value) => value !== null);
  if (!virtualKeys.length || virtualKeys.length !== tokens.length) {
    return null;
  }

  return createBaseInputPowerShell(String.raw`
${createForegroundGuardPowerShell(options, 'hotkey')}
$keys = @(${virtualKeys.join(',')})
foreach ($key in $keys) {
  [DesktopPetInput]::keybd_event([byte]$key, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 25
}
for ($i = $keys.Length - 1; $i -ge 0; $i--) {
  [DesktopPetInput]::keybd_event([byte]$keys[$i], 0, 0x0002, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 25
}
@{ ok = $true; action = 'hotkey'; hotkey = '${tokens.join('+')}' } | ConvertTo-Json -Depth 4 -Compress
`);
}

module.exports = { createTextScript, createSendKeysScript, createHotkeyScript };
