import { useRef, useState } from 'react';
import { FileKey2, Loader2, PackagePlus, Upload } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { type AgentSkillTrustedSignatureKeyRegistry } from '../../agent';

const MAX_ARCHIVE_BYTES = 4 * 1024 * 1024;

type InstallResult = {
  error: string | null;
  identity: {
    packageId: string;
    publisherId: string;
    skillId: string;
    version: string;
  } | null;
  status: 'installed' | 'updated' | null;
};

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The selected file could not be read.'));
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsText(file, 'utf-8');
  });
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The selected package archive could not be read.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const separator = result.indexOf(',');
      if (separator < 0 || !result.slice(separator + 1)) {
        reject(new Error('The selected package archive is empty or invalid.'));
        return;
      }
      resolve(result.slice(separator + 1));
    };
    reader.readAsDataURL(file);
  });
}

function formatInstallError(error: string) {
  const messages: Record<string, string> = {
    package_archive_base64_invalid: 'The package archive is invalid or exceeds the size limit.',
    package_archive_entry_name_invalid: 'The package archive contains an unsafe entry name.',
    package_archive_entry_set_invalid: 'The package archive does not contain the required manifest and package files.',
    package_archive_identity_invalid: 'The package manifest and signed package identity do not match.',
    package_archive_skill_identity_mismatch: 'The update targets a different Skill identity.',
    package_archive_version_conflict: 'This exact package version is already installed.',
    package_archive_version_downgrade_rejected: 'Downgrade rejected: select a version newer than the installed package.',
    package_publisher_continuity_mismatch: 'Update rejected because the Publisher identity changed.',
    package_signature_trusted_key_missing: 'The signing key is not in the imported trusted Publisher key registry.',
    package_signature_verification_failed: 'The package signature could not be verified.',
    package_signing_key_migration_invalid: 'The signing key migration proof is invalid.',
    package_signing_key_migration_missing: 'The signing key changed without a dual-signature migration proof.',
    signed_archive_verified_package_invalid: 'The verified package response did not match its signed identity.',
    trusted_key_registry_invalid: 'The trusted Publisher key registry is invalid.',
  };
  return messages[error] ?? error;
}

export function SettingsAgentSkillSignedArchiveInstallerPanel({
  onImportTrustedKeyRegistryJson,
  onInstallArchive,
  trustedKeyRegistry,
}: {
  onImportTrustedKeyRegistryJson: (rawText: string) => string | null;
  onInstallArchive: (
    archiveBase64: string,
    trustedKeyRegistry: AgentSkillTrustedSignatureKeyRegistry,
  ) => Promise<InstallResult>;
  trustedKeyRegistry: AgentSkillTrustedSignatureKeyRegistry;
}) {
  const archiveInputRef = useRef<HTMLInputElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [lastResult, setLastResult] = useState<InstallResult | null>(null);

  const chooseArchive = (file: File | null) => {
    setLastResult(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.skillpkg.zip')) {
      setArchiveFile(null);
      setFeedback('Select a .skillpkg.zip package archive.');
      return;
    }
    if (!file.size || file.size > MAX_ARCHIVE_BYTES) {
      setArchiveFile(null);
      setFeedback('Package archives must be non-empty and no larger than 4 MB.');
      return;
    }
    setArchiveFile(file);
    setFeedback('Package selected. Signature verification occurs in the desktop main process.');
  };

  const importTrustedKeys = async (file: File | null) => {
    if (!file) return;
    try {
      const error = onImportTrustedKeyRegistryJson(await readFileAsText(file));
      setFeedback(error ? formatInstallError(error) : 'Trusted Publisher keys imported.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Trusted Publisher key import failed.');
    }
  };

  const installArchive = async () => {
    if (!archiveFile || busy || !trustedKeyRegistry.keys.length) return;
    setBusy(true);
    setLastResult(null);
    setFeedback('Verifying and installing signed package...');
    try {
      const result = await onInstallArchive(
        await readFileAsBase64(archiveFile),
        trustedKeyRegistry,
      );
      setLastResult(result);
      setFeedback(result.error
        ? formatInstallError(result.error)
        : `Package ${result.status === 'updated' ? 'updated' : 'installed'} with runtime disabled.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Signed package installation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <PackagePlus className="h-3 w-3 text-primary" />
          Local signed package
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          trusted keys {trustedKeyRegistry.keys.length} / runtime off
        </div>
      </div>
      <input
        ref={archiveInputRef}
        className="hidden"
        type="file"
        accept=".skillpkg.zip,application/zip"
        onChange={(event) => {
          chooseArchive(event.target.files?.[0] ?? null);
          event.target.value = '';
        }}
      />
      <input
        ref={keyInputRef}
        className="hidden"
        type="file"
        accept=".json,application/json"
        onChange={(event) => {
          void importTrustedKeys(event.target.files?.[0] ?? null);
          event.target.value = '';
        }}
      />
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 rounded-sm border border-border/60 bg-secondary/20 px-2 py-1.5">
          <div className="truncate font-mono text-3xs text-foreground">
            {archiveFile?.name ?? 'No .skillpkg.zip selected'}
          </div>
          <div className="text-3xs text-muted-foreground">
            {archiveFile ? `${Math.ceil(archiveFile.size / 1024)} KB` : 'Maximum archive size 4 MB'}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="xs" disabled={busy} onClick={() => archiveInputRef.current?.click()}>
            <Upload className="h-3 w-3" />
            Select package
          </Button>
          <Button type="button" variant="outline" size="xs" disabled={busy} onClick={() => keyInputRef.current?.click()}>
            <FileKey2 className="h-3 w-3" />
            Import keys
          </Button>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0 text-3xs text-muted-foreground">
          {lastResult?.identity ? (
            <span className="block truncate font-mono">
              {lastResult.identity.publisherId} / {lastResult.identity.skillId} / {lastResult.identity.version}
            </span>
          ) : null}
          <span className="block break-words">{feedback || 'Import trusted Publisher keys, then install a signed local package.'}</span>
        </div>
        <Button
          type="button"
          size="xs"
          disabled={!archiveFile || !trustedKeyRegistry.keys.length || busy}
          onClick={() => void installArchive()}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <PackagePlus className="h-3 w-3" />}
          {busy ? 'Installing' : 'Install'}
        </Button>
      </div>
    </div>
  );
}
