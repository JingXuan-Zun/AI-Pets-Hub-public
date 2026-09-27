import { useMemo, useState } from 'react';
import {
  DEFAULT_SETTINGS_RUNTIME_LOG_LEVELS,
  DEFAULT_SETTINGS_RUNTIME_LOG_SOURCES,
  filterSettingsRuntimeLogs,
  SETTINGS_RUNTIME_LOG_LEVEL_OPTIONS,
  SETTINGS_RUNTIME_LOG_SOURCE_OPTIONS,
  type SettingsRuntimeLogLevel,
  type SettingsRuntimeLogOption,
  type SettingsRuntimeLogSource,
} from './settingsWorkspaceLogFilter';

interface SettingsWorkspaceLogViewerProps {
  logs: readonly string[];
}

function toggleOption<TValue extends string>(values: readonly TValue[], value: TValue) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function LogFilterGroup<TValue extends string>({
  label,
  onToggle,
  options,
  selectedValues,
}: {
  label: string;
  onToggle: (value: TValue) => void;
  options: readonly SettingsRuntimeLogOption<TValue>[];
  selectedValues: readonly TValue[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-2 text-xs font-bold text-muted-foreground">{label}</span>
      {options.map((option) => {
        const selected = selectedValues.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(option.value)}
            className={[
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              selected
                ? 'border-primary/60 bg-primary/15 text-primary'
                : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
            ].join(' ')}
          >
            {selected ? '✓ ' : ''}{option.label}
          </button>
        );
      })}
    </div>
  );
}

export function SettingsWorkspaceLogViewer({ logs }: SettingsWorkspaceLogViewerProps) {
  const [selectedLevels, setSelectedLevels] = useState<SettingsRuntimeLogLevel[]>([...DEFAULT_SETTINGS_RUNTIME_LOG_LEVELS]);
  const [selectedSources, setSelectedSources] = useState<SettingsRuntimeLogSource[]>([...DEFAULT_SETTINGS_RUNTIME_LOG_SOURCES]);
  const visibleLogs = useMemo(
    () => filterSettingsRuntimeLogs(logs, selectedLevels, selectedSources).slice(0, 80),
    [logs, selectedLevels, selectedSources],
  );

  return (
    <section className="flex min-h-[300px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div>
          <h2 className="text-sm font-bold text-foreground">运行日志</h2>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            显示 {visibleLogs.length} / {logs.length} 条；默认只显示需要处理的日志。
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedLevels([...SETTINGS_RUNTIME_LOG_LEVEL_OPTIONS.map((option) => option.value)]);
            setSelectedSources([...SETTINGS_RUNTIME_LOG_SOURCE_OPTIONS.map((option) => option.value)]);
          }}
          className="rounded-md border border-border px-2.5 py-1.5 text-2xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          显示全部
        </button>
      </div>

      <div className="space-y-3 border-b border-border bg-muted/20 px-3 py-3">
        <LogFilterGroup
          label="级别"
          options={SETTINGS_RUNTIME_LOG_LEVEL_OPTIONS}
          selectedValues={selectedLevels}
          onToggle={(value) => setSelectedLevels((current) => toggleOption(current, value))}
        />
        <LogFilterGroup
          label="来源"
          options={SETTINGS_RUNTIME_LOG_SOURCE_OPTIONS}
          selectedValues={selectedSources}
          onToggle={(value) => setSelectedSources((current) => toggleOption(current, value))}
        />
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3 font-mono text-2xs leading-relaxed text-muted-foreground">
        {visibleLogs.length > 0 ? (
          visibleLogs.map((entry, index) => (
            <div key={index + '-' + entry.line} className="border-l-2 border-border pl-2 [&:not(:last-child)]:mb-1.5">
              <span className="mr-1 text-primary">[{entry.level.toUpperCase()}]</span>
              <span className="mr-1 text-foreground/75">[{entry.source}]</span>
              {entry.line}
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-border p-3 text-center text-2xs text-muted-foreground">
            没有符合当前筛选条件的日志。
          </div>
        )}
      </div>
    </section>
  );
}
