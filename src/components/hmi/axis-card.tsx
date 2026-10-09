'use client'

import type { AxisSnapshot } from '@/lib/positioner'
import { cn } from '@/lib/utils'
import { AxisPlot } from './axis-plot'

interface AxisCardProps {
  id: string
  label: string
  data: AxisSnapshot
  drivesOn: boolean
  selected: boolean
  onSelect: () => void
  onInvert: () => void
  inverted: boolean
  manualMode: boolean
  onSetpointChange: (setpoint: number) => void
}

function status(data: AxisSnapshot, drivesOn: boolean) {
  if (!drivesOn) return { text: 'DESHABILITADO', dot: 'bg-muted-foreground' }
  if (Math.abs(data.error) > 0.5) return { text: 'EN MOVIMIENTO', dot: 'bg-signal' }
  return { text: 'EN POSICIÓN', dot: 'bg-trace' }
}

function Stat({ label, value, unit, tone }: { label: string; value: string; unit: string; tone?: string }) {
  return (
    <div className="rounded-md border border-border bg-face px-3 py-2.5">
      <dt className="font-mono text-xs tracking-widest text-muted-foreground">{label}</dt>
      <dd className={cn('mt-1 font-mono text-lg tabular-nums', tone)}>
        {value}
        <span className="ml-1 text-xs text-muted-foreground">{unit}</span>
      </dd>
    </div>
  )
}

export function AxisCard({
  id,
  label,
  data,
  drivesOn,
  selected,
  onSelect,
  onInvert,
  inverted,
  manualMode,
  onSetpointChange,
}: AxisCardProps) {
  const s = status(data, drivesOn)
  const output = Math.round(data.output)

  return (
    <article
      aria-label={`${id} ${label}`}
      onClick={onSelect}
      className={cn(
        'flex flex-col gap-4 rounded-lg border bg-panel p-4 transition-colors',
        selected ? 'border-signal' : 'border-border hover:border-muted-foreground/50',
      )}
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('size-2 rounded-full', s.dot)} aria-hidden="true" />
          <h3 className="font-mono text-base font-bold">{id}</h3>
          <span className="text-sm text-muted-foreground">{label.toUpperCase()}</span>
        </div>
        <span className="font-mono text-xs tracking-widest text-muted-foreground" aria-live="polite">
          {s.text}
        </span>
      </header>

      <AxisPlot position={data.position} setpoint={data.setpoint} label={`${id} ${label}`} />

      {manualMode && (
        <label className="flex items-center gap-2 font-mono text-sm" onClick={(e) => e.stopPropagation()}>
          <span className="text-xs tracking-widest text-muted-foreground">CONSIGNA</span>
          <input
            type="number"
            min={0}
            max={360}
            step="any"
            value={Math.round(data.setpoint * 10) / 10}
            onChange={(e) => onSetpointChange(Number(e.target.value))}
            className="h-9 w-full rounded-md border border-border bg-face px-3 font-mono tabular-nums outline-none focus:border-signal"
          />
          <span className="text-xs text-muted-foreground">°</span>
        </label>
      )}

      <div onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onInvert}
          aria-pressed={inverted}
          className={cn(
            'h-9 w-full rounded font-mono text-sm font-bold transition-colors',
            inverted
              ? 'bg-signal text-signal-foreground hover:bg-signal/90'
              : 'bg-trace text-trace-foreground hover:bg-trace/85',
          )}
        >
          {inverted ? 'INVERTIDO' : 'INVERTIR'}
        </button>
      </div>

      <dl className="grid grid-cols-3 gap-2.5">
        <Stat label="POSICIÓN" value={data.position.toFixed(2)} unit="°" tone="text-trace" />
        <Stat label="CONSIGNA" value={data.setpoint.toFixed(2)} unit="°" tone="text-signal" />
        <Stat label="ERROR" value={data.error.toFixed(2)} unit="°" />
      </dl>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between font-mono text-xs tracking-widest text-muted-foreground">
          <span id={`out-${id}`}>SALIDA PID</span>
          <span className="tabular-nums">
            {output}
            {'%'}
          </span>
        </div>
        <div
          role="meter"
          aria-labelledby={`out-${id}`}
          aria-valuemin={-100}
          aria-valuemax={100}
          aria-valuenow={output}
          className="h-1.5 overflow-hidden rounded-full bg-face"
        >
          <div
            className={cn('h-full rounded-full', output < 0 ? 'bg-trace' : 'bg-signal')}
            style={{ width: `${Math.max(2, Math.abs(data.output))}%` }}
          />
        </div>
      </div>
    </article>
  )
}
