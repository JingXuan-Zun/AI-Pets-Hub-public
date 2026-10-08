import type { CSSProperties } from 'react';

interface SettingsToggleSwitchProps {
  checked: boolean;
  className?: string;
  disabled?: boolean;
  /** Show only the switch; the label is still read by screen readers. */
  hideLabel?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  style?: CSSProperties;
}

export function SettingsToggleSwitch(props: SettingsToggleSwitchProps) {
  return (
    <button
      aria-checked={props.checked}
      aria-label={props.label}
      className={`group flex shrink-0 items-center gap-2 rounded-full text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50 ${props.className ?? ''}`}
      disabled={props.disabled}
      role="switch"
      style={props.style}
      type="button"
      onClick={() => props.onChange(!props.checked)}
    >
      {props.hideLabel ? null : <span>{props.label}</span>}
      <span className={`relative inline-block h-5 w-9 shrink-0 rounded-full shadow-inner transition-colors ${props.checked ? 'bg-primary' : 'bg-slate-300'}`}>
        <span className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform ${props.checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </span>
    </button>
  );
}
