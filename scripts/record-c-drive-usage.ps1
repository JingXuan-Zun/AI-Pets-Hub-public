[CmdletBinding()]
param(
  [ValidateSet('Snapshot', 'InstallTask', 'UninstallTask')]
  [string]$Mode = 'Snapshot',

  [string]$Drive = 'C:',

  [string]$LogDir = (Join-Path $env:USERPROFILE 'Documents\CDriveDailyMonitor'),

  [string]$TaskName = 'CDriveDailyMonitor',

  [string]$At = '21:30',

  [int]$MaxChangedRows = 25,

  [switch]$SummaryOnly,

  [switch]$IncludeBroadRoots
)

$ErrorActionPreference = 'Continue'

function Normalize-DriveRoot {
  param([string]$Value)

  $name = $Value.Trim()
  if ($name.EndsWith('\')) {
    return $name
  }
  if ($name.EndsWith(':')) {
    return "$name\"
  }
  return "$name`:\"
}

function Quote-TaskArgument {
  param([string]$Value)

  return '"' + ($Value -replace '"', '\"') + '"'
}

function Get-SizeRecord {
  param([string]$Path)

  $record = [ordered]@{
    Path = $Path
    Exists = $false
    Bytes = [int64]0
    GB = 0.0
    LastWriteTime = $null
    Error = $null
  }

  if (-not (Test-Path -LiteralPath $Path)) {
    return [pscustomobject]$record
  }

  try {
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
    $record.Exists = $true
    $record.LastWriteTime = $item.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')

    if ($item.PSIsContainer) {
      $sum = [int64]0
      $stack = New-Object 'System.Collections.Generic.Stack[string]'
      $stack.Push($Path)

      while ($stack.Count -gt 0) {
        $current = $stack.Pop()
        $children = Get-ChildItem -LiteralPath $current -Force -ErrorAction SilentlyContinue
        foreach ($child in $children) {
          if ($child.PSIsContainer) {
            if (($child.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
              continue
            }
            $stack.Push($child.FullName)
          } else {
            $sum += [int64]$child.Length
          }
        }
      }

      $record.Bytes = $sum
    } else {
      $record.Bytes = [int64]$item.Length
    }

    $record.GB = [math]::Round(($record.Bytes / 1GB), 3)
  } catch {
    $record.Error = $_.Exception.Message
  }

  return [pscustomobject]$record
}

function Add-WatchPath {
  param(
    [System.Collections.ArrayList]$List,
    [hashtable]$Seen,
    [string]$Path,
    [string]$Label,
    [string]$Group
  )

  if ([string]::IsNullOrWhiteSpace($Path)) {
    return
  }

  try {
    $fullPath = [System.IO.Path]::GetFullPath($Path)
  } catch {
    return
  }

  $key = $fullPath.ToLowerInvariant()
  if ($Seen.ContainsKey($key)) {
    return
  }

  $Seen[$key] = $true
  [void]$List.Add([ordered]@{
    Path = $fullPath
    Label = $Label
    Group = $Group
  })
}

function Invoke-InstallTask {
  $scriptPath = $PSCommandPath
  if ([string]::IsNullOrWhiteSpace($scriptPath)) {
    throw 'Cannot install the task because the script path is unknown.'
  }

  $argumentParts = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', (Quote-TaskArgument $scriptPath),
    '-Mode', 'Snapshot',
    '-Drive', $Drive,
    '-LogDir', (Quote-TaskArgument $LogDir),
    '-MaxChangedRows', $MaxChangedRows
  )

  if ($IncludeBroadRoots) {
    $argumentParts += '-IncludeBroadRoots'
  }

  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ($argumentParts -join ' ')
  $trigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::Parse($At))
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description 'Daily C drive usage snapshot and change report.' -Force | Out-Null

  Write-Output "Installed scheduled task '$TaskName' at $At."
}

function Invoke-UninstallTask {
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($null -eq $task) {
    Write-Output "Scheduled task '$TaskName' was not found."
    return
  }

  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Output "Removed scheduled task '$TaskName'."
}

if ($Mode -eq 'InstallTask') {
  Invoke-InstallTask
  return
}

if ($Mode -eq 'UninstallTask') {
  Invoke-UninstallTask
  return
}

$driveRoot = Normalize-DriveRoot $Drive
$driveInfo = New-Object System.IO.DriveInfo($driveRoot)
if (-not $driveInfo.IsReady) {
  throw "Drive is not ready: $driveRoot"
}

$snapshotDir = Join-Path $LogDir 'snapshots'
New-Item -ItemType Directory -Force -Path $snapshotDir | Out-Null

