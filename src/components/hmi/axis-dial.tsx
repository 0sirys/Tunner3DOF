'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const SIZE = 320
const C = SIZE / 2

function polar(r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return { x: C + r * Math.sin(rad), y: C - r * Math.cos(rad) }
}

function triangle(deg: number, tipR: number, baseR: number, halfWidth: number) {
  const tip = polar(tipR, deg)
  const baseCenter = polar(baseR, deg)
  const rad = (deg * Math.PI) / 180
  const px = Math.cos(rad) * halfWidth
  const py = Math.sin(rad) * halfWidth
  return `${tip.x},${tip.y} ${baseCenter.x + px},${baseCenter.y + py} ${baseCenter.x - px},${baseCenter.y - py}`
}

const FINE_TICKS = Array.from({ length: 180 }, (_, i) => i * 2)
const SCALE_TICKS = Array.from({ length: 72 }, (_, i) => i * 5)
const LABELS = Array.from({ length: 12 }, (_, i) => i * 30)

const BEZEL_INNER = 132
const BEZEL_OUTER = 162

const wrap360 = (deg: number) => ((deg % 360) + 360) % 360

type DragState =
  | { kind: 'bezel'; startAngle: number; startZero: number }
  | { kind: 'setpoint' }
  | null

interface AxisDialProps {
  position: number
  setpoint: number
  zero: number
  label: string
  onZeroChange: (zero: number) => void
  manualMode: boolean
  onSetpointChange: (setpoint: number) => void
}

export function AxisDial({
  position,
  setpoint,
  zero,
  label,
  onZeroChange,
  manualMode,
  onSetpointChange,
}: AxisDialProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<DragState>(null)
  const [dragging, setDragging] = useState<'bezel' | 'setpoint' | null>(null)

  const needleAngle = position + zero
  const setpointAngle = setpoint + zero
  const needleTip = polar(100, needleAngle)
  const needleTail = polar(-14, needleAngle)
  const spLineEnd = polar(128, setpointAngle)

  function pointerGeometry(e: React.PointerEvent) {
    const rect = svgRef.current!.getBoundingClientRect()
    const scale = SIZE / rect.width
    const dx = (e.clientX - rect.left) * scale - C
    const dy = (e.clientY - rect.top) * scale - C
    const angle = wrap360((Math.atan2(dx, -dy) * 180) / Math.PI)
    return { angle, radius: Math.hypot(dx, dy) }
  }

  function applySetpoint(angle: number) {
    onSetpointChange(wrap360(Math.round(angle - zero)))
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return
    const { angle, radius } = pointerGeometry(e)
    if (radius >= BEZEL_INNER && radius <= BEZEL_OUTER) {
      dragRef.current = { kind: 'bezel', startAngle: angle, startZero: zero }
      setDragging('bezel')
    } else if (manualMode && radius < BEZEL_INNER) {
      dragRef.current = { kind: 'setpoint' }
      setDragging('setpoint')
      applySetpoint(angle)
    } else {
      return
    }
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    if (!drag) return
    const { angle } = pointerGeometry(e)
    if (drag.kind === 'bezel') {
      const next = drag.startZero + (angle - drag.startAngle)
      onZeroChange(Math.round(wrap360(next) * 10) / 10)
    } else {
      applySetpoint(angle)
    }
  }

  function endDrag(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragRef.current) return
    dragRef.current = null
    setDragging(null)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto aspect-square w-full max-w-80 touch-none select-none"
      role="img"
      aria-label={`${label}: posición ${position.toFixed(1)} grados, consigna ${setpoint.toFixed(1)} grados. Arrastra el bisel para mover el cero${manualMode ? ' o la esfera para fijar la consigna' : ''}.`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <circle cx={C} cy={C} r={154} fill="#232a33" />
      <circle cx={C} cy={C} r={154} fill="none" stroke="#2f3742" strokeWidth={1} />
      {FINE_TICKS.map((deg) => {
        const a = polar(140, deg)
        const b = polar(151, deg)
        return <line key={deg} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#4a5360" strokeWidth={1} />
      })}

      <circle cx={C} cy={C} r={136} fill="var(--face)" />
      <circle cx={C} cy={C} r={72} fill="none" stroke="#2a313b" strokeWidth={1} strokeDasharray="2 4" />

      {SCALE_TICKS.map((deg) => {
        const major = deg % 30 === 0
        const isZero = deg === 0
        const a = polar(major ? 108 : 120, deg + zero)
        const b = polar(128, deg + zero)
        return (
          <line
            key={deg}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={isZero ? 'var(--trace)' : major ? '#e6e9ee' : '#6b7480'}
            strokeWidth={major ? 2.5 : 1.25}
            strokeLinecap="round"
          />
        )
      })}

      {LABELS.map((deg) => {
        const p = polar(94, deg + zero)
        return (
          <text
            key={deg}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="font-mono"
            fontSize={deg === 0 ? 14 : 12}
            fontWeight={deg === 0 ? 700 : 400}
            fill={deg === 0 ? 'var(--trace)' : '#aab2bd'}
          >
            {deg}
          </text>
        )
      })}

      <polygon points={triangle(zero, 138, 154, 7)} fill="#e6e9ee" />

      <line
        x1={C}
        y1={C}
        x2={spLineEnd.x}
        y2={spLineEnd.y}
        stroke="var(--signal)"
        strokeWidth={1}
        strokeDasharray="3 4"
        opacity={0.7}
      />
      <polygon points={triangle(setpointAngle, 136, 156, 9)} fill="var(--signal)" />

      <line
        x1={needleTail.x}
        y1={needleTail.y}
        x2={needleTip.x}
        y2={needleTip.y}
        stroke="var(--trace)"
        strokeWidth={5}
        strokeLinecap="round"
      />
      <circle cx={needleTip.x} cy={needleTip.y} r={4.5} fill="var(--trace)" />
      <circle cx={C} cy={C} r={15} fill="var(--face)" stroke="#aab2bd" strokeWidth={2.5} />
      <circle cx={C} cy={C} r={6} fill="var(--trace)" />

      <text
        x={C}
        y={C + 48}
        textAnchor="middle"
        dominantBaseline="central"
        className="font-mono"
        fontSize={24}
        fontWeight={700}
        fill="#e6e9ee"
      >
        {position.toFixed(1)}
        {'°'}
      </text>

      {manualMode && (
        <circle
          cx={C}
          cy={C}
          r={BEZEL_INNER}
          fill="transparent"
          className={dragging === 'setpoint' ? 'cursor-grabbing' : 'cursor-crosshair'}
        />
      )}
      <circle
        cx={C}
        cy={C}
        r={(BEZEL_INNER + BEZEL_OUTER) / 2}
        fill="none"
        strokeWidth={BEZEL_OUTER - BEZEL_INNER}
        pointerEvents="stroke"
        className={cn(
          'stroke-transparent transition-colors hover:stroke-white/5',
          dragging === 'bezel' ? 'cursor-grabbing stroke-white/10' : 'cursor-grab',
        )}
      >
        <title>Arrastra para girar el bisel (cero)</title>
      </circle>
    </svg>
  )
}
