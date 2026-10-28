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

// Generador de consigna: [JOINT u8][WAVE u8][AMP u16 BE cuentas][FREQ u16 BE Hzx100] (LEN=6)
// Códigos de onda iguales al firmware (sig_gen.h): 0 seno, 1 cuadrada, 2 sierra.
// AMP va en cuentas del encoder (4096 = 360°, máx 2048 = 180°). AMP=0 detiene la generación.
export const CMD_WAVE = 0x09
export const CMD_TGT = 0x04
export const WAVE_SINE = 0
export const WAVE_SQUARE = 1
export const WAVE_SAW = 2
const COUNTS_PER_TURN = 4096
const AMP_MAX_COUNTS = 2048

function wavePayload(joint: number, wave: number, amplitude: number, frequency: number): number[] {
  const buf = new DataView(new ArrayBuffer(6))
  const ampCounts = Math.round((amplitude * COUNTS_PER_TURN) / 360)
  buf.setUint8(0, joint & 0xff)
  buf.setUint8(1, wave & 0xff)
  buf.setUint16(2, Math.max(0, Math.min(AMP_MAX_COUNTS, ampCounts)), false)
  buf.setUint16(4, Math.max(0, Math.min(0xffff, Math.round(frequency * 100))), false)
  return Array.from(new Uint8Array(buf.buffer))
}

export function usePositioner() {
  const [mode, setMode] = useState<Mode>('sine')
  const [drivesOn, setDrivesOn] = useState(true)
  const [gains, setGains] = useState<Gains[]>(DEFAULT_GAINS)
  const [generator, setGenerator] = useState<GeneratorConfig>(DEFAULT_GENERATOR)
  const [manual, setManual] = useState<number[]>([0, 90, 180])
  const [dirs, setDirs] = useState<number[]>([0, 0, 0])

  const [time, setTime] = useState(0)
  // Telemetría real: cuentas 0-4095 con cero en 2048 (12 bits = 1 vuelta)
  const toDeg = (raw: number) => (((((raw & 0xfff) - 2048) * 360) / 4096) % 360 + 360) % 360
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
            const position = toDeg(pos[i])
            const setpoint = toDeg(tgt[i])
            const error = ((setpoint - position + 540) % 360) - 180
            return { position, setpoint, error, velocity: 0, output: 0, zero: 0 }
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
    // TGT: [j][raw16 BE]; el firmware hace >>4. Inversa de toDeg: 0° = 2048 cuentas.
    const counts = (Math.round((value * COUNTS_PER_TURN) / 360) + 2048) & 0xfff
    const raw16 = counts << 4
    invoke('write_serial_data', { cmd: CMD_TGT, payload: [index, raw16 >> 8, raw16 & 0xff] }).catch(
      (e) => console.error(e),
    )
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

  const sendWave = useCallback((joint: number, wave: number, gen: GeneratorConfig) => {
    invoke('write_serial_data', {
      cmd: CMD_WAVE,
      payload: wavePayload(joint, wave, gen.amplitude, gen.frequency),
    }).catch((e) => console.error(e))
  }, [])

  return {
    time,
    axes: live ?? EMPTY_AXES,
    liveActive: live !== null,
    mode,
    setMode,
    sendWave,
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
