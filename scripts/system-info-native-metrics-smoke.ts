import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const { systemInfoMergeSource, systemInfoScriptSource, viteEnvSource, systemRuntimeSource } = readProjectSources({
  systemInfoMergeSource: 'electron/systemInfoMerge.cjs',
  systemInfoScriptSource: 'electron/systemInfoWindowsScript.cjs',
  viteEnvSource: 'src/vite-env.d.ts',
  systemRuntimeSource: 'src/agent/agentRuntimeSystemTools.ts',
});

assert.match(
  systemInfoScriptSource,
  /Get-CimInstance Win32_Processor/u,
  'system info service should try Windows CIM CPU data',
);

assert.match(
  systemInfoScriptSource,
  /Read-RegistryValue[\s\S]*ProcessorNameString/u,
  'system info service should fall back to Windows registry data',
);

assert.match(
  systemInfoScriptSource,
  /Microsoft\.VisualBasic\.Devices\.ComputerInfo/u,
  'system info service should fall back to .NET ComputerInfo memory and OS data',
);

assert.match(
  systemInfoMergeSource,
  /mergeCpuInfo[\s\S]*physicalCores[\s\S]*mergeMemoryInfo[\s\S]*installedBytes[\s\S]*totalVisibleBytes/u,
  'system info should merge native physical cores and memory fields into the app model',
);

assert.match(
  viteEnvSource,
  /physicalCores\?: number;/u,
  'renderer system info types should include native CPU physical core count',
);

assert.match(
  viteEnvSource,
  /installedBytes\?: number;[\s\S]*totalVisibleBytes\?: number;/u,
  'renderer system info types should include native memory fields',
);

assert.match(
  viteEnvSource,
  /adapterRamBytes\?: number;/u,
  'renderer system info types should include native CPU, memory, and GPU fields',
);

assert.match(
  systemRuntimeSource,
  /sourceText[\s\S]*formatSystemInfoSource[\s\S]*dataSources\?\.native[\s\S]*cpu\?\.source/u,
  'Agent system info response should expose the data source',
);

assert.match(
  systemRuntimeSource,
  /physicalCores[\s\S]*logicalCores[\s\S]*cpuCoreText/u,
  'Agent system info response should distinguish CPU physical cores and logical threads',
);

assert.match(
  systemRuntimeSource,
  /installedMemoryText[\s\S]*visibleMemoryText[\s\S]*memoryParts/u,
  'Agent system info response should distinguish installed and visible memory',
);

assert.match(
  systemRuntimeSource,
  /formatGpuInfo[\s\S]*adapterRamBytes/u,
  'Agent system info response should include GPU memory when available',
);

console.log('system info native metrics smoke ok');
