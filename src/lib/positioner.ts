export type Mode = 'sine' | 'saw' | 'manual'

export interface Gains {
  kp: number
  ki: number
  kd: number
}

export interface GeneratorConfig {
  amplitude: number
  frequency: number
  offset: number
}

export interface AxisSim {
  abs: number
  vel: number
  integral: number
  output: number
  zero: number
}

export interface AxisSnapshot {
  position: number
  setpoint: number
  error: number
  velocity: number
  output: number
  zero: number
}

export const AXES = [
  { id: 'M1', label: 'Eje X' },
  { id: 'M2', label: 'Eje Y' },
  { id: 'M3', label: 'Eje Z' },
] as const

// Mismos valores que el firmware (app.c). Unidades reales: salida % por cuenta de error.
export const DEFAULT_GAINS: Gains[] = [
  { kp: 0.08, ki: 0.001, kd: 0.001 },
  { kp: 0.08, ki: 0.001, kd: 0.001 },
  { kp: 0.08, ki: 0.001, kd: 0.001 },
]

export const DEFAULT_GENERATOR: GeneratorConfig = {
  amplitude: 90,
  frequency: 0.2,
  offset: 0,
}

export const LIMITS = {
  amplitude: { min: 0, max: 180 },
  frequency: { min: 0, max: 5 },
  offset: { min: 0, max: 360 },
} as const

const PLANT_GAIN = 10
const OUTPUT_LIMIT = 2000
const VISCOUS_FRICTION = 4
const DERIVATIVE_SCALE = 0.1
const INTEGRAL_LIMIT = 200

export const wrap360 = (deg: number) => ((deg % 360) + 360) % 360
export const wrap180 = (deg: number) => wrap360(deg + 180) - 180
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export function computeSetpoint(
  mode: Mode,
  gen: GeneratorConfig,
  t: number,
  index: number,
  manual: number,
) {
  if (mode === 'manual') return wrap360(manual)
  if (mode === 'sine') {
    const phase = (index * 2 * Math.PI) / 3
    return wrap360(gen.offset + gen.amplitude * Math.sin(2 * Math.PI * gen.frequency * t + phase))
  }
  const frac = (((gen.frequency * t + index / 3) % 1) + 1) % 1
  return wrap360(gen.offset + gen.amplitude * (2 * frac - 1))
}

export const displayPosition = (axis: AxisSim) => wrap360(axis.abs - axis.zero)

export function stepAxis(axis: AxisSim, gains: Gains, setpoint: number, dt: number, drivesOn: boolean) {
  const error = wrap180(setpoint - displayPosition(axis))

  let accel: number
  if (drivesOn) {
    axis.integral = clamp(axis.integral + error * dt, -INTEGRAL_LIMIT, INTEGRAL_LIMIT)
    const u = gains.kp * error + gains.ki * axis.integral - gains.kd * DERIVATIVE_SCALE * axis.vel
    const limited = clamp(u, -OUTPUT_LIMIT, OUTPUT_LIMIT)
    axis.output = (limited / OUTPUT_LIMIT) * 100
    accel = PLANT_GAIN * limited - VISCOUS_FRICTION * axis.vel
  } else {
    axis.integral = 0
    axis.output = 0
    accel = -VISCOUS_FRICTION * 0.75 * axis.vel
  }

  axis.vel += accel * dt
  axis.abs = wrap360(axis.abs + axis.vel * dt)
  return error
}
