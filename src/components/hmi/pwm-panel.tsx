'use client'

import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { AXES } from '@/lib/positioner'
import { cn } from '@/lib/utils'
import { invoke } from '@tauri-apps/api/core'

// PWM: [j][min u16 BE][max u16 BE] en décimas de % (0..1000, min < max), LEN=5
const CMD_SET_PWM = 0x0b

interface PwmRange {
  min: number // % de duty
  max: number
}

// Igual que el firmware por defecto: 0 % .. 100 %
const DEFAULT_PWM: PwmRange = { min: 0, max: 100 }

type Draft = { min: string; max: string }
const toDraft = (r: PwmRange): Draft => ({ min: String(r.min), max: String(r.max) })

interface PwmPanelProps {
  selected: number
}

export function PwmPanel({ selected }: PwmPanelProps) {
  const [applied, setApplied] = useState<PwmRange[]>(() => AXES.map(() => DEFAULT_PWM))
  const [drafts, setDrafts] = useState<Draft[]>(() => AXES.map(() => toDraft(DEFAULT_PWM)))
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const draft = drafts[selected]
  const parsed = { min: Number.parseFloat(draft.min), max: Number.parseFloat(draft.max) }
  const inRange = (v: number) => Number.isFinite(v) && v >= 0 && v <= 100
  const valid = inRange(parsed.min) && inRange(parsed.max) && parsed.min < parsed.max
  const dirty = parsed.min !== applied[selected].min || parsed.max !== applied[selected].max
  const canApply = valid && dirty && !sending

  const updateDraft = (key: keyof Draft, value: string) => {
    setError(null)
    setDrafts((prev) => prev.map((d, i) => (i === selected ? { ...d, [key]: value } : d)))
  }

  const apply = async () => {
    if (!canApply) return
    const minPm = Math.round(parsed.min * 10)
    const maxPm = Math.round(parsed.max * 10)
    const payload = [selected, minPm >> 8, minPm & 0xff, maxPm >> 8, maxPm & 0xff]
    setSending(true)
    try {
      await invoke('write_serial_data', { cmd: CMD_SET_PWM, payload })
      setApplied((prev) => prev.map((r, i) => (i === selected ? { ...parsed } : r)))
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setSending(false)
    }
  }

  const restoreDefaults = () => {
    setError(null)
    setDrafts((prev) => prev.map((d, i) => (i === selected ? toDraft(DEFAULT_PWM) : d)))
  }

  const fields: { key: keyof Draft; label: string; hint: string }[] = [
    { key: 'min', label: 'PWM mín', hint: 'Duty con la mínima salida (vence fricción)' },
    { key: 'max', label: 'PWM máx', hint: 'Duty con salida al 100 %' },
  ]

  return (
    <section aria-labelledby="pwm-title" className="flex flex-col gap-4">
      <h2 id="pwm-title" className="font-mono text-sm font-bold tracking-widest text-muted-foreground">
        RANGO PWM · {AXES[selected].id}
      </h2>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          apply()
        }}
      >
        {fields.map(({ key, label, hint }) => (
          <div key={key} className="flex flex-col gap-2">
            <label htmlFor={`pwm-${key}`} className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-base font-bold">{label} %</span>
              <span className="text-right text-sm text-muted-foreground">{hint}</span>
            </label>
            <input
              id={`pwm-${key}`}
              type="number"
              inputMode="decimal"
              step={0.1}
              min={0}
              max={100}
              value={draft[key]}
              onChange={(e) => updateDraft(key, e.target.value)}
              aria-invalid={!inRange(parsed[key]) || (valid === false && key === 'max')}
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
            {!valid ? 'VALOR INVÁLIDO' : sending ? 'ENVIANDO…' : dirty ? 'APLICAR' : 'APLICADO'}
          </button>
          <button
            type="button"
            onClick={restoreDefaults}
            className="flex size-12 items-center justify-center rounded-md border border-border bg-panel text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            <span className="sr-only">Restaurar PWM por defecto de {AXES[selected].id}</span>
          </button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-sm text-muted-foreground">
          Se guarda en flash con el botón GUARDAR EN FLASH (junto con el PID).
        </p>
      </form>

      <table className="w-full font-mono text-sm">
        <caption className="sr-only">Rango PWM aplicado por motor</caption>
        <thead>
          <tr className="text-muted-foreground">
            <th scope="col" className="py-2 text-left font-normal">MOTOR</th>
            <th scope="col" className="py-2 text-right font-normal">MÍN %</th>
            <th scope="col" className="py-2 text-right font-normal">MÁX %</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {AXES.map((axis, i) => (
            <tr key={axis.id} className={cn(selected === i ? 'text-signal' : 'text-foreground')}>
              <th scope="row" className="py-2 text-left font-normal">{axis.id}</th>
              <td className="py-2 text-right">{applied[i].min.toFixed(1)}</td>
              <td className="py-2 text-right">{applied[i].max.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
