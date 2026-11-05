import { useEffect, useState } from 'react';
import { listPluginPackages, type PluginPackageManifest, type PluginPackageSetting } from '../../plugins/pluginPackages';
import { readPluginSettingValues, setPluginSettingValue } from '../../plugins/pluginPackageSettings';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';

// The settings a third-party plugin declares in its plugin.json, drawn from the declaration:
// the same values the character reads and changes (settings.find / settings.set).

const INPUT = 'h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary';

function SettingRow({ manifest, onSaved, setting, value }: {
  manifest: PluginPackageManifest;
  onSaved: (key: string, value: boolean | number | string) => void;
  setting: PluginPackageSetting;
  value: boolean | number | string;
}) {
  const save = (next: boolean | number | string) => {
    setPluginSettingValue(manifest, setting.key, next);
    onSaved(setting.key, next);
  };
  return (
    <label className="block text-xs font-semibold text-foreground">
      <span className="flex items-center justify-between gap-3">
        {setting.label}
        {setting.kind === 'boolean' ? <SettingsToggleSwitch checked={value === true} label={setting.label} onChange={save} /> : null}
      </span>
      {setting.kind === 'choice' ? (
        <select value={String(value)} onChange={(event) => save(event.target.value)} className={`mt-1 ${INPUT}`}>
          {setting.choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
        </select>
      ) : setting.kind === 'number' ? (
        <input type="number" defaultValue={Number(value)} min={setting.range?.min} max={setting.range?.max}
          onBlur={(event) => {
            const number = Number(event.target.value);
            if (!Number.isFinite(number)) return;
            save(setting.range ? Math.min(setting.range.max, Math.max(setting.range.min, number)) : number);
          }}
          className={`mt-1 ${INPUT}`} />
      ) : setting.kind === 'text' ? (
        <input defaultValue={String(value)} maxLength={200} onBlur={(event) => { if (event.target.value !== value) save(event.target.value.trim()); }} className={`mt-1 ${INPUT}`} />
      ) : null}
      {setting.forModel ? <span className="mt-1 block text-2xs font-normal leading-5 text-muted-foreground">{setting.forModel}</span> : null}
    </label>
  );
}

export function SettingsPluginPackageSettings({ packageId, onChanged }: { onChanged: (message: string) => void; packageId: string }) {
  const [manifest, setManifest] = useState<PluginPackageManifest | null>(null);
  const [values, setValues] = useState<Record<string, boolean | number | string>>({});

  useEffect(() => {
    let active = true;
    void listPluginPackages().then((packages) => {
      const found = packages.find((item) => item.id === packageId) ?? null;
      if (!active) return;
      setManifest(found);
      setValues(found ? readPluginSettingValues(found) : {});
    });
    return () => { active = false; };
  }, [packageId]);

  if (!manifest?.settings?.length) return null;
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h4 className="text-xs font-bold text-foreground">设置</h4>
      <p className="mt-1 text-2xs leading-5 text-muted-foreground">也可以直接跟角色说，她会帮你改。</p>
      <div className="mt-3 space-y-3">
        {manifest.settings.map((setting) => (
          <SettingRow
            key={setting.key}
            manifest={manifest}
            setting={setting}
            value={values[setting.key] ?? setting.default}
            onSaved={(key, value) => {
              setValues((current) => ({ ...current, [key]: value }));
              onChanged(`已保存「${setting.label}」。`);
            }}
          />
        ))}
      </div>
    </section>
  );
}
