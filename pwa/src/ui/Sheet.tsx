import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'

/** Drag on the grip: this far down (of the sheet's height), or a flick, closes or collapses it. */
const CLOSE_FRACTION = 0.25
const EXPAND_PX = 60
const FLICK_PX_PER_MS = 0.5
const SETTLE_MS = 200

/**
 * A bottom sheet — the iOS-native stand-in for Android's dialogs and dropdown menus, and within
 * thumb reach. Tapping the scrim closes it, unless `scrimCloses` is false: for a sheet holding
 * work that a stray tap above it shouldn't throw away. Escape always closes, it's deliberate.
 *
 * The grip works like iOS's: drag it up to open the sheet to full height, down to close it (from
 * full height, down first goes back to normal). Dragging down closes even when the scrim
 * doesn't, because a drag is as deliberate as Escape. Only the grip strip takes the gesture;
 * the body below it scrolls, so a scroll can't be mistaken for a dismiss. Touch events, not
 * pointer events, for the reason in useRowGestures.ts.
 */
export function Sheet({ onClose, children, label, scrimCloses = true }: {
  onClose: () => void; children: ComponentChildren; label?: string; scrimCloses?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  /** The drag in progress; `v` is the speed of the latest movement (px/ms, + is down), for flicks. */
  const drag = useRef<{ y0: number; h0: number; dy: number; lastY: number; lastT: number; v: number } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function start(y: number) {
    const el = ref.current
    if (!el) return
    drag.current = { y0: y, h0: el.getBoundingClientRect().height, dy: 0, lastY: y, lastT: Date.now(), v: 0 }
    el.style.transition = 'none'
    el.style.animation = 'none'
  }

  function move(y: number) {
    const d = drag.current
    const el = ref.current
    if (!d || !el) return
    d.dy = y - d.y0
    const now = Date.now()
    if (now > d.lastT) { d.v = (y - d.lastY) / (now - d.lastT); d.lastY = y; d.lastT = now }
    if (d.dy > 0) {
      el.style.transform = `translateY(${d.dy}px)`
      el.style.height = ''
    } else if (!expanded) {
      // Upwards the sheet grows under the finger, up to the full height it would open to.
      const max = (el.parentElement?.clientHeight ?? window.innerHeight) - topGap()
      el.style.transform = ''
      el.style.maxHeight = 'none'
      el.style.height = `${Math.min(max, d.h0 - d.dy)}px`
    }
  }

  function end() {
    const d = drag.current
    const el = ref.current
    drag.current = null
    if (!d || !el) return
    // A finger that stopped before lifting isn't flicking.
    const speed = Date.now() - d.lastT < 100 ? d.v : 0
    el.style.transition = `transform ${SETTLE_MS}ms ease, height ${SETTLE_MS}ms ease`
    const down = d.dy > d.h0 * CLOSE_FRACTION || speed > FLICK_PX_PER_MS
    const up = -d.dy > EXPAND_PX || speed < -FLICK_PX_PER_MS
    if (d.dy > 0 && down && !expanded) {
      el.style.transform = 'translateY(100%)'
      setTimeout(onClose, SETTLE_MS)
      return
    }
    el.style.transform = ''
    if (d.dy > 0 && down) setExpanded(false)
    else if (d.dy < 0 && up) setExpanded(true)
    // Hand the height back to the classes (normal or expanded); the transition settles it.
    el.style.height = ''
    el.style.maxHeight = ''
  }

  function mouseDown(e: MouseEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    start(e.clientY)
    const onMove = (m: MouseEvent) => move(m.clientY)
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); end() }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div class="scrim" onClick={(e) => { if (scrimCloses && e.target === e.currentTarget) onClose() }}>
      <div ref={ref} class={expanded ? 'sheet expanded' : 'sheet'} role="dialog" aria-modal="true" aria-label={label}>
        <div class="sheet-handle" aria-hidden="true"
          onTouchStart={(e) => { e.preventDefault(); start(e.touches[0].clientY) }}
          onTouchMove={(e) => { e.preventDefault(); move(e.touches[0].clientY) }}
          onTouchEnd={(e) => { e.preventDefault(); end() }}
          onTouchCancel={() => end()}
          onMouseDown={mouseDown}>
          <div class="sheet-grip" />
        </div>
        <div class="sheet-body">{children}</div>
      </div>
    </div>
  )
}

/** Room left above a full-height sheet: the status bar plus a strip of the screen behind. */
function topGap(): number {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top);visibility:hidden'
  document.body.append(probe)
  const inset = probe.getBoundingClientRect().height
  probe.remove()
  return inset + 12
}

export interface MenuEntry { label: string; onSelect: () => void; danger?: boolean }

export function MenuSheet({ title, entries, onClose }: { title?: string; entries: MenuEntry[]; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} label={title}>
      {title && <p class="sub">{title}</p>}
      {entries.map((e) => (
        <button key={e.label} class={e.danger ? 'menu-item danger' : 'menu-item'} onClick={() => { onClose(); e.onSelect() }}>
          {e.label}
        </button>
      ))}
    </Sheet>
  )
}

export function ConfirmSheet({ title, message, confirm, onConfirm, onClose }: {
  title: string; message: string; confirm: string; onConfirm: () => void; onClose: () => void
}) {
  return (
    <Sheet onClose={onClose} label={title}>
      <h2>{title}</h2>
      <p class="sub">{message}</p>
      <div class="sheet-actions">
        <button class="btn text" onClick={onClose}>Cancel</button>
        <button class="btn text danger" onClick={() => { onClose(); onConfirm() }}>{confirm}</button>
      </div>
    </Sheet>
  )
}
