'use client'

import { useState } from 'react'
import { AXES, clamp, type GeneratorConfig, LIMITS, type Mode } from '@/lib/positioner'

interface NumberFieldProps {
  id: string
  label: string
  unit: string
  min: number
  max: number
  step: number
  value: number
  onCommit: (value: number) => void
}

function NumberField({ id, label, unit, min, max, step, value, onCommit }: NumberFieldProps) {
  const [text, setText] = useState(String(value))
  const [focused, setFocused] = useState(false)

  const commit = (raw: string) => {
    const n = Number.parseFloat(raw)
    if (Number.isFinite(n)) onCommit(clamp(n, min, max))
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex items-baseline justify-between">
        <span className="font-mono text-base font-bold">{label}</span>
        <span className="font-mono text-sm text-muted-foreground">
          {min}
          {' – '}
          {max}
        </span>
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={focused ? text : String(value)}
          onFocus={() => {
            setText(String(value))
            setFocused(true)
          }}
          onChange={(e) => {
            setText(e.target.value)
            commit(e.target.value)
          }}
          onBlur={() => setFocused(false)}
          className="h-12 w-full rounded-md border border-border bg-face px-4 pr-10 font-mono text-base tabular-nums outline-none transition-colors focus:border-signal"
        />
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 font-mono text-sm text-muted-foreground">
          {unit}
        </span>
      </div>
    </div>
  )
}

interface GeneratorPanelProps {
  mode: Mode
  generator: GeneratorConfig
  onGeneratorChange: (gen: GeneratorConfig) => void
  manual: number[]
  onManualChange: (index: number, value: number) => void
}

export function GeneratorPanel({ mode, generator, onGeneratorChange, manual, onManualChange }: GeneratorPanelProps) {
  return (
    <section aria-labelledby="gen-title" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 id="gen-title" className="font-mono text-sm font-bold tracking-widest text-muted-foreground">
          GENERADOR DE CONSIGNA
        </h2>
        <span className="font-mono text-sm font-bold text-signal">{mode.toUpperCase()}</span>
      </div>

      {mode === 'manual' ? (
        <div className="flex flex-col gap-5">
          {AXES.map((axis, i) => (
            <div key={axis.id} className="flex flex-col gap-2">
              <label htmlFor={`manual-${axis.id}`} className="flex items-baseline justify-between">
                <span className="font-mono text-base font-bold">
                  {'Consigna '}
                  {axis.id}
                </span>
                <span className="font-mono text-sm tabular-nums text-signal">
                  {manual[i].toFixed(0)}
                  {'°'}
                </span>
              </label>
              <input
                id={`manual-${axis.id}`}
                type="range"
                min={0}
                max={359}
                step={1}
                value={manual[i]}
                onChange={(e) => onManualChange(i, Number(e.target.value))}
                className="w-full accent-signal"
              />
            </div>
          ))}
        </div>
      ) : (
        <>
          <NumberField
            id="gen-amplitude"
            label="Amplitud"
            unit="°"
            step={1}
            {...LIMITS.amplitude}
            value={generator.amplitude}
            onCommit={(amplitude) => onGeneratorChange({ ...generator, amplitude })}
          />
          <NumberField
            id="gen-frequency"
            label="Frecuencia"
            unit="Hz"
            step={0.05}
            {...LIMITS.frequency}
            value={generator.frequency}
            onCommit={(frequency) => onGeneratorChange({ ...generator, frequency })}
          />
          <NumberField
            id="gen-offset"
            label="Offset"
            unit="°"
            step={1}
            {...LIMITS.offset}
            value={generator.offset}
            onCommit={(offset) => onGeneratorChange({ ...generator, offset })}
          />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Cada eje recibe la misma forma de onda desfasada 120° respecto al anterior.
          </p>
        </>
      )}
    </section>
  )
}