$timestamp = Get-Date
$stamp = $timestamp.ToString('yyyyMMdd-HHmmss')
$snapshotPath = Join-Path $snapshotDir "snapshot-$stamp.json"
$latestPath = Join-Path $LogDir 'latest-snapshot.json'
$summaryPath = Join-Path $LogDir 'latest-summary.txt'
$reportPath = Join-Path $LogDir 'latest-report.txt'
$csvPath = Join-Path $LogDir 'daily-summary.csv'

$watchList = New-Object System.Collections.ArrayList
$seenPaths = @{}

$userProfile = $env:USERPROFILE
if ([string]::IsNullOrWhiteSpace($userProfile)) {
  $userProfile = Join-Path $driveRoot 'Users'
}

Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot '$RECYCLE.BIN') 'Recycle Bin' 'system-cache'
Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot '$SysReset') 'Windows reset leftovers' 'system-cache'
Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'pagefile.sys') 'Page file' 'system-managed'
Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'hiberfil.sys') 'Hibernate file' 'system-managed'
Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'swapfile.sys') 'Swap file' 'system-managed'
Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'Windows\MEMORY.DMP') 'Kernel memory dump' 'crash-dump'

Add-WatchPath $watchList $seenPaths (Join-Path $userProfile 'Desktop') 'Desktop' 'user'
Add-WatchPath $watchList $seenPaths (Join-Path $userProfile 'Documents') 'Documents' 'user'
Add-WatchPath $watchList $seenPaths (Join-Path $userProfile 'Downloads') 'Downloads' 'user'
Add-WatchPath $watchList $seenPaths (Join-Path $userProfile 'Pictures') 'Pictures' 'user'
Add-WatchPath $watchList $seenPaths (Join-Path $userProfile 'Videos') 'Videos' 'user'
Add-WatchPath $watchList $seenPaths (Join-Path $userProfile '.cache') 'User .cache' 'user-cache'
Add-WatchPath $watchList $seenPaths (Join-Path $userProfile 'AppData\Local\Temp') 'User temp' 'user-cache'
Add-WatchPath $watchList $seenPaths (Join-Path $userProfile 'AppData\Local\CrashDumps') 'User crash dumps' 'crash-dump'
Add-WatchPath $watchList $seenPaths (Join-Path $userProfile 'AppData\Local\Packages') 'User app packages' 'appdata'
Add-WatchPath $watchList $seenPaths (Join-Path $userProfile 'AppData\Local\Microsoft\Edge\User Data') 'Edge user data' 'browser'
Add-WatchPath $watchList $seenPaths (Join-Path $userProfile 'AppData\Local\Microsoft\OneDrive') 'OneDrive local app data' 'appdata'
Add-WatchPath $watchList $seenPaths (Join-Path $userProfile 'AppData\Local\NVIDIA') 'NVIDIA user cache' 'gpu-cache'
Add-WatchPath $watchList $seenPaths (Join-Path $userProfile 'AppData\Local\NVIDIA\DXCache') 'NVIDIA DXCache' 'gpu-cache'
Add-WatchPath $watchList $seenPaths (Join-Path $userProfile 'AppData\Local\OpenAI') 'OpenAI local app data' 'appdata'
Add-WatchPath $watchList $seenPaths (Join-Path $userProfile 'AppData\Roaming\Adobe') 'Adobe roaming data' 'appdata'

Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'Windows\Panther') 'Windows setup logs' 'system-cache'
Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'Windows\Logs') 'Windows logs' 'system-cache'
Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'Windows\SoftwareDistribution\Download') 'Windows Update downloads' 'system-cache'
Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'Windows\Temp') 'Windows temp' 'system-cache'
Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'Windows\Minidump') 'Windows minidump' 'crash-dump'
Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'Windows\LiveKernelReports') 'Live kernel reports' 'crash-dump'

Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'ProgramData\NVIDIA Corporation') 'NVIDIA ProgramData' 'programdata'
Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'ProgramData\NVIDIA Corporation\NVIDIA app\UpdateFramework\ota-artifacts') 'NVIDIA update artifacts' 'gpu-cache'
Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'ProgramData\NVIDIA Corporation\NVIDIA app\UpdateFramework\ota-artifacts\crd') 'NVIDIA CRD update cache' 'gpu-cache'
Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'ProgramData\ASUS') 'ASUS ProgramData' 'programdata'
Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'ProgramData\Adobe') 'Adobe ProgramData' 'programdata'
Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'ProgramData\Package Cache') 'Package Cache' 'installer-cache'
Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'ProgramData\Microsoft\Windows\WER') 'Windows Error Reporting' 'crash-dump'
Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'ProgramData\Thunder Network') 'Thunder ProgramData' 'programdata'

