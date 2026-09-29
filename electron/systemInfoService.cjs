const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function toFiniteNumber(value, fallback = 0) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function normalizeCpuInfo() {
  const cpus = Array.isArray(os.cpus()) ? os.cpus() : [];
  const firstCpu = cpus[0] || null;

  return {
    logicalCores: cpus.length,
    model: typeof firstCpu?.model === 'string' ? firstCpu.model.trim() : '',
    speedMHz: toFiniteNumber(firstCpu?.speed, 0),
  };
}

function normalizePositiveInteger(value, fallback = 0) {
  const nextValue = Math.round(Number(value));
  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : fallback;
}

function normalizeOptionalString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeMemoryInfo() {
  return {
    freeBytes: toFiniteNumber(os.freemem(), 0),
    totalBytes: toFiniteNumber(os.totalmem(), 0),
  };
}

function getWindowsSystemInfoPowerShellScript() {
  return [
    '[Console]::InputEncoding = New-Object System.Text.UTF8Encoding -ArgumentList $false',
    '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding -ArgumentList $false',
    '$OutputEncoding = [Console]::OutputEncoding',
    '$ErrorActionPreference = "Stop"',
    '$errors = New-Object System.Collections.Generic.List[string]',
    'function Read-RegistryValue($path, $name) {',
    '  try {',
    '    $item = Get-ItemProperty -LiteralPath $path -Name $name -ErrorAction Stop',
    '    return [string]$item.$name',
    '  } catch {',
    '    return ""',
    '  }',
    '}',
    '$cpu = $null',
    '$computer = $null',
    '$os = $null',
    '$gpus = @()',
    'try { $cpu = Get-CimInstance Win32_Processor -ErrorAction Stop | Select-Object -First 1 } catch { $errors.Add("Win32_Processor: " + $_.Exception.Message) | Out-Null }',
    'try { $computer = Get-CimInstance Win32_ComputerSystem -ErrorAction Stop | Select-Object -First 1 } catch { $errors.Add("Win32_ComputerSystem: " + $_.Exception.Message) | Out-Null }',
    'try { $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop | Select-Object -First 1 } catch { $errors.Add("Win32_OperatingSystem: " + $_.Exception.Message) | Out-Null }',
    'try { $gpus = @(Get-CimInstance Win32_VideoController -ErrorAction Stop) } catch { $errors.Add("Win32_VideoController: " + $_.Exception.Message) | Out-Null }',
    '$computerInfo = $null',
    'try {',
    '  Add-Type -AssemblyName Microsoft.VisualBasic -ErrorAction Stop',
    '  $computerInfo = New-Object Microsoft.VisualBasic.Devices.ComputerInfo',
    '} catch {',
    '  $errors.Add("ComputerInfo: " + $_.Exception.Message) | Out-Null',
    '}',
    '$cpuRegistryPath = "HKLM:\\HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0"',
    '$windowsRegistryPath = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion"',
    '$registryCpuName = Read-RegistryValue $cpuRegistryPath "ProcessorNameString"',
    '$registryCpuVendor = Read-RegistryValue $cpuRegistryPath "VendorIdentifier"',
    '$registryCpuMHzRaw = Read-RegistryValue $cpuRegistryPath "~MHz"',
    '$registryProductName = Read-RegistryValue $windowsRegistryPath "ProductName"',
    '$registryEditionId = Read-RegistryValue $windowsRegistryPath "EditionID"',
    '$registryDisplayVersion = Read-RegistryValue $windowsRegistryPath "DisplayVersion"',
    '$registryBuildNumber = Read-RegistryValue $windowsRegistryPath "CurrentBuildNumber"',
    '$cpuModel = ""',
    'if ($cpu -and $cpu.Name) { $cpuModel = [string]$cpu.Name } elseif ($registryCpuName) { $cpuModel = [string]$registryCpuName }',
    '$cpuManufacturer = ""',
    'if ($cpu -and $cpu.Manufacturer) { $cpuManufacturer = [string]$cpu.Manufacturer } elseif ($registryCpuVendor) { $cpuManufacturer = [string]$registryCpuVendor }',
    '$cpuPhysicalCores = 0',
    'if ($cpu -and $cpu.NumberOfCores) { $cpuPhysicalCores = [int]$cpu.NumberOfCores }',
    '$cpuLogicalCores = 0',
    'if ($cpu -and $cpu.NumberOfLogicalProcessors) { $cpuLogicalCores = [int]$cpu.NumberOfLogicalProcessors }',
    '$cpuMaxClockMHz = 0',
    'if ($cpu -and $cpu.MaxClockSpeed) { $cpuMaxClockMHz = [int]$cpu.MaxClockSpeed } elseif ($registryCpuMHzRaw) { $cpuMaxClockMHz = [int]$registryCpuMHzRaw }',
    '$computerManufacturer = ""',
    'if ($computer -and $computer.Manufacturer) { $computerManufacturer = [string]$computer.Manufacturer }',
    '$computerModel = ""',
    'if ($computer -and $computer.Model) { $computerModel = [string]$computer.Model }',
    '$totalPhysicalMemoryBytes = 0',
    'if ($computer -and $computer.TotalPhysicalMemory) { $totalPhysicalMemoryBytes = [double]$computer.TotalPhysicalMemory } elseif ($computerInfo) { $totalPhysicalMemoryBytes = [double]$computerInfo.TotalPhysicalMemory }',
    '$totalVisibleBytes = 0',
    'if ($os -and $os.TotalVisibleMemorySize) { $totalVisibleBytes = [double]$os.TotalVisibleMemorySize * 1024 } elseif ($computerInfo) { $totalVisibleBytes = [double]$computerInfo.TotalPhysicalMemory }',
    '$freePhysicalBytes = 0',
    'if ($os -and $os.FreePhysicalMemory) { $freePhysicalBytes = [double]$os.FreePhysicalMemory * 1024 } elseif ($computerInfo) { $freePhysicalBytes = [double]$computerInfo.AvailablePhysicalMemory }',
    '$osCaption = ""',
    'if ($os -and $os.Caption) { $osCaption = [string]$os.Caption } elseif ($computerInfo -and $computerInfo.OSFullName) { $osCaption = [string]$computerInfo.OSFullName } elseif ($registryProductName) { $osCaption = [string]$registryProductName }',
    '$osVersion = ""',
    'if ($os -and $os.Version) { $osVersion = [string]$os.Version } elseif ($computerInfo -and $computerInfo.OSVersion) { $osVersion = [string]$computerInfo.OSVersion }',
    '$osBuildNumber = ""',
    'if ($os -and $os.BuildNumber) { $osBuildNumber = [string]$os.BuildNumber } elseif ($registryBuildNumber) { $osBuildNumber = [string]$registryBuildNumber }',
    '$osArchitecture = ""',
    'if ($os -and $os.OSArchitecture) { $osArchitecture = [string]$os.OSArchitecture }',
    '$osInstallDate = ""',
    'if ($os -and $os.InstallDate) { $osInstallDate = [string]$os.InstallDate }',
    '$osLastBootUpTime = ""',
    'if ($os -and $os.LastBootUpTime) { $osLastBootUpTime = [string]$os.LastBootUpTime }',
    '$gpuItems = foreach ($gpu in $gpus) {',
    '  [PSCustomObject]@{',
    '    name = [string]$gpu.Name',
    '    adapterRamBytes = [double]$gpu.AdapterRAM',
    '    driverVersion = [string]$gpu.DriverVersion',
    '    videoProcessor = [string]$gpu.VideoProcessor',
    '    pnpDeviceId = [string]$gpu.PNPDeviceID',
    '  }',
    '}',
    '[PSCustomObject]@{',
    '  errors = @($errors)',
    '  cpu = [PSCustomObject]@{',
    '    model = $cpuModel',
    '    manufacturer = $cpuManufacturer',
    '    physicalCores = $cpuPhysicalCores',
    '    logicalCores = $cpuLogicalCores',
    '    maxClockMHz = $cpuMaxClockMHz',
    '  }',
    '  computer = [PSCustomObject]@{',
    '    manufacturer = $computerManufacturer',
    '    model = $computerModel',
    '    totalPhysicalMemoryBytes = $totalPhysicalMemoryBytes',
    '  }',
    '  memory = [PSCustomObject]@{',
    '    totalVisibleBytes = $totalVisibleBytes',
    '    freePhysicalBytes = $freePhysicalBytes',
    '  }',
    '  os = [PSCustomObject]@{',
    '    caption = $osCaption',
    '    displayVersion = [string]$registryDisplayVersion',
    '    editionId = [string]$registryEditionId',
    '    version = $osVersion',
    '    buildNumber = $osBuildNumber',
    '    architecture = $osArchitecture',
    '    installDate = $osInstallDate',
    '    lastBootUpTime = $osLastBootUpTime',
    '  }',
    '  gpu = $gpuItems',
    '} | ConvertTo-Json -Depth 6 -Compress',
  ].join('\n');
}

