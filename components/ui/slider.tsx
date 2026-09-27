import * as React from "react"

import { cn } from "@/lib/utils"

interface SliderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  className?: string
  accentColor?: string
  defaultValue?: number[]
  markers?: number[]
  value?: number[]
  min?: number
  max?: number
  step?: number
  onValueChange?: (value: number[]) => void
  onValueCommit?: (value: number[]) => void
}

function Slider({
  className,
  accentColor,
  defaultValue,
  markers,
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  onValueCommit,
  style,
  ...props
}: SliderProps) {
  const isControlled = Array.isArray(value)
  const [internalValue, setInternalValue] = React.useState<number[]>(
    defaultValue && defaultValue.length > 0 ? defaultValue : [min]
  )

  const currentValue = isControlled ? value : internalValue
  const sliderValue = currentValue?.[0] ?? min
  const progress = ((sliderValue - min) / (max - min || 1)) * 100
  const normalizedMarkers = Array.isArray(markers)
    ? markers
        .filter((marker) => Number.isFinite(marker) && marker >= min && marker <= max)
        .sort((left, right) => left - right)
    : []

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = [Number(event.target.value)]
    if (!isControlled) {
      setInternalValue(nextValue)
    }
    onValueChange?.(nextValue)
  }
  const handleCommit = (event: React.SyntheticEvent<HTMLInputElement>) => {
    onValueCommit?.([Number(event.currentTarget.value)])
  }

  const sliderStyle = accentColor
    ? { ...style, "--slider-accent-color": accentColor } as React.CSSProperties
    : style

  return (
    <div className={cn("relative flex w-full items-center py-1", className)} style={sliderStyle} {...props}>
      <div className="absolute left-0 right-0 h-1 rounded-full bg-muted" />
      <div
        className="absolute left-0 h-1 rounded-full bg-[var(--slider-accent-color,var(--primary))]"
        style={{ width: `${progress}%` }}
      />
      {normalizedMarkers.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-[1] h-1 -translate-y-1/2">
          {normalizedMarkers.map((marker) => {
            const markerProgress = ((marker - min) / (max - min || 1)) * 100
            const isActive = sliderValue >= marker

            return (
              <div
                key={marker}
                className={cn(
                  "absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-sm",
                  isActive
                    ? "border-[var(--slider-accent-color,var(--primary))] bg-[var(--slider-accent-color,var(--primary))]"
                    : "border-border/80 bg-background/95"
                )}
                style={{ left: `${markerProgress}%` }}
              />
            )
          })}
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={sliderValue}
        onChange={handleChange}
        onBlur={handleCommit}
        onKeyUp={handleCommit}
        onPointerUp={handleCommit}
        className="relative z-10 h-5 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[var(--slider-accent-color,var(--ring))] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow [&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-[var(--slider-accent-color,var(--ring))] [&::-moz-range-thumb]:bg-white"
      />
    </div>
  )
}

export { Slider }
