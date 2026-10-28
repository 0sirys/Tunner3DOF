'use client'

import { useState } from 'react'
import { usePositioner, WAVE_SAW, WAVE_SINE } from '@/hooks/use-positioner'
import { AXES } from '@/lib/positioner'
import { AxisCard } from './axis-card'
import { GeneratorPanel } from './generator-panel'
import { PidPanel } from './pid-panel'
import { PwmPanel } from './pwm-panel'
import { SerialPanel } from './serial-panel'
import { TopBar } from './top-bar'

export function HmiDashboard() {
  const hmi = usePositioner()
  const [selected, setSelected] = useState(0)

  return (
    <div className="flex min-h-dvh flex-col md:h-dvh md:overflow-hidden">
      <TopBar
        time={hmi.time}
        mode={hmi.mode}
        onModeChange={(m) => {
          // Toggle: pulsar el modo activo lo apaga (amplitud 0) y vuelve a MANUAL
          if ((m === 'sine' && hmi.mode === 'sine') || (m === 'saw' && hmi.mode === 'saw')) {
            hmi.setMode('manual')
            hmi.sendWave(selected, WAVE_SINE, { ...hmi.generator, amplitude: 0 })
            return
          }
          hmi.setMode(m)
          if (m === 'sine') hmi.sendWave(selected, WAVE_SINE, hmi.generator)
          else if (m === 'saw') hmi.sendWave(selected, WAVE_SAW, hmi.generator)
          else hmi.sendWave(selected, WAVE_SINE, { ...hmi.generator, amplitude: 0 })
        }}
        drivesOn={hmi.drivesOn}
        onDrivesToggle={() => hmi.setDrivesOn((v) => !v)}
      />

      <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
        <aside className="flex flex-col gap-8 border-t border-border p-4 [scrollbar-gutter:stable] md:w-80 md:shrink-0 md:overflow-y-auto md:overscroll-contain md:border-t-0 md:border-r lg:w-96">
          <SerialPanel />
          <div className="border-t border-border" />
          <GeneratorPanel
            mode={hmi.mode}
            generator={hmi.generator}
            onGeneratorChange={(gen) => {
              hmi.setGenerator(gen)
              if (hmi.mode === 'sine') hmi.sendWave(selected, WAVE_SINE, gen)
              else if (hmi.mode === 'saw') hmi.sendWave(selected, WAVE_SAW, gen)
            }}
            manual={hmi.manual}
            onManualChange={(i, v) => hmi.setManualSetpoint(i, v)}
          />
          <div className="border-t border-border" />
          <PidPanel selected={selected} onSelect={setSelected} gains={hmi.gains} onApply={hmi.applyGains} />
          <div className="border-t border-border" />
          <PwmPanel selected={selected} />
          <div className="border-t border-border" />
        </aside>

        <main className="order-first flex min-w-0 flex-1 flex-col gap-4 p-4 md:order-none md:overflow-y-auto">
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-0.5 w-5 rounded bg-trace" aria-hidden="true" />
              Posición actual
            </span>
            <span className="flex items-center gap-2">
              <svg viewBox="0 0 10 10" className="size-2.5 fill-signal" aria-hidden="true">
                <polygon points="0,0 10,0 5,9" />
              </svg>
              Consigna
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {AXES.map((axis, i) => (
              <AxisCard
                key={axis.id}
                id={axis.id}
                label={axis.label}
                data={hmi.axes[i]}
                drivesOn={hmi.drivesOn}
                selected={selected === i}
                onSelect={() => setSelected(i)}
                onInvert={() => hmi.toggleDir(i)}
                inverted={hmi.dirs[i] === 1}
                manualMode={hmi.mode === 'manual'}
                onSetpointChange={(sp) => hmi.setManualSetpoint(i, sp)}
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
