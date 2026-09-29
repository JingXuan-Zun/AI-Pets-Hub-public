import { Pause, Play } from 'lucide-react';
import {
  lifeCompanionRuntimeOverrideStore,
  useLifeCompanionRuntimeOverride,
} from '../../life-companion/lifeCompanionRuntimeOverride';
import { toggleButtonClass } from './settingsVoiceUtils';

function formatSuspendedAt(value: number | null) {
  if (!value) {
    return 'not paused';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SettingsLifeCompanionRuntimeControls() {
  const override = useLifeCompanionRuntimeOverride();
  const Icon = override.manualSuspended ? Play : Pause;

  return (
    <div className="mb-3 grid grid-cols-[auto_1fr] items-center gap-2">
      <button
        type="button"
        className={toggleButtonClass(!override.manualSuspended)}
        onClick={() => lifeCompanionRuntimeOverrideStore.setManualSuspended(!override.manualSuspended)}
        title={override.manualSuspended ? 'Resume proactive companion' : 'Pause proactive companion'}
      >
        <span className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5" />
          {override.manualSuspended ? 'Resume' : 'Pause'}
        </span>
      </button>
      <div className="truncate font-mono text-2xs text-muted-foreground">
        {override.manualSuspended ? `paused ${formatSuspendedAt(override.manualSuspendedAt)}` : 'runtime active'}
      </div>
    </div>
  );
}
