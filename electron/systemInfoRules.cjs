function toFiniteNumber(value, fallback = 0) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function normalizePositiveInteger(value, fallback = 0) {
  const nextValue = Math.round(Number(value));
  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : fallback;
}

function normalizeOptionalString(value) {
  return typeof value === 'string' ? value.trim() : '';
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

module.exports = {
  toFiniteNumber,
  normalizePositiveInteger,
  normalizeOptionalString,
  normalizeNativeGpuDevice,
  normalizeGpuDevice,
};
