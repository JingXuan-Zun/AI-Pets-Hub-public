const zlib = require('zlib');
const { TextDecoder } = require('util');

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const MAX_ARCHIVE_BYTES = 4 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 200;
const MAX_ENTRIES = 8;
const MAX_ENTRY_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 1536 * 1024;
const UTF8_FLAG = 0x0800;
const crcTable = Array.from({ length: 256 }, (_unused, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = (value >>> 8) ^ crcTable[(value ^ byte) & 0xff];
  return (value ^ 0xffffffff) >>> 0;
}

function toArchiveBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  throw new Error('package_archive_bytes_missing');
}

function decodeEntryName(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new Error('package_archive_entry_name_invalid');
  }
}

function validateEntryName(name) {
  if (
    !name
    || name.length > 120
    || name.includes('\\')
    || name.startsWith('/')
    || name.endsWith('/')
    || name.split('/').some((part) => !part || part === '.' || part === '..' || part.includes(':'))
  ) throw new Error('package_archive_entry_name_invalid');
}

function findEndOfCentralDirectory(archive) {
  const minimumOffset = Math.max(0, archive.length - 65_557);
  for (let offset = archive.length - 22; offset >= minimumOffset; offset -= 1) {
    if (archive.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) return offset;
  }
  throw new Error('package_archive_directory_missing');
}

function parseDirectory(archive) {
  const endOffset = findEndOfCentralDirectory(archive);
  const diskNumber = archive.readUInt16LE(endOffset + 4);
  const directoryDisk = archive.readUInt16LE(endOffset + 6);
  const diskEntries = archive.readUInt16LE(endOffset + 8);
  const totalEntries = archive.readUInt16LE(endOffset + 10);
  const directorySize = archive.readUInt32LE(endOffset + 12);
  const directoryOffset = archive.readUInt32LE(endOffset + 16);
  const commentLength = archive.readUInt16LE(endOffset + 20);
  if (
    diskNumber !== 0
    || directoryDisk !== 0
    || diskEntries !== totalEntries
    || totalEntries < 1
    || totalEntries > MAX_ENTRIES
    || endOffset + 22 + commentLength !== archive.length
    || directoryOffset + directorySize !== endOffset
  ) throw new Error('package_archive_directory_invalid');

  const entries = [];
  let offset = directoryOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > endOffset || archive.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error('package_archive_directory_invalid');
    }
    const flags = archive.readUInt16LE(offset + 8);
    const method = archive.readUInt16LE(offset + 10);
    const checksum = archive.readUInt32LE(offset + 16);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const uncompressedSize = archive.readUInt32LE(offset + 24);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const entryCommentLength = archive.readUInt16LE(offset + 32);
    const diskStart = archive.readUInt16LE(offset + 34);
    const localOffset = archive.readUInt32LE(offset + 42);
    const nextOffset = offset + 46 + nameLength + extraLength + entryCommentLength;
    if (
      nextOffset > endOffset
      || diskStart !== 0
      || (flags & ~UTF8_FLAG) !== 0
      || ![0, 8].includes(method)
      || compressedSize === 0xffffffff
      || uncompressedSize === 0xffffffff
      || uncompressedSize > MAX_ENTRY_BYTES
      || (uncompressedSize > 0 && compressedSize === 0)
      || (compressedSize > 0 && uncompressedSize / compressedSize > MAX_COMPRESSION_RATIO)
    ) throw new Error('package_archive_entry_invalid');
    const name = decodeEntryName(archive.subarray(offset + 46, offset + 46 + nameLength));
    validateEntryName(name);
    entries.push({ checksum, compressedSize, flags, localOffset, method, name, uncompressedSize });
    offset = nextOffset;
  }
  if (offset !== endOffset || new Set(entries.map((entry) => entry.name)).size !== entries.length) {
    throw new Error('package_archive_directory_invalid');
  }
  if (entries.reduce((total, entry) => total + entry.uncompressedSize, 0) > MAX_TOTAL_BYTES) {
    throw new Error('package_archive_uncompressed_limit_exceeded');
  }
  return { directoryOffset, entries };
}

function extractEntry(archive, directoryOffset, entry) {
  const offset = entry.localOffset;
  if (offset + 30 > directoryOffset || archive.readUInt32LE(offset) !== LOCAL_FILE_SIGNATURE) {
    throw new Error('package_archive_local_entry_invalid');
  }
  const flags = archive.readUInt16LE(offset + 6);
  const method = archive.readUInt16LE(offset + 8);
  const checksum = archive.readUInt32LE(offset + 14);
  const compressedSize = archive.readUInt32LE(offset + 18);
  const uncompressedSize = archive.readUInt32LE(offset + 22);
  const nameLength = archive.readUInt16LE(offset + 26);
  const extraLength = archive.readUInt16LE(offset + 28);
  const name = decodeEntryName(archive.subarray(offset + 30, offset + 30 + nameLength));
  const dataOffset = offset + 30 + nameLength + extraLength;
  const dataEnd = dataOffset + compressedSize;
  if (
    name !== entry.name
    || flags !== entry.flags
    || method !== entry.method
    || checksum !== entry.checksum
    || compressedSize !== entry.compressedSize
    || uncompressedSize !== entry.uncompressedSize
    || dataOffset > directoryOffset
    || dataEnd > directoryOffset
  ) throw new Error('package_archive_local_entry_invalid');
  const compressed = archive.subarray(dataOffset, dataEnd);
  let content;
  try {
    content = method === 0
      ? Buffer.from(compressed)
      : zlib.inflateRawSync(compressed, { maxOutputLength: MAX_ENTRY_BYTES });
  } catch {
    throw new Error('package_archive_decompression_failed');
  }
  if (content.length !== uncompressedSize || crc32(content) !== checksum) {
    throw new Error('package_archive_entry_integrity_failed');
  }
  return { content, rangeEnd: dataEnd, rangeStart: offset };
}

function extractSkillPackageArchiveEntries(value) {
  const archive = toArchiveBuffer(value);
  if (!archive.length || archive.length > MAX_ARCHIVE_BYTES) throw new Error('package_archive_size_invalid');
  const directory = parseDirectory(archive);
  const extracted = directory.entries.map((entry) => ({ entry, ...extractEntry(archive, directory.directoryOffset, entry) }));
  const ranges = extracted.map((item) => [item.rangeStart, item.rangeEnd]).sort((left, right) => left[0] - right[0]);
  for (let index = 1; index < ranges.length; index += 1) {
    if (ranges[index][0] < ranges[index - 1][1]) throw new Error('package_archive_entry_overlap');
  }
  return new Map(extracted.map((item) => [item.entry.name, item.content]));
}

module.exports = { extractSkillPackageArchiveEntries };
