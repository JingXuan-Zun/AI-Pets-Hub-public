import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootstrapMarketplaceProduction } from './marketplace-production-bootstrap.mjs';
import { bootstrapFirstMarketplacePublisher } from './marketplace-first-publisher-bootstrap.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-first-publisher-smoke-'));
try {
  bootstrapMarketplaceProduction({
    catalogDays: 60,
    catalogUrl: 'https://example.com/v1/publishers.json',
    now: () => Date.parse('2026-07-29T00:00:00.000Z'),
    outputDirectory: tempRoot,
    rootKeyId: 'first-publisher-smoke-root-v1',
  });
  const result = bootstrapFirstMarketplacePublisher({
    catalogDays: 60,
    marketplaceDirectory: tempRoot,
    now: () => Date.parse('2026-07-30T00:00:00.000Z'),
  });
  assert.equal(result.lifecycleStatus, 'passed');
  assert.equal(result.catalogSequence, 2);
  assert.equal(result.marketReleaseAllowed, false);
  assert.equal(result.publisherId, 'ai-desktop-pet.official');
  assert.match(result.activeKeyFingerprint, /^[a-f0-9]{64}$/u);

  const publisherRoot = path.join(tempRoot, 'publishers', result.publisherId);
  const reportText = fs.readFileSync(
    path.join(publisherRoot, 'reports', 'first-publisher-lifecycle-report.json'),
    'utf8',
  );
  const report = JSON.parse(reportText);
  assert.equal(report.lifecycle.install.status, 'installed');
  assert.equal(report.lifecycle.update.status, 'updated');
  assert.equal(report.lifecycle.downgrade.rejected, true);
  assert.equal(report.lifecycle.keyMigration.status, 'verified');
  assert.equal(report.lifecycle.uninstall.status, 'succeeded');
  assert.equal(report.lifecycle.uninstallRollback.status, 'succeeded');
  assert.equal(report.marketReleaseAllowed, false);
  assert.equal(reportText.includes('PRIVATE KEY'), false);
  assert.equal(reportText.includes(tempRoot), false);

  const candidate = JSON.parse(fs.readFileSync(
    path.join(tempRoot, 'publish-candidate', 'v1', 'publishers.json'),
    'utf8',
  ));
  assert.equal(candidate.catalog.sequence, 2);
  assert.equal(candidate.catalog.publishers.length, 1);
  assert.equal(candidate.catalog.publishers[0].keyId, result.activeKeyId);
  assert.equal(candidate.catalog.publishers[0].keyFingerprint, result.activeKeyFingerprint);

  const packageFiles = fs.readdirSync(path.join(publisherRoot, 'packages'));
  assert.deepEqual(packageFiles.sort(), [
    'downgrade-1.0.5.skillpkg.zip',
    'install-1.0.0.skillpkg.zip',
    'migration-2.0.0.skillpkg.zip',
    'update-1.1.0.skillpkg.zip',
  ]);
  assert.throws(() => bootstrapFirstMarketplacePublisher({ marketplaceDirectory: tempRoot }), /Refusing to overwrite/u);
  console.log('agent skill marketplace first publisher bootstrap smoke passed');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}
