import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8, unzipSync } from 'fflate';

if (process.argv.includes('--child')) {
  const original = Buffer.from(zipSync({ 'SKILL.md': strToU8('# test') }));
  const endOffset = original.length - 22;
  const end = original.subarray(endOffset);
  const zip64End = Buffer.alloc(56);
  zip64End.writeUInt32LE(0x06064b50, 0);
  zip64End.writeBigUInt64LE(44n, 4);
  zip64End.writeUInt16LE(45, 12);
  zip64End.writeUInt16LE(45, 14);
  zip64End.writeBigUInt64LE(1n, 24);
  zip64End.writeBigUInt64LE(1n, 32);
  zip64End.writeBigUInt64LE(BigInt(end.readUInt32LE(12)), 40);
  zip64End.writeBigUInt64LE(BigInt(end.readUInt32LE(16)), 48);
  const locator = Buffer.alloc(20);
  locator.writeUInt32LE(0x07064b50, 0);
  locator.writeBigUInt64LE(BigInt(endOffset), 8);
  locator.writeUInt32LE(1, 16);
  const zip = Buffer.concat([original.subarray(0, endOffset), zip64End, locator, end]);
  const centralDirectory = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert.ok(centralDirectory >= 0);
  assert.equal(zip.readUInt16LE(centralDirectory + 30), 0);
  zip.writeUInt32LE(0xffffffff, centralDirectory + 20);
  assert.throws(() => unzipSync(zip));
} else {
  // A vulnerable parser hangs here; isolate it so the regression has a hard deadline.
  execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--child'], { timeout: 3000, windowsHide: true });
  console.log('malformed ZIP64 rejects within deadline');
}
