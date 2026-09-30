'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type AxisSim,
  type AxisSnapshot,
  computeSetpoint,
  DEFAULT_GAINS,
  DEFAULT_GENERATOR,
  displayPosition,
  type Gains,
  type GeneratorConfig,
  type Mode,
  stepAxis,
  wrap360,
} from '@/lib/positioner'

const SUBSTEP = 0.001
const MAX_FRAME_DT = 0.05

interface Config {
  mode: Mode
  drivesOn: boolean
  gains: Gains[]
  generator: GeneratorConfig
  manual: number[]
}

const initialAxes = (): AxisSim[] => [
  { abs: 100, vel: 0, integral: 0, output: 0, zero: 345 },
  { abs: 340, vel: 0, integral: 0, output: 0, zero: 0 },
  { abs: 300, vel: 0, integral: 0, output: 0, zero: 0 },
]

const snapshotOf = (axes: AxisSim[], setpoints: number[], errors: number[]): AxisSnapshot[] =>
  axes.map((a, i) => ({
    position: displayPosition(a),
    setpoint: setpoints[i],
    error: errors[i],
    velocity: a.vel,
    output: a.output,
    zero: a.zero,
  }))

export function usePositioner() {
  const [mode, setMode] = useState<Mode>('sine')
  const [drivesOn, setDrivesOn] = useState(true)
  const [gains, setGains] = useState<Gains[]>(DEFAULT_GAINS)
  const [generator, setGenerator] = useState<GeneratorConfig>(DEFAULT_GENERATOR)
  const [manual, setManual] = useState<number[]>([0, 90, 180])

  const axesRef = useRef<AxisSim[]>(initialAxes())
  const timeRef = useRef(0)
  const configRef = useRef<Config>({ mode, drivesOn, gains, generator, manual })
  configRef.current = { mode, drivesOn, gains, generator, manual }

  const [time, setTime] = useState(0)
  const [snapshot, setSnapshot] = useState<AxisSnapshot[]>(() =>
    snapshotOf(axesRef.current, [0, 0, 0], [0, 0, 0]),
  )

  useEffect(() => {
    let frame = 0
    let last = performance.now()

    const tick = (now: number) => {
      const frameDt = Math.min((now - last) / 1000, MAX_FRAME_DT)
      last = now
      const cfg = configRef.current
      const axes = axesRef.current
      const setpoints = [0, 0, 0]
      const errors = [0, 0, 0]
      const steps = Math.max(1, Math.round(frameDt / SUBSTEP))

      for (let s = 0; s < steps; s++) {
        timeRef.current += SUBSTEP
        axes.forEach((axis, i) => {
          setpoints[i] = computeSetpoint(cfg.mode, cfg.generator, timeRef.current, i, cfg.manual[i])
          errors[i] = stepAxis(axis, cfg.gains[i], setpoints[i], SUBSTEP, cfg.drivesOn)
        })
      }

      setTime(timeRef.current)
      setSnapshot(snapshotOf(axes, setpoints, errors))
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const applyGains = useCallback((index: number, next: Gains) => {
    setGains((prev) => prev.map((g, i) => (i === index ? next : g)))
    axesRef.current[index].integral = 0
  }, [])

  const setManualSetpoint = useCallback((index: number, value: number) => {
    setManual((prev) => prev.map((v, i) => (i === index ? value : v)))
  }, [])

  const nudgeZero = useCallback((index: number, delta: number) => {
    const axis = axesRef.current[index]
    axis.zero = wrap360(axis.zero + delta)
  }, [])

  const zeroHere = useCallback((index: number) => {
    const axis = axesRef.current[index]
    axis.zero = axis.abs
    axis.integral = 0
  }, [])

  const setZero = useCallback((index: number, value: number) => {
    axesRef.current[index].zero = wrap360(value)
  }, [])

  const resetZero = useCallback((index: number) => {
    axesRef.current[index].zero = 0
  }, [])

  return {
    time,
    axes: snapshot,
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
    nudgeZero,
    zeroHere,
    setZero,
    resetZero,
  }
}
