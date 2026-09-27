import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { MAX_DESKTOP_PET_SLOTS, type DesktopPetSlot } from '../../multiPetRoster';
import { toggleButtonClass } from './settingsVoiceUtils';

interface DesktopPetSlotSelectorProps {
  slots: DesktopPetSlot[];
  selectedSlotId: string;
  onAddSlot: () => void;
  onRemoveSlot: (slotId: string) => void;
  onSelectSlot: (slotId: string) => void;
  onSetSlotAutoMovementEnabled: (slotId: string, enabled: boolean) => void;
  onSetSlotModelVisible: (slotId: string, visible: boolean) => void;
  onSetSlotPointerLookEnabled: (slotId: string, enabled: boolean) => void;
  onSetSlotEnabled: (slotId: string, enabled: boolean) => void;
}

export function DesktopPetSlotSelector({
  slots,
  selectedSlotId,
  onAddSlot,
  onRemoveSlot,
  onSelectSlot,
  onSetSlotAutoMovementEnabled,
  onSetSlotModelVisible,
  onSetSlotPointerLookEnabled,
  onSetSlotEnabled,
}: DesktopPetSlotSelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId) ?? slots[0] ?? null;
  const toggleTitle = expanded
    ? '\u6536\u8d77\u5ba0\u7269\u69fd\u4f4d'
    : '\u5c55\u5f00\u5ba0\u7269\u69fd\u4f4d';
  const canAddSlot = slots.length < MAX_DESKTOP_PET_SLOTS;

  const handleToggleClick = (event: MouseEvent<HTMLButtonElement>, callback: () => void) => {
    event.stopPropagation();
    callback();
  };

  return (
    <div className="space-y-3 rounded-sm border border-border bg-secondary/15 p-4">
      <div className="rounded-sm border border-border bg-secondary/20">
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            aria-label={toggleTitle}
            title={toggleTitle}
            className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
          >
            <div className="min-w-0">
              <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                {'\u684c\u5ba0\u69fd\u4f4d'}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {'1 \u53f7\u684c\u5ba0\u56fa\u5b9a\u542f\u7528\uff0c\u70b9\u51fb\u52a0\u53f7\u53ef\u6dfb\u52a0 2-100 \u53f7\u684c\u5ba0\u3002\u6a21\u578b\u3001\u63a7\u5236\u3001\u4eba\u683c\u548c\u81ea\u52a8\u4f4d\u79fb\u90fd\u4f1a\u8ddf\u968f\u5f53\u524d\u9009\u4e2d\u7684\u69fd\u4f4d\u3002'}
              </div>
            </div>
            <span className="shrink-0 font-mono text-2xs text-primary">
              {selectedSlot ? `${selectedSlot.personality.name} // ${slots.length} \u9879` : `${slots.length} \u9879`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            aria-label={toggleTitle}
            title={toggleTitle}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-primary/60 bg-primary text-primary-foreground shadow-[0_0_14px_rgba(0,209,255,0.18)] transition-colors hover:bg-primary/85 hover:text-primary-foreground"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {expanded ? (
          <div className="grid grid-cols-2 gap-2 border-t border-border px-4 py-4 sm:grid-cols-4">
            {slots.map((slot) => {
              const isSelected = slot.id === selectedSlotId;

              return (
                <div
                  key={slot.id}
                  className={`relative rounded-sm border px-3 py-3 transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background/30 text-foreground hover:border-primary/60'
                  }`}
                >
                  <button
                    type="button"
                    disabled={slot.isPrimary}
                    aria-label={slot.isPrimary ? '1号桌宠不能删除' : `删除${slot.label}`}
                    title={slot.isPrimary ? '1号桌宠不能删除' : `删除${slot.label}`}
                    className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-sm border transition-colors ${
                      slot.isPrimary
                        ? 'cursor-not-allowed border-border/60 bg-background/20 text-muted-foreground/45'
                        : 'border-destructive/40 bg-background/70 text-destructive hover:bg-destructive/10'
                    }`}
                    onClick={(event) => handleToggleClick(event, () => {
                      onRemoveSlot(slot.id);
                    })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    className="w-full pr-7 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    onClick={() => onSelectSlot(slot.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-2xs font-bold uppercase tracking-widest">{slot.label}</div>
                        <div className="mt-1 truncate text-xs">{slot.personality.name}</div>
                        <div className="mt-1 text-2xs text-muted-foreground">
                          {slot.isPrimary
                            ? '\u4e3b\u684c\u5ba0'
                            : (slot.enabled ? '\u526f\u684c\u5ba0\u5df2\u542f\u7528' : '\u526f\u684c\u5ba0\u5df2\u505c\u7528')}
                        </div>
                        <div className="mt-1 text-2xs text-muted-foreground">
                          {slot.modelVisible ? '\u6a21\u578b\u663e\u793a\u4e2d' : '\u6a21\u578b\u5df2\u9690\u85cf'}
                        </div>
                      </div>
                      {isSelected ? (
                        <span className="shrink-0 font-mono text-3xs text-primary">
                          {'\u5f53\u524d'}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 font-mono text-2xs text-muted-foreground">
                      {'AUTO // '}
                      {slot.autoMovementEnabled ? 'ON' : 'OFF'}
                      {'  LOOK // '}
                      {slot.pointerLookEnabled ? 'ON' : 'OFF'}
                    </div>
                  </button>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={`${toggleButtonClass(slot.autoMovementEnabled)} h-8 px-2 text-3xs`}
                      onClick={(event) => handleToggleClick(event, () => {
                        onSetSlotAutoMovementEnabled(slot.id, !slot.autoMovementEnabled);
                      })}
                    >
                      {slot.autoMovementEnabled
                        ? '\u81ea\u52a8\u4f4d\u79fb ON'
                        : '\u81ea\u52a8\u4f4d\u79fb OFF'}
                    </button>
                    <button
                      type="button"
                      className={`${toggleButtonClass(slot.pointerLookEnabled)} h-8 px-2 text-3xs`}
                      onClick={(event) => handleToggleClick(event, () => {
                        onSetSlotPointerLookEnabled(slot.id, !slot.pointerLookEnabled);
                      })}
                    >
                      {slot.pointerLookEnabled
                        ? '\u89c6\u7ebf\u8ffd\u8e2a ON'
                        : '\u89c6\u7ebf\u8ffd\u8e2a OFF'}
                    </button>
                    <button
                      type="button"
                      disabled={slot.isPrimary}
                      className={`${toggleButtonClass(slot.isPrimary ? true : slot.modelVisible)} h-8 px-2 text-3xs ${
                        slot.isPrimary ? 'cursor-not-allowed opacity-70' : ''
                      }`}
                      onClick={(event) => handleToggleClick(event, () => {
                        onSetSlotModelVisible(slot.id, !slot.modelVisible);
                      })}
                    >
                      {slot.isPrimary
                        ? '\u6a21\u578b\u56fa\u5b9a\u663e\u793a'
                        : (slot.modelVisible ? '\u663e\u793a\u6a21\u578b ON' : '\u663e\u793a\u6a21\u578b OFF')}
                    </button>
                    <button
                      type="button"
                      disabled={slot.isPrimary}
                      className={`${toggleButtonClass(slot.isPrimary ? true : slot.enabled)} h-8 px-2 text-3xs ${
                        slot.isPrimary ? 'cursor-not-allowed opacity-70' : ''
                      }`}
                      onClick={(event) => handleToggleClick(event, () => {
                        onSetSlotEnabled(slot.id, !slot.enabled);
                      })}
                    >
                      {slot.isPrimary
                        ? '\u56fa\u5b9a\u542f\u7528'
                        : (slot.enabled ? '\u5df2\u542f\u7528' : '\u5df2\u505c\u7528')}
                    </button>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              disabled={!canAddSlot}
              onClick={onAddSlot}
              aria-label={canAddSlot ? '\u6dfb\u52a0\u684c\u5ba0\u69fd\u4f4d' : '\u684c\u5ba0\u69fd\u4f4d\u5df2\u8fbe\u4e0a\u9650'}
              title={canAddSlot ? '\u6dfb\u52a0\u684c\u5ba0\u69fd\u4f4d' : '\u684c\u5ba0\u69fd\u4f4d\u5df2\u8fbe\u4e0a\u9650'}
              className="flex min-h-[142px] flex-col items-center justify-center rounded-sm border border-dashed border-primary/45 bg-background/20 px-3 py-3 text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground disabled:hover:bg-background/20"
            >
              <Plus className="h-5 w-5" />
              <span className="mt-2 text-2xs font-bold uppercase tracking-widest">
                {canAddSlot ? '\u6dfb\u52a0\u684c\u5ba0' : '\u5df2\u8fbe\u4e0a\u9650'}
              </span>
              <span className="mt-1 font-mono text-2xs">
                {slots.length}/{MAX_DESKTOP_PET_SLOTS}
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