function runTemporaryPowerShellScript(script, options = {}) {
  const {
    timeout = 5000,
    maxBuffer = 1024 * 1024,
  } = options;
  const scriptPath = path.join(
    os.tmpdir(),
    `desktop-pet-system-info-${process.pid}-${Date.now()}-${Math.round(Math.random() * 100000)}.ps1`,
  );

  fs.writeFileSync(scriptPath, script, 'utf8');

  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      {
        windowsHide: true,
        encoding: 'utf8',
        timeout,
        maxBuffer,
      },
      (error, stdout, stderr) => {
        fs.unlink(scriptPath, () => {});
        if (error && !String(stdout || '').trim()) {
          error.stderr = stderr;
          reject(error);
          return;
        }

        resolve(stdout);
      },
    );
  });
}

function runWindowsSystemInfoPowerShell() {
  if (process.platform !== 'win32') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    runTemporaryPowerShellScript(
      getWindowsSystemInfoPowerShellScript(),
      {
        timeout: 8000,
        maxBuffer: 1024 * 1024,
      },
    )
      .then((stdout) => {
        try {
          resolve(JSON.parse(String(stdout || '{}').trim() || '{}'));
        } catch (parseError) {
          resolve({
            error: parseError instanceof Error ? parseError.message : String(parseError),
          });
        }
      })
      .catch((error) => {
        resolve({
          error: [
            error?.message || String(error),
            error?.stderr ? String(error.stderr).trim() : '',
          ].filter(Boolean).join(': '),
        });
      });
  });
}

