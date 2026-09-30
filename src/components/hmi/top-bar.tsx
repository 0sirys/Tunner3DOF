'use client'

import { Activity, Crosshair, Power } from 'lucide-react'
import type { Mode } from '@/lib/positioner'
import { cn } from '@/lib/utils'

function SawIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path d="M2 18 L8 6 L8 18 L14 6 L14 18 L20 6 L20 18" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

const MODES: { id: Mode; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'sine', label: 'SINE', Icon: Activity },
  { id: 'saw', label: 'SAW', Icon: SawIcon },
  { id: 'manual', label: 'MANUAL', Icon: Crosshair },
]

interface TopBarProps {
  time: number
  mode: Mode
  onModeChange: (mode: Mode) => void
  drivesOn: boolean
  onDrivesToggle: () => void
}

export function TopBar({ time, mode, onModeChange, drivesOn, onDrivesToggle }: TopBarProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2 md:px-4">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-md border border-border bg-panel font-mono text-sm font-bold text-signal">
          3X
        </div>
        <div className="leading-tight">
          <h1 className="text-base font-bold tracking-wide">POSICIONADOR 3 EJES</h1>
          <p className="font-mono text-xs text-muted-foreground">
            {'HMI · PID · t = '}
            <span className="tabular-nums">{time.toFixed(2)}</span>
            {' s'}
          </p>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label="Modo de consigna"
        className="order-last flex w-full rounded-md border border-border bg-panel p-1 sm:order-none sm:w-auto"
      >
        {MODES.map(({ id, label, Icon }) => {
          const active = mode === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onModeChange(id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded px-4 py-2 font-mono text-sm font-bold tracking-widest transition-colors sm:flex-none md:px-7',
                active ? 'bg-signal text-signal-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onDrivesToggle}
        aria-pressed={drivesOn}
        className={cn(
          'flex items-center gap-2 rounded-md border px-4 py-2 font-mono text-sm font-bold tracking-widest transition-colors',
          drivesOn
            ? 'border-trace/60 bg-trace/5 text-trace hover:bg-trace/10'
            : 'border-destructive/60 bg-destructive/10 text-destructive hover:bg-destructive/15',
        )}
      >
        <Power className="size-4" aria-hidden="true" />
        {drivesOn ? 'DRIVES ON' : 'DRIVES OFF'}
      </button>
    </header>
  )
}
