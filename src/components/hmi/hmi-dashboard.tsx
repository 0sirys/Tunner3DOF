'use client'

import { useState } from 'react'
import { usePositioner } from '@/hooks/use-positioner'
import { AXES } from '@/lib/positioner'
import { AxisCard } from './axis-card'
import { PidPanel } from './pid-panel'
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
        onModeChange={hmi.setMode}
        drivesOn={hmi.drivesOn}
        onDrivesToggle={() => hmi.setDrivesOn((v) => !v)}
      />

      <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
        <aside className="flex flex-col gap-8 border-t border-border p-4 [scrollbar-gutter:stable] md:w-80 md:shrink-0 md:overflow-y-auto md:overscroll-contain md:border-t-0 md:border-r lg:w-96">
          <SerialPanel />
          <div className="border-t border-border" />
          <PidPanel selected={selected} onSelect={setSelected} gains={hmi.gains} onApply={hmi.applyGains} />
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

          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
            {AXES.map((axis, i) => (
              <AxisCard
                key={axis.id}
                id={axis.id}
                label={axis.label}
                data={hmi.axes[i]}
                drivesOn={hmi.drivesOn}
                selected={selected === i}
                onSelect={() => setSelected(i)}
                onNudgeZero={(d) => hmi.nudgeZero(i, d)}
                onZeroHere={() => hmi.zeroHere(i)}
                onResetZero={() => hmi.resetZero(i)}
                onZeroChange={(z) => hmi.setZero(i, z)}
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