function normalizeNativeGpuDevice(device) {
  if (!device || typeof device !== 'object') {
    return null;
  }

  return {
    adapterRamBytes: toFiniteNumber(device.adapterRamBytes, 0),
    deviceString: normalizeOptionalString(device.name),
    driverVersion: normalizeOptionalString(device.driverVersion),
    pnpDeviceId: normalizeOptionalString(device.pnpDeviceId),
    source: 'windows-native',
    videoProcessor: normalizeOptionalString(device.videoProcessor),
  };
}

function normalizeWindowsSystemInfo(rawInfo) {
  if (!rawInfo || typeof rawInfo !== 'object' || rawInfo.error) {
    return {
      error: normalizeOptionalString(rawInfo?.error),
    };
  }

  const cpu = rawInfo.cpu && typeof rawInfo.cpu === 'object' ? rawInfo.cpu : {};
  const computer = rawInfo.computer && typeof rawInfo.computer === 'object' ? rawInfo.computer : {};
  const memory = rawInfo.memory && typeof rawInfo.memory === 'object' ? rawInfo.memory : {};
  const osInfo = rawInfo.os && typeof rawInfo.os === 'object' ? rawInfo.os : {};
  const gpuItems = Array.isArray(rawInfo.gpu) ? rawInfo.gpu : [rawInfo.gpu].filter(Boolean);
  const errors = Array.isArray(rawInfo.errors)
    ? rawInfo.errors.map(normalizeOptionalString).filter(Boolean)
    : [];

  return {
    computer: {
      manufacturer: normalizeOptionalString(computer.manufacturer),
      model: normalizeOptionalString(computer.model),
      totalPhysicalMemoryBytes: toFiniteNumber(computer.totalPhysicalMemoryBytes, 0),
    },
    cpu: {
      logicalCores: normalizePositiveInteger(cpu.logicalCores, 0),
      manufacturer: normalizeOptionalString(cpu.manufacturer),
      maxClockMHz: normalizePositiveInteger(cpu.maxClockMHz, 0),
      model: normalizeOptionalString(cpu.model),
      physicalCores: normalizePositiveInteger(cpu.physicalCores, 0),
    },
    gpu: gpuItems
      .map(normalizeNativeGpuDevice)
      .filter(Boolean),
    memory: {
      freePhysicalBytes: toFiniteNumber(memory.freePhysicalBytes, 0),
      totalVisibleBytes: toFiniteNumber(memory.totalVisibleBytes, 0),
    },
    os: {
      architecture: normalizeOptionalString(osInfo.architecture),
      buildNumber: normalizeOptionalString(osInfo.buildNumber),
      caption: normalizeOptionalString(osInfo.caption),
      displayVersion: normalizeOptionalString(osInfo.displayVersion),
      editionId: normalizeOptionalString(osInfo.editionId),
      installDate: normalizeOptionalString(osInfo.installDate),
      lastBootUpTime: normalizeOptionalString(osInfo.lastBootUpTime),
      version: normalizeOptionalString(osInfo.version),
    },
    source: 'windows-native',
    warnings: errors,
  };
}

