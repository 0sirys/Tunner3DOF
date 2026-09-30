'use client'

import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { AXES, DEFAULT_GAINS, type Gains } from '@/lib/positioner'
import { cn } from '@/lib/utils'

type Draft = Record<keyof Gains, string>

const toDraft = (g: Gains): Draft => ({ kp: String(g.kp), ki: String(g.ki), kd: String(g.kd) })

const FIELDS: { key: keyof Gains; label: string; hint: string }[] = [
  { key: 'kp', label: 'Kp', hint: 'Ganancia proporcional' },
  { key: 'ki', label: 'Ki', hint: 'Ganancia integral' },
  { key: 'kd', label: 'Kd', hint: 'Ganancia derivativa' },
]

interface PidPanelProps {
  selected: number
  onSelect: (index: number) => void
  gains: Gains[]
  onApply: (index: number, gains: Gains) => void
}

export function PidPanel({ selected, onSelect, gains, onApply }: PidPanelProps) {
  const [drafts, setDrafts] = useState<Draft[]>(() => gains.map(toDraft))
  const draft = drafts[selected]
  const applied = gains[selected]

  const parsed = {
    kp: Number.parseFloat(draft.kp),
    ki: Number.parseFloat(draft.ki),
    kd: Number.parseFloat(draft.kd),
  }
  const valid = Object.values(parsed).every((v) => Number.isFinite(v) && v >= 0 && v <= 1000)
  const dirty = parsed.kp !== applied.kp || parsed.ki !== applied.ki || parsed.kd !== applied.kd
  const canApply = valid && dirty

  const updateDraft = (key: keyof Gains, value: string) =>
    setDrafts((prev) => prev.map((d, i) => (i === selected ? { ...d, [key]: value } : d)))

  const apply = () => {
    if (canApply) onApply(selected, parsed)
  }

  const restoreDefaults = () =>
    setDrafts((prev) => prev.map((d, i) => (i === selected ? toDraft(DEFAULT_GAINS[i]) : d)))

  return (
    <section aria-labelledby="pid-title" className="flex flex-col gap-4">
      <h2 id="pid-title" className="font-mono text-sm font-bold tracking-widest text-muted-foreground">
        PARÁMETROS PID
      </h2>

      <div role="tablist" aria-label="Motor" className="grid grid-cols-3 gap-1.5">
        {AXES.map((axis, i) => (
          <button
            key={axis.id}
            type="button"
            role="tab"
            aria-selected={selected === i}
            onClick={() => onSelect(i)}
            className={cn(
              'rounded-md border py-2.5 font-mono text-sm font-bold transition-colors',
              selected === i
                ? 'border-signal bg-signal text-signal-foreground'
                : 'border-border bg-panel text-muted-foreground hover:text-foreground',
            )}
          >
            {axis.id}
          </button>
        ))}
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          apply()
        }}
      >
        {FIELDS.map(({ key, label, hint }) => (
          <div key={key} className="flex flex-col gap-2">
            <label htmlFor={`gain-${key}`} className="flex items-baseline justify-between">
              <span className="font-mono text-base font-bold">{label}</span>
              <span className="text-sm text-muted-foreground">{hint}</span>
            </label>
            <input
              id={`gain-${key}`}
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              max={1000}
              value={draft[key]}
              onChange={(e) => updateDraft(key, e.target.value)}
              aria-invalid={!Number.isFinite(parsed[key]) || parsed[key] < 0}
              className="h-12 rounded-md border border-border bg-face px-4 font-mono text-base tabular-nums outline-none transition-colors focus:border-signal aria-invalid:border-destructive"
            />
          </div>
        ))}

        <div className="flex gap-2.5">
          <button
            type="submit"
            disabled={!canApply}
            className={cn(
              'h-12 flex-1 rounded-md font-mono text-sm font-bold tracking-widest transition-colors',
              canApply
                ? 'bg-signal text-signal-foreground hover:bg-signal/90'
                : 'cursor-default bg-signal/40 text-signal-foreground/70',
            )}
          >
            {!valid ? 'VALOR INVÁLIDO' : dirty ? 'APLICAR' : 'APLICADO'}
          </button>
          <button
            type="button"
            onClick={restoreDefaults}
            className="flex size-12 items-center justify-center rounded-md border border-border bg-panel text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            <span className="sr-only">Restaurar valores por defecto de {AXES[selected].id}</span>
          </button>
        </div>
      </form>

      <table className="w-full font-mono text-sm">
        <caption className="sr-only">Ganancias aplicadas por motor</caption>
        <thead>
          <tr className="text-muted-foreground">
            <th scope="col" className="py-2 text-left font-normal">MOTOR</th>
            <th scope="col" className="py-2 text-right font-normal">Kp</th>
            <th scope="col" className="py-2 text-right font-normal">Ki</th>
            <th scope="col" className="py-2 text-right font-normal">Kd</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {AXES.map((axis, i) => (
            <tr key={axis.id} className={cn(selected === i ? 'text-signal' : 'text-foreground')}>
              <th scope="row" className="py-2 text-left font-normal">{axis.id}</th>
              <td className="py-2 text-right">{gains[i].kp.toFixed(3)}</td>
              <td className="py-2 text-right">{gains[i].ki.toFixed(3)}</td>
              <td className="py-2 text-right">{gains[i].kd.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
