const { createBaseInputPowerShell } = require('./desktopInputBaseScript.cjs');
const { createForegroundGuardPowerShell } = require('./desktopInputForegroundGuard.cjs');
const { escapeSendKeysText, splitHotkey, virtualKeyFromToken } = require('./desktopInputRules.cjs');

function createTextScript(options) {
  const text = String(options.text ?? options.value ?? '').slice(0, 2000);
  if (!text) {
    return null;
  }

  return createBaseInputPowerShell(String.raw`
${createForegroundGuardPowerShell(options, 'type_text')}
$text = @'
${JSON.stringify(escapeSendKeysText(text))}
'@ | ConvertFrom-Json
[System.Windows.Forms.SendKeys]::SendWait($text)
@{ ok = $true; action = 'type_text'; textLength = $text.Length } | ConvertTo-Json -Depth 4 -Compress
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