function mergeCpuInfo(nodeCpu, nativeInfo) {
  const nativeCpu = nativeInfo?.cpu ?? {};
  return {
    logicalCores: nativeCpu.logicalCores || nodeCpu.logicalCores,
    manufacturer: nativeCpu.manufacturer || '',
    maxClockMHz: nativeCpu.maxClockMHz || 0,
    model: nativeCpu.model || nodeCpu.model,
    physicalCores: nativeCpu.physicalCores || 0,
    speedMHz: nativeCpu.maxClockMHz || nodeCpu.speedMHz,
    source: nativeCpu.model ? 'windows-native' : 'node-os',
  };
}

function mergeMemoryInfo(nodeMemory, nativeInfo) {
  const nativeMemory = nativeInfo?.memory ?? {};
  const nativeComputer = nativeInfo?.computer ?? {};
  return {
    freeBytes: nativeMemory.freePhysicalBytes || nodeMemory.freeBytes,
    freePhysicalBytes: nativeMemory.freePhysicalBytes || 0,
    installedBytes: nativeComputer.totalPhysicalMemoryBytes || 0,
    source: nativeMemory.totalVisibleBytes || nativeComputer.totalPhysicalMemoryBytes ? 'windows-native' : 'node-os',
    totalBytes: nativeMemory.totalVisibleBytes || nativeComputer.totalPhysicalMemoryBytes || nodeMemory.totalBytes,
    totalVisibleBytes: nativeMemory.totalVisibleBytes || 0,
  };
}

function mergeOsInfo(nativeInfo) {
  const nativeOs = nativeInfo?.os ?? {};
  const captionParts = [
    nativeOs.caption || getOsVersion(),
    nativeOs.displayVersion,
  ].filter(Boolean);
  const caption = captionParts.join(' ');
  const versionParts = [
    nativeOs.version,
    nativeOs.buildNumber ? `Build ${nativeOs.buildNumber}` : '',
  ].filter(Boolean);

  return {
    arch: nativeOs.architecture || os.arch(),
    osBuildNumber: nativeOs.buildNumber || '',
    osCaption: caption,
    osInstallDate: nativeOs.installDate || '',
    osLastBootUpTime: nativeOs.lastBootUpTime || '',
    osRelease: os.release(),
    osType: os.type(),
    osVersion: versionParts.length ? versionParts.join(' ') : getOsVersion(),
    platform: process.platform,
    source: nativeOs.caption ? 'windows-native' : 'node-os',
  };
}

