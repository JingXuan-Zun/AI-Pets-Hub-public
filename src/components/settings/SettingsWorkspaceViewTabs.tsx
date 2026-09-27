import {
  SETTINGS_WORKSPACE_VIEWS,
  type SettingsWorkspaceViewId,
} from './settingsWorkspaceView';

export function SettingsWorkspaceViewTabs(props: {
  value: SettingsWorkspaceViewId;
  onChange: (view: SettingsWorkspaceViewId) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-1.5" aria-label="工作区视图">
      {SETTINGS_WORKSPACE_VIEWS.map((view) => {
        const active = props.value === view.id;
        return <button
          key={view.id}
          type="button"
          aria-pressed={active}
          onClick={() => props.onChange(view.id)}
          className={[
            'rounded-md border px-2 py-1.5 text-center text-2xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
            active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
          ].join(' ')}
        >{view.label}</button>;
      })}
    </div>
  );
}