$standardRootNames = @(
  '$RECYCLE.BIN',
  '$SysReset',
  'Documents and Settings',
  'PerfLogs',
  'Program Files',
  'Program Files (x86)',
  'ProgramData',
  'Recovery',
  'System Volume Information',
  'Users',
  'Windows'
)

Get-ChildItem -LiteralPath $driveRoot -Force -Directory -ErrorAction SilentlyContinue |
  Where-Object { $standardRootNames -notcontains $_.Name -and -not ($_.Attributes -band [System.IO.FileAttributes]::ReparsePoint) } |
  ForEach-Object {
    Add-WatchPath $watchList $seenPaths $_.FullName ("Root folder: " + $_.Name) 'root-folder'
  }

if ($IncludeBroadRoots) {
  Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'Users') 'Users root' 'broad-root'
  Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'ProgramData') 'ProgramData root' 'broad-root'
  Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'Program Files') 'Program Files root' 'broad-root'
  Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'Program Files (x86)') 'Program Files (x86) root' 'broad-root'
  Add-WatchPath $watchList $seenPaths (Join-Path $driveRoot 'Windows') 'Windows root' 'broad-root'
}

$watched = foreach ($watch in $watchList) {
  $size = Get-SizeRecord -Path $watch.Path
  [pscustomobject][ordered]@{
    Label = $watch.Label
    Group = $watch.Group
    Path = $size.Path
    Exists = $size.Exists
    Bytes = $size.Bytes
    GB = $size.GB
    LastWriteTime = $size.LastWriteTime
    Error = $size.Error
  }
}

$usedBytes = [int64]($driveInfo.TotalSize - $driveInfo.AvailableFreeSpace)
$freeBytes = [int64]$driveInfo.AvailableFreeSpace
$totalBytes = [int64]$driveInfo.TotalSize

$previous = $null
if (Test-Path -LiteralPath $latestPath) {
  try {
    $previous = Get-Content -LiteralPath $latestPath -Raw | ConvertFrom-Json
  } catch {
    $previous = $null
  }
}

$snapshot = [pscustomobject][ordered]@{
  Version = 1
  Timestamp = $timestamp.ToString('yyyy-MM-dd HH:mm:ss')
  TimestampUtc = $timestamp.ToUniversalTime().ToString('o')
  Drive = [pscustomobject][ordered]@{
    Root = $driveRoot
    TotalBytes = $totalBytes
    UsedBytes = $usedBytes
    FreeBytes = $freeBytes
    TotalGB = [math]::Round(($totalBytes / 1GB), 3)
    UsedGB = [math]::Round(($usedBytes / 1GB), 3)
    FreeGB = [math]::Round(($freeBytes / 1GB), 3)
  }
  Watched = @($watched)
}

$snapshot | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $snapshotPath -Encoding UTF8
$snapshot | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $latestPath -Encoding UTF8

$usedChangeBytes = $null
$freeChangeBytes = $null
$changes = @()

if ($null -ne $previous) {
  $usedChangeBytes = [int64]$snapshot.Drive.UsedBytes - [int64]$previous.Drive.UsedBytes
  $freeChangeBytes = [int64]$snapshot.Drive.FreeBytes - [int64]$previous.Drive.FreeBytes

  $previousByPath = @{}
  foreach ($item in @($previous.Watched)) {
    if ($null -ne $item.Path) {
      $previousByPath[$item.Path.ToLowerInvariant()] = $item
    }
  }

  $changes = foreach ($item in @($snapshot.Watched)) {
    $key = $item.Path.ToLowerInvariant()
    if ($previousByPath.ContainsKey($key)) {
      $old = $previousByPath[$key]
      $delta = [int64]$item.Bytes - [int64]$old.Bytes
      [pscustomobject][ordered]@{
        Label = $item.Label
        Group = $item.Group
        Path = $item.Path
        ChangeBytes = $delta
        ChangeGB = [math]::Round(($delta / 1GB), 3)
        OldGB = [math]::Round(([int64]$old.Bytes / 1GB), 3)
        NewGB = [math]::Round(([int64]$item.Bytes / 1GB), 3)
        AbsBytes = [math]::Abs($delta)
      }
    }
  }
}

if (-not (Test-Path -LiteralPath $csvPath)) {
  'Timestamp,TotalGB,UsedGB,FreeGB,UsedChangeGB,FreeChangeGB,SnapshotPath' | Set-Content -LiteralPath $csvPath -Encoding UTF8
}

