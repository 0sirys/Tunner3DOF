'use client'

import { useState } from 'react'
import { Plug, PlugZap, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { invoke } from '@tauri-apps/api/core'

const STATUS_LABEL: Record<string, string> = {
  disconnected: 'DESCONECTADO',
  connecting: 'CONECTANDO…',
  connected: 'CONECTADO',
  error: 'ERROR',
}

const selectClass =
  'h-12 w-full appearance-none rounded-md border border-border bg-face px-4 font-mono text-base tabular-nums outline-none transition-colors focus:border-signal disabled:cursor-not-allowed disabled:opacity-50'

export function SerialPanel() {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const [baudRate, setBaudRate] = useState<number>(115200)
  const [ports, setPorts] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0)
  const [error] = useState<string | null>(null)

  const locked = status === 'connected' || status === 'connecting'

  const handleConnect = () => {
    setStatus('connecting')
    setTimeout(() => {
      setStatus('connected')
    }, 1000)
  }

  const handleDisconnect = () => {
    setStatus('disconnected')
  }

  return (
    <section aria-labelledby="serial-title" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 id="serial-title" className="font-mono text-sm font-bold tracking-widest text-muted-foreground">
          COMUNICACIÓN SERIE
        </h2>
        <span
          className={cn(
            'flex items-center gap-2 font-mono text-sm font-bold',
            status === 'connected' && 'text-trace',
            status === 'error' && 'text-destructive',
            (status === 'disconnected' || status === 'connecting') && 'text-muted-foreground',
          )}
          role="status"
        >
          <span
            className={cn(
              'size-2 rounded-full bg-current',
              status === 'connecting' && 'animate-pulse',
            )}
            aria-hidden="true"
          />
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="serial-port" className="flex items-baseline justify-between">
          <span className="font-mono text-base font-bold">Puerto COM</span>
          <span className="font-mono text-sm text-muted-foreground">
            {ports.length}
            {ports.length === 1 ? ' disponible' : ' disponibles'}
          </span>
        </label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <select
              id="serial-port"
              className={selectClass}
              disabled={locked || ports.length === 0}
              value={selectedIndex ?? ''}
              onChange={(e) => setSelectedIndex(Number(e.target.value))}
            >
              {ports.length === 0 ? (
                <option value="">Sin puertos disponibles</option>
              ) : (
                ports.map((portName, i) => (
                  <option key={i} value={i}>
                    {portName}
                  </option>
                ))
              )}
            </select>
            <Chevron />
          </div>
          <button
            type="button"
            onClick={() => {
              invoke<string[]>('serial_names').then((values) => {
                setPorts(values)
              }).catch((err) => {
                console.log(err)
              })
            }}
            disabled={locked}
            className="flex size-12 shrink-0 items-center justify-center rounded-md border border-border bg-face text-muted-foreground transition-colors hover:border-signal hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Buscar puerto COM"
            title="Buscar puerto"
          >
            <Plus className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="serial-baud" className="flex items-baseline justify-between">
          <span className="font-mono text-base font-bold">Baudrate</span>
          <span className="font-mono text-sm text-muted-foreground">bps · 8N1</span>
        </label>
        <div className="relative">
          <select
            id="serial-baud"
            className={selectClass}
            disabled={locked}
            value={baudRate}
            onChange={(e) => setBaudRate(Number(e.target.value))}
          >
            {[9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600].map((rate) => (
              <option key={rate} value={rate}>
                {rate} bps
              </option>
            ))}
          </select>
          <Chevron />
        </div>
      </div>

      {status === 'connected' ? (
        <button
          type="button"
          onClick={handleDisconnect}
          className="flex h-12 items-center justify-center gap-2 rounded-md border border-trace font-mono text-sm font-bold tracking-widest text-trace transition-colors hover:bg-trace/10"
        >
          <PlugZap className="size-4" aria-hidden="true" />
          DESCONECTAR
        </button>
      ) : (
        <button
          type="button"
          onClick={handleConnect}
          disabled={selectedIndex === null || status === 'connecting'}
          className="flex h-12 items-center justify-center gap-2 rounded-md bg-signal font-mono text-sm font-bold tracking-widest text-signal-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plug className="size-4" aria-hidden="true" />
          CONECTAR
        </button>
      )}

      {error && (
        <p className="text-sm leading-relaxed text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="pointer-events-none absolute top-1/2 right-4 size-3 -translate-y-1/2 fill-muted-foreground"
      aria-hidden="true"
    >
      <path d="M1 4l5 5 5-5z" />
    </svg>
  )
}