function mergeGpuInfo(electronGpu, nativeInfo) {
  const nativeDevices = Array.isArray(nativeInfo?.gpu) ? nativeInfo.gpu : [];
  const electronDevices = Array.isArray(electronGpu?.devices) ? electronGpu.devices : [];
  const devices = nativeDevices.length
    ? nativeDevices
    : electronDevices.map((device) => ({
        ...device,
        source: 'electron',
      }));

  return {
    ...electronGpu,
    devices,
    source: nativeDevices.length ? 'windows-native' : 'electron',
  };
}

function normalizeGpuDevice(device) {
  if (!device || typeof device !== 'object') {
    return null;
  }

  return {
    active: Boolean(device.active),
    deviceId: String(device.deviceId ?? ''),
    deviceString: String(device.deviceString ?? device.name ?? '').trim(),
    driverVendor: String(device.driverVendor ?? '').trim(),
    driverVersion: String(device.driverVersion ?? '').trim(),
    vendorId: String(device.vendorId ?? ''),
  };
}

async function getGpuInfo(app) {
  const featureStatus = typeof app?.getGPUFeatureStatus === 'function'
    ? app.getGPUFeatureStatus()
    : null;

  if (typeof app?.getGPUInfo !== 'function') {
    return {
      devices: [],
      featureStatus,
    };
  }

  try {
    const rawInfo = await app.getGPUInfo('basic');
    const rawDevices = Array.isArray(rawInfo?.gpuDevice) ? rawInfo.gpuDevice : [];

    return {
      devices: rawDevices
        .map(normalizeGpuDevice)
        .filter(Boolean),
      featureStatus,
    };
  } catch (error) {
    return {
      devices: [],
      error: error instanceof Error ? error.message : String(error),
      featureStatus,
    };
  }
}

function getOsVersion() {
  if (typeof os.version === 'function') {
    return os.version();
  }

  return '';
}

function createSystemInfoService({ app } = {}) {
  return {
    async getSystemInfo() {
      const [nativeInfo, electronGpu] = await Promise.all([
        runWindowsSystemInfoPowerShell().then(normalizeWindowsSystemInfo),
        getGpuInfo(app),
      ]);
      const osInfo = mergeOsInfo(nativeInfo);

      return {
        arch: osInfo.arch,
        computer: nativeInfo?.computer ?? null,
        cpu: mergeCpuInfo(normalizeCpuInfo(), nativeInfo),
        dataSources: {
          native: nativeInfo?.source ?? null,
          nativeError: nativeInfo?.error ?? '',
          nativeWarnings: nativeInfo?.warnings ?? [],
        },
        gpu: mergeGpuInfo(electronGpu, nativeInfo),
        memory: mergeMemoryInfo(normalizeMemoryInfo(), nativeInfo),
        nodeVersion: process.versions?.node ?? '',
        chromeVersion: process.versions?.chrome ?? '',
        electronVersion: process.versions?.electron ?? '',
        osBuildNumber: osInfo.osBuildNumber,
        osCaption: osInfo.osCaption,
        osInstallDate: osInfo.osInstallDate,
        osLastBootUpTime: osInfo.osLastBootUpTime,
        osRelease: osInfo.osRelease,
        osType: osInfo.osType,
        osVersion: osInfo.osVersion,
        platform: osInfo.platform,
        updatedAt: Date.now(),
        uptimeSeconds: Math.max(0, Math.round(toFiniteNumber(os.uptime(), 0))),
      };
    },
  };
}

module.exports = {
  createSystemInfoService,
  getWindowsSystemInfoPowerShellScript,
};