$usedChangeGbText = if ($null -eq $usedChangeBytes) { '' } else { [math]::Round(($usedChangeBytes / 1GB), 3) }
$freeChangeGbText = if ($null -eq $freeChangeBytes) { '' } else { [math]::Round(($freeChangeBytes / 1GB), 3) }
$csvLine = '"' + $snapshot.Timestamp + '",' + $snapshot.Drive.TotalGB + ',' + $snapshot.Drive.UsedGB + ',' + $snapshot.Drive.FreeGB + ',' + $usedChangeGbText + ',' + $freeChangeGbText + ',"' + $snapshotPath + '"'
Add-Content -LiteralPath $csvPath -Value $csvLine -Encoding UTF8

$lines = New-Object System.Collections.ArrayList
[void]$lines.Add('C Drive Daily Monitor')
[void]$lines.Add(('Time: ' + $snapshot.Timestamp))
[void]$lines.Add(('Drive: ' + $snapshot.Drive.Root))
[void]$lines.Add(('Total GB: ' + $snapshot.Drive.TotalGB))
[void]$lines.Add(('Used GB: ' + $snapshot.Drive.UsedGB))
[void]$lines.Add(('Free GB: ' + $snapshot.Drive.FreeGB))

if ($null -ne $usedChangeBytes) {
  [void]$lines.Add(('Used change since previous snapshot GB: ' + [math]::Round(($usedChangeBytes / 1GB), 3)))
  [void]$lines.Add(('Free change since previous snapshot GB: ' + [math]::Round(($freeChangeBytes / 1GB), 3)))
} else {
  [void]$lines.Add('No previous snapshot found. This run is the baseline.')
}

[void]$lines.Add('')
[void]$lines.Add('Largest watched paths now:')
@($snapshot.Watched | Where-Object { $_.Exists } | Sort-Object Bytes -Descending | Select-Object -First $MaxChangedRows) |
  ForEach-Object {
    [void]$lines.Add(('{0,9:N3} GB  [{1}] {2}  {3}' -f $_.GB, $_.Group, $_.Label, $_.Path))
  }

if ($changes.Count -gt 0) {
  [void]$lines.Add('')
  [void]$lines.Add('Largest changes since previous snapshot:')
  @($changes | Where-Object { $_.AbsBytes -ge 1MB } | Sort-Object AbsBytes -Descending | Select-Object -First $MaxChangedRows) |
    ForEach-Object {
      [void]$lines.Add(('{0,9:N3} GB  {1:N3} -> {2:N3} GB  [{3}] {4}  {5}' -f $_.ChangeGB, $_.OldGB, $_.NewGB, $_.Group, $_.Label, $_.Path))
    }
}

[void]$lines.Add('')
[void]$lines.Add('Note: watched path sizes can overlap. Use changes as hints, not as a sum.')
[void]$lines.Add(('Snapshot: ' + $snapshotPath))
[void]$lines.Add(('CSV: ' + $csvPath))

$summaryLines = New-Object System.Collections.ArrayList
[void]$summaryLines.Add('C Drive Daily Monitor')
[void]$summaryLines.Add(('Time: ' + $snapshot.Timestamp))
[void]$summaryLines.Add(('Drive: ' + $snapshot.Drive.Root))
[void]$summaryLines.Add(('Total GB: ' + $snapshot.Drive.TotalGB))
[void]$summaryLines.Add(('Used GB: ' + $snapshot.Drive.UsedGB))
[void]$summaryLines.Add(('Free GB: ' + $snapshot.Drive.FreeGB))

if ($null -ne $usedChangeBytes) {
  [void]$summaryLines.Add(('Used change since previous snapshot GB: ' + [math]::Round(($usedChangeBytes / 1GB), 3)))
  [void]$summaryLines.Add(('Free change since previous snapshot GB: ' + [math]::Round(($freeChangeBytes / 1GB), 3)))
} else {
  [void]$summaryLines.Add('No previous snapshot found. This run is the baseline.')
}

@($changes | Where-Object { $_.AbsBytes -ge 1MB } | Sort-Object AbsBytes -Descending | Select-Object -First 8) |
  ForEach-Object {
    [void]$summaryLines.Add(('{0,9:N3} GB  {1:N3} -> {2:N3} GB  [{3}] {4}' -f $_.ChangeGB, $_.OldGB, $_.NewGB, $_.Group, $_.Label))
  }

[void]$summaryLines.Add(('Snapshot: ' + $snapshotPath))
[void]$summaryLines.Add(('CSV: ' + $csvPath))

$summaryLines | Set-Content -LiteralPath $summaryPath -Encoding UTF8
$lines | Set-Content -LiteralPath $reportPath -Encoding UTF8
if ($SummaryOnly) {
  $summaryLines | ForEach-Object { Write-Output $_ }
} else {
  $lines | ForEach-Object { Write-Output $_ }
}
