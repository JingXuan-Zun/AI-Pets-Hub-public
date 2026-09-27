function encodeUnsigned(value) {
  const bytes = [];
  let remaining = value >>> 0;
  do {
    let byte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining) byte |= 0x80;
    bytes.push(byte);
  } while (remaining);
  return bytes;
}

function encodeSignedPositive(value) {
  const bytes = [];
  let remaining = value;
  let more = true;
  while (more) {
    let byte = remaining & 0x7f;
    remaining = Math.floor(remaining / 128);
    more = !(remaining === 0 && (byte & 0x40) === 0);
    if (more) byte |= 0x80;
    bytes.push(byte);
  }
  return bytes;
}

function encodeString(value) {
  const bytes = [...Buffer.from(value, 'utf8')];
  return [...encodeUnsigned(bytes.length), ...bytes];
}

function section(id, payload) {
  return [id, ...encodeUnsigned(payload.length), ...payload];
}

function functionBody(instructions) {
  const body = [0, ...instructions, 0x0b];
  return [...encodeUnsigned(body.length), ...body];
}

function createCapabilityRequestWasmBase64(capabilityRequest) {
  const requestBytes = [...Buffer.from(JSON.stringify(capabilityRequest), 'utf8')];
  const requestOffset = 1024;
  const runBody = functionBody([
    0x41, ...encodeSignedPositive(requestOffset),
    0xad,
    0x42, 0x20,
    0x86,
    0x42, ...encodeSignedPositive(requestBytes.length),
    0x84,
  ]);
  const resumeBody = functionBody([
    0x20, 0x00,
    0xad,
    0x42, 0x20,
    0x86,
    0x20, 0x01,
    0xad,
    0x84,
  ]);
  const moduleBytes = [
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ...section(1, [0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7e]),
    ...section(3, [0x02, 0x00, 0x00]),
    ...section(5, [0x01, 0x01, 0x01, 0x01]),
    ...section(7, [
      0x03,
      ...encodeString('memory'), 0x02, 0x00,
      ...encodeString('run'), 0x00, 0x00,
      ...encodeString('resume'), 0x00, 0x01,
    ]),
    ...section(10, [0x02, ...runBody, ...resumeBody]),
    ...section(11, [
      0x01,
      0x00,
      0x41, ...encodeSignedPositive(requestOffset), 0x0b,
      ...encodeUnsigned(requestBytes.length), ...requestBytes,
    ]),
  ];
  return Buffer.from(moduleBytes).toString('base64');
}

module.exports = { createCapabilityRequestWasmBase64 };
