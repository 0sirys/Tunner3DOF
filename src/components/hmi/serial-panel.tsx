'use client'

import { useEffect, useState } from 'react'
import { Plug, PlugZap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

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
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<boolean | null>(null)

  const locked = status === 'connected' || status === 'connecting'

  const refreshPorts = async () => {
    if (locked) return
    try {
      const names = await invoke<string[]>('serial_names');
      const current = selectedIndex !== null ? ports[selectedIndex] : undefined
      setPorts(names)
      if (names.length === 0) setSelectedIndex(null)
      else if (current !== undefined && names.includes(current)) {
        setSelectedIndex(names.indexOf(current))
      } else {
        setSelectedIndex(0)
      }
    } catch (e) {
      console.error(e);
    }
  }

  const handleConnect = async () => {
    if (selectedIndex === null) return
    setStatus('connecting')
    setError(null)
    try {
      await invoke('serial_open', {
        portName: ports[selectedIndex],
        baudRate,
      })
      // No basta el open+ACK: espera la primera telemetría con CHK válido (2 s)
      await new Promise<void>((resolve, reject) => {
        let done = false
        let unlisten: (() => void) | undefined
        const timer = setTimeout(() => {
          if (done) return
          done = true
          unlisten?.()
          reject(new Error('sin telemetría (CHK)'))
        }, 2000)
        listen('telemetry', () => {
          if (done) return
          done = true
          clearTimeout(timer)
          unlisten?.()
          resolve()
        }).then((u) => {
          if (done) u()
          else unlisten = u
        }).catch(reject)
      })
      setStatus('connected')
    } catch (e) {
      try {
        await invoke('serial_close')
      } catch {
        /* best-effort */
      }
      setStatus('error')
      console.error(e);
      setError(String(e))
    }
  }

  const handleDisconnect = async () => {
    try {
      await invoke('serial_close')
    } catch (e) {
      console.error(e)
    }
    setStatus('disconnected')
    setLink(null)
  }

  useEffect(() => {
    (async () => {
      try {
        const names = await invoke<string[]>('serial_names');
        setPorts(names);
        setSelectedIndex(names.length ? 0 : null);
      } catch (e) {
        console.error(e);
      }
    })();
    // El hilo lector murió (p.ej. Access denied os error 5): vuelve a DESCONECTADO
    let cancelled = false
    let unlisten: (() => void) | undefined
    let unlistenLink: (() => void) | undefined
    ;(async () => {
      unlisten = await listen<string>('serial-error', (e) => {
        console.error(e.payload)
        setError(String(e.payload))
        setStatus('disconnected')
        setLink(null)
      })
      // Live status: ACK del PING cada 100 ms
      unlistenLink = await listen<boolean>('link', (e) => setLink(e.payload))
      if (cancelled) {
        unlisten()
        unlistenLink()
      }
    })()
    return () => {
      cancelled = true
      unlisten?.()
      unlistenLink?.()
    }
  }, []);

  // Respaldo por si se pierde el evento: sondea el estado real del puerto
  useEffect(() => {
    if (status !== 'connected') return
    const id = setInterval(async () => {
      try {
        const open = await invoke<boolean>('serial_is_open')
        if (!open) {
          setError('puerto cerrado por error de lectura')
          setStatus('disconnected')
        }
      } catch (e) {
        console.error(e)
      }
    }, 2000)
    return () => clearInterval(id)
  }, [status]);

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

      {status === 'connected' && (
        <div
          className={cn(
            'flex items-center gap-2 font-mono text-xs tracking-widest',
            link === null && 'text-muted-foreground',
            link === true && 'text-trace',
            link === false && 'text-destructive',
          )}
          role="status"
          aria-live="polite"
        >
          <span
            className={cn('size-1.5 rounded-full bg-current', link !== false && 'animate-pulse')}
            aria-hidden="true"
          />
          LINK {link === null ? '—' : link ? 'OK' : 'SIN ACK'}
        </div>
      )}

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
              disabled={locked}
              value={selectedIndex ?? ''}
              onFocus={refreshPorts}
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
