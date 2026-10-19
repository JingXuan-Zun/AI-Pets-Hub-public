// The PowerShell program of the elevated input helper. Windows (UIPI) blocks a normal
// process from sending input to a window that runs as administrator (WeGame, some game
// launchers), so for those the user can approve a helper that runs elevated through the
// UAC prompt. It only accepts the fixed commands below over a pipe that only this user can
// open, checks a one-time token on every command, never runs code it is sent, and exits
// when the app exits, after a few idle minutes, or on "stop".

function quote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function createElevatedInputBrokerScript({ pipeName, token, parentPid, idleMs, userSid }) {
  return String.raw`
$ErrorActionPreference = 'Stop'
$pipeName = ${quote(pipeName)}
$token = ${quote(token)}
$parentPid = ${Math.round(parentPid)}
$idleMs = ${Math.round(idleMs)}
$userSid = ${quote(userSid)}
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class ElevatedPetInput {
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] public struct INPUTUNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public INPUTUNION u; }
  [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint count, INPUT[] inputs, int size);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  static bool Send(INPUT input) { return SendInput(1, new INPUT[] { input }, Marshal.SizeOf(typeof(INPUT))) == 1; }
  public static bool Mouse(uint flags, uint data) { INPUT input = new INPUT(); input.type = 0; input.u.mi.dwFlags = flags; input.u.mi.mouseData = data; return Send(input); }
  public static bool Key(ushort vk, ushort scan, uint flags) { INPUT input = new INPUT(); input.type = 1; input.u.ki.wVk = vk; input.u.ki.wScan = scan; input.u.ki.dwFlags = flags; return Send(input); }
  public static bool Unicode(string text) {
    foreach (char c in text) { if (!Key(0, c, 4) || !Key(0, c, 6)) return false; System.Threading.Thread.Sleep(5); }
    return true;
  }
}
"@

function Invoke-Click($command) {
  $down = 0x0002; $up = 0x0004
  if ($command.button -eq 'right') { $down = 0x0008; $up = 0x0010 }
  elseif ($command.button -eq 'middle') { $down = 0x0020; $up = 0x0040 }
  [void][ElevatedPetInput]::SetCursorPos([int]$command.x, [int]$command.y)
  Start-Sleep -Milliseconds 80
  $clicks = [Math]::Max(1, [Math]::Min(4, [int]$command.clicks))
  for ($i = 0; $i -lt $clicks; $i++) {
    if (-not [ElevatedPetInput]::Mouse($down, 0)) { return 'sendinput_failed' }
    Start-Sleep -Milliseconds 40
    [void][ElevatedPetInput]::Mouse($up, 0)
    if ($i -lt $clicks - 1) { Start-Sleep -Milliseconds 80 }
  }
  return $null
}

function Invoke-Drag($command) {
  [void][ElevatedPetInput]::SetCursorPos([int]$command.fromX, [int]$command.fromY)
  Start-Sleep -Milliseconds 80
  if (-not [ElevatedPetInput]::Mouse(0x0002, 0)) { return 'sendinput_failed' }
  $steps = [Math]::Max(1, [Math]::Min(60, [int]$command.steps))
  for ($i = 1; $i -le $steps; $i++) {
    $x = [int]($command.fromX + ($command.toX - $command.fromX) * $i / $steps)
    $y = [int]($command.fromY + ($command.toY - $command.fromY) * $i / $steps)
    [void][ElevatedPetInput]::SetCursorPos($x, $y)
    Start-Sleep -Milliseconds 15
  }
  [void][ElevatedPetInput]::Mouse(0x0004, 0)
  return $null
}

function Invoke-Text($text) {
  $pasted = $false
  try {
    $previous = $null
    if ([System.Windows.Forms.Clipboard]::ContainsText()) { $previous = [System.Windows.Forms.Clipboard]::GetText() }
    [System.Windows.Forms.Clipboard]::SetText($text)
    Start-Sleep -Milliseconds 60
    [System.Windows.Forms.SendKeys]::SendWait('^v')
    Start-Sleep -Milliseconds 300
    $pasted = $true
    if ($previous -ne $null) { [System.Windows.Forms.Clipboard]::SetText($previous) } else { [System.Windows.Forms.Clipboard]::Clear() }
  } catch {
  }
  if (-not $pasted -and -not [ElevatedPetInput]::Unicode($text)) { return 'sendinput_failed' }
  return $null
}

function Invoke-PetCommand($command) {
  if ([int64]$command.expectedHwnd -gt 0 -and [ElevatedPetInput]::GetForegroundWindow().ToInt64() -ne [int64]$command.expectedHwnd) {
    return 'target_window_not_foreground'
  }
  switch ([string]$command.kind) {
    'click' { return Invoke-Click $command }
    'move' { [void][ElevatedPetInput]::SetCursorPos([int]$command.x, [int]$command.y); return $null }
    'drag' { return Invoke-Drag $command }
    'scroll' {
      [void][ElevatedPetInput]::SetCursorPos([int]$command.x, [int]$command.y)
      Start-Sleep -Milliseconds 60
      $flag = 0x0800
      if ($command.horizontal) { $flag = 0x1000 }
      $count = [Math]::Max(1, [Math]::Min(20, [Math]::Abs([int]$command.notches)))
      $delta = [uint32]([BitConverter]::ToUInt32([BitConverter]::GetBytes([int](120 * [Math]::Sign([int]$command.notches))), 0))
      for ($i = 0; $i -lt $count; $i++) { [void][ElevatedPetInput]::Mouse($flag, $delta); Start-Sleep -Milliseconds 40 }
      return $null
    }
    'text' { return Invoke-Text ([string]$command.text) }
    'sendkeys' { [System.Windows.Forms.SendKeys]::SendWait([string]$command.keys); return $null }
    'hotkey' {
      $keys = @($command.vks | ForEach-Object { [uint16]$_ })
      foreach ($key in $keys) { [void][ElevatedPetInput]::Key($key, 0, 0); Start-Sleep -Milliseconds 25 }
      for ($i = $keys.Length - 1; $i -ge 0; $i--) { [void][ElevatedPetInput]::Key($keys[$i], 0, 2); Start-Sleep -Milliseconds 25 }
      return $null
    }
    default { return 'unsupported_command' }
  }
}

$security = New-Object System.IO.Pipes.PipeSecurity
$security.AddAccessRule((New-Object System.IO.Pipes.PipeAccessRule((New-Object System.Security.Principal.SecurityIdentifier($userSid)), [System.IO.Pipes.PipeAccessRights]::ReadWrite, [System.Security.AccessControl.AccessControlType]::Allow)))
$pipe = New-Object System.IO.Pipes.NamedPipeServerStream($pipeName, [System.IO.Pipes.PipeDirection]::InOut, 1, [System.IO.Pipes.PipeTransmissionMode]::Byte, [System.IO.Pipes.PipeOptions]::Asynchronous, 65536, 65536, $security)
$connecting = $pipe.BeginWaitForConnection($null, $null)
if (-not $connecting.AsyncWaitHandle.WaitOne(60000)) { $pipe.Dispose(); exit 1 }
$pipe.EndWaitForConnection($connecting)
$utf8 = New-Object System.Text.UTF8Encoding($false)
$reader = New-Object System.IO.StreamReader($pipe, $utf8)
$writer = New-Object System.IO.StreamWriter($pipe, $utf8)
$writer.AutoFlush = $true
$lastUsed = [Diagnostics.Stopwatch]::StartNew()
while ($pipe.IsConnected) {
  $pending = $reader.ReadLineAsync()
  while (-not $pending.Wait(1000)) {
    if (-not (Get-Process -Id $parentPid -ErrorAction SilentlyContinue) -or $lastUsed.ElapsedMilliseconds -gt $idleMs) { $pipe.Dispose(); exit 0 }
  }
  $line = $pending.Result
  if ($line -eq $null) { break }
  $lastUsed.Restart()
  $command = $null
  try { $command = $line | ConvertFrom-Json } catch { }
  if ($command -eq $null -or [string]$command.token -ne $token) { break }
  if ($command.kind -eq 'stop') { break }
  $failure = $null
  try { $failure = Invoke-PetCommand $command } catch { $failure = $_.Exception.Message }
  $writer.WriteLine((@{ id = $command.id; ok = ($failure -eq $null); error = $failure } | ConvertTo-Json -Compress))
}
$pipe.Dispose()
exit 0
`;
}

module.exports = { createElevatedInputBrokerScript };
