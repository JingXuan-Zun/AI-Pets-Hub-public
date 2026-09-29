import { type SkillTimelineStripResizePreview } from './settingsSkillTimelineStripResizeDuration';

function createPreviewLabelClass(leftPercent: number) {
  if (leftPercent < 10) {
    return 'translate-x-0';
  }
  if (leftPercent > 90) {
    return '-translate-x-full';
  }
  return '-translate-x-1/2';
}

function createPreviewTone(preview: SkillTimelineStripResizePreview) {
  return preview.isAtMinimum
    ? {
        label: 'bg-amber-500 text-amber-950',
        line: 'border-amber-400',
        range: 'border-amber-400/70 bg-amber-400/15',
      }
    : {
        label: 'bg-primary text-primary-foreground',
        line: 'border-primary',
        range: 'border-primary/70 bg-primary/15',
      };
}

export function SettingsSkillTimelineResizePreview({
  preview,
}: {
  preview: SkillTimelineStripResizePreview;
}) {
  const tone = createPreviewTone(preview);
  const label = preview.isAtMinimum ? `min ${preview.label}` : preview.label;

  return (
    <>
      <div
        className={`pointer-events-none absolute inset-y-1 z-10 rounded-sm border border-dashed ${tone.range}`}
        style={{ left: `${preview.leftPercent}%`, width: `${preview.widthPercent}%` }}
      />
      <div className="pointer-events-none absolute inset-y-0 z-20" style={{ left: `${preview.rightPercent}%` }}>
        <div className={`absolute inset-y-0 border-l ${tone.line}`} />
        <div className={`absolute bottom-1 h-1.5 w-1.5 -translate-x-1/2 rounded-full border ${tone.line} bg-background`} />
        <div className={`absolute -top-5 rounded-sm px-1 py-0.5 font-mono text-3xs shadow-sm ${tone.label} ${createPreviewLabelClass(preview.rightPercent)}`}>
          {label}
        </div>
      </div>
    </>
  );
}
