'use client'

import { useEffect, useRef, useState } from 'react'

const MAX_POINTS = 200

interface AxisPlotProps {
  position: number
  setpoint: number
  label: string
}

const wrap180 = (deg: number) => ((deg + 540) % 360) - 180

const Y_MAX = 210

function toPath(values: number[], w: number, h: number): string {
  if (values.length < 2) return ''
  const step = w / (MAX_POINTS - 1)
  const x0 = w - step * (values.length - 1)
  return values
    .map((v, i) => {
      const x = x0 + i * step
      const s = Math.min(Y_MAX, Math.max(-Y_MAX, wrap180(v)))
      const y = h / 2 - (s / Y_MAX) * (h / 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function AxisPlot({ position, setpoint, label }: AxisPlotProps) {
  const [posHist, setPosHist] = useState<number[]>([])
  const [spHist, setSpHist] = useState<number[]>([])
  const lastRef = useRef(0)

  useEffect(() => {
    const now = performance.now()
    if (now - lastRef.current < 50) return
    lastRef.current = now
    setPosHist((prev) => [...prev.slice(-MAX_POINTS + 1), position])
    setSpHist((prev) => [...prev.slice(-MAX_POINTS + 1), setpoint])
  }, [position, setpoint])

  const w = 300
  const h = 108

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-trace" aria-hidden="true" />
          Posición
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-signal" aria-hidden="true" />
          Consigna
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full rounded-md border border-border bg-face"
        role="img"
        aria-label={`${label}: plotter de posición y consigna`}
      >
        {[-210, -180, -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180, 210].map((v) => {
          const y = h / 2 - (v / Y_MAX) * (h / 2)
          const isZero = v === 0
          const isMajor = v % 90 === 0
          const showLabel = v % 60 === 0
          return (
            <g key={v}>
              <line
                x1={0}
                y1={y}
                x2={w}
                y2={y}
                stroke={isZero ? '#4a5360' : isMajor ? '#343c47' : '#2a313b'}
                strokeWidth={isZero ? 1 : 0.5}
                strokeDasharray="2 3"
              />
              {showLabel && (
                <text
                  x={2}
                  y={Math.min(h - 5, Math.max(5, y))}
                  fontSize={4.5}
                  fill={isZero ? '#aab2bd' : '#6b7480'}
                  className="font-mono"
                  textAnchor="start"
                  dominantBaseline="central"
                  stroke="#0f1318"
                  strokeWidth={2}
                  paintOrder="stroke"
                >
                  {v}
                </text>
              )}
            </g>
          )
        })}
        <path d={toPath(spHist, w, h)} fill="none" stroke="var(--signal)" strokeWidth={1.5} />
        <path d={toPath(posHist, w, h)} fill="none" stroke="var(--trace)" strokeWidth={1.5} />
      </svg>
    </div>
  )
}
