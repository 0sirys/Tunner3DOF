'use client'

import type { AxisSnapshot } from '@/lib/positioner'
import { cn } from '@/lib/utils'
import { AxisDial } from './axis-dial'

interface AxisCardProps {
  id: string
  label: string
  data: AxisSnapshot
  drivesOn: boolean
  selected: boolean
  onSelect: () => void
  onNudgeZero: (delta: number) => void
  onZeroHere: () => void
  onResetZero: () => void
  onZeroChange: (zero: number) => void
  manualMode: boolean
  onSetpointChange: (setpoint: number) => void
}

function status(data: AxisSnapshot, drivesOn: boolean) {
  if (!drivesOn) return { text: 'DESHABILITADO', dot: 'bg-muted-foreground' }
  if (Math.abs(data.velocity) > 1 || Math.abs(data.error) > 0.5) return { text: 'EN MOVIMIENTO', dot: 'bg-signal' }
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

const bezelBtn =
  'h-9 rounded border border-border bg-panel font-mono text-sm transition-colors hover:border-muted-foreground disabled:cursor-default disabled:opacity-40 disabled:hover:border-border'

export function AxisCard({
  id,
  label,
  data,
  drivesOn,
  selected,
  onSelect,
  onNudgeZero,
  onZeroHere,
  onResetZero,
  onZeroChange,
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

      <AxisDial
        position={data.position}
        setpoint={data.setpoint}
        zero={data.zero}
        label={`${id} ${label}`}
        onZeroChange={onZeroChange}
        manualMode={manualMode}
        onSetpointChange={onSetpointChange}
      />

      <div className="flex flex-col gap-2.5 rounded-md border border-border bg-face p-2.5">
        <div className="flex items-baseline justify-between px-1">
          <span className="font-mono text-xs tracking-widest text-muted-foreground">BISEL · CERO</span>
          <span className="font-mono text-sm tabular-nums">
            {data.zero.toFixed(1)}
            {'° '}
            <span className="text-muted-foreground">abs</span>
          </span>
        </div>
        <div className="grid grid-cols-[1fr_1fr_2fr_auto] gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button type="button" className={bezelBtn} onClick={() => onNudgeZero(-1)}>
            {'−1°'}
          </button>
          <button type="button" className={bezelBtn} onClick={() => onNudgeZero(1)}>
            {'+1°'}
          </button>
          <button
            type="button"
            onClick={onZeroHere}
            className="h-9 rounded bg-trace font-mono text-sm font-bold text-trace-foreground transition-colors hover:bg-trace/85"
          >
            CERO AQUÍ
          </button>
          <button
            type="button"
            className={cn(bezelBtn, 'px-2.5 text-xs')}
            onClick={onResetZero}
            disabled={data.zero === 0}
          >
            RST
            <span className="sr-only"> cero del bisel</span>
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2.5">
        <Stat label="POSICIÓN" value={data.position.toFixed(2)} unit="°" tone="text-trace" />
        <Stat label="CONSIGNA" value={data.setpoint.toFixed(2)} unit="°" tone="text-signal" />
        <Stat label="ERROR" value={data.error.toFixed(2)} unit="°" />
        <Stat label="VELOCIDAD" value={data.velocity.toFixed(1)} unit="°/s" />
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
