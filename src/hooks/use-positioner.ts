'use client'

import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  type AxisSnapshot,
  DEFAULT_GAINS,
  DEFAULT_GENERATOR,
  type Gains,
  type GeneratorConfig,
  type Mode,
} from '@/lib/positioner'

const EMPTY_AXES: AxisSnapshot[] = [0, 1, 2].map(() => ({
  position: 0,
  setpoint: 0,
  error: 0,
  velocity: 0,
  output: 0,
  zero: 0,
}))

export function usePositioner() {
  const [mode, setMode] = useState<Mode>('sine')
  const [drivesOn, setDrivesOn] = useState(true)
  const [gains, setGains] = useState<Gains[]>(DEFAULT_GAINS)
  const [generator, setGenerator] = useState<GeneratorConfig>(DEFAULT_GENERATOR)
  const [manual, setManual] = useState<number[]>([0, 90, 180])
  const [dirs, setDirs] = useState<number[]>([0, 0, 0])

  const [time, setTime] = useState(0)
  // Telemetría real: [pos0H,pos0L,tgt0H,tgt0L, pos1H,pos1L,tgt1H,tgt1L, pos2H,pos2L,tgt2H,tgt2L] uint16 BE grados
  const [live, setLive] = useState<AxisSnapshot[] | null>(null)

  useEffect(() => {
    let unlisten: (() => void) | undefined
    ;(async () => {
      unlisten = await listen<{ pos: number[]; tgt: number[] }>('telemetry', (e) => {
        const { pos, tgt } = e.payload
        if (pos.length < 3 || tgt.length < 3) return
        setTime((t) => t + 1)
        setLive(
          [0, 1, 2].map((i) => {
            const error = ((tgt[i] - pos[i] + 540) % 360) - 180
            return { position: pos[i], setpoint: tgt[i], error, velocity: 0, output: 0, zero: 0 }
          }),
        )
      })
    })()
    return () => {
      unlisten?.()
    }
  }, [])

  const applyGains = useCallback((_index: number, _next: Gains) => {
    setGains((prev) => prev.map((g, i) => (i === _index ? _next : g)))
  }, [])

  const setManualSetpoint = useCallback((index: number, value: number) => {
    setManual((prev) => prev.map((v, i) => (i === index ? value : v)))
  }, [])

  const toggleDir = useCallback((index: number) => {
    setDirs((prev) => {
      const next = prev.map((d, i) => (i === index ? (d ? 0 : 1) : d))
      invoke('write_serial_data', { cmd: 0x03, payload: [index, next[index]] }).catch((e) =>
        console.error(e),
      )
      return next
    })
  }, [])

  return {
    time,
    axes: live ?? EMPTY_AXES,
    liveActive: live !== null,
    mode,
    setMode,
    drivesOn,
    setDrivesOn,
    gains,
    applyGains,
    generator,
    setGenerator,
    manual,
    setManualSetpoint,
    dirs,
    toggleDir,
  }
}
