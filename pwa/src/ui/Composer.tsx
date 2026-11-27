import { useEffect, useRef, useState } from 'preact/hooks'
import { hasEmoji } from '../data/display.ts'
import type { Section } from '../data/model.ts'
import { Camera, ChevronLeft, ChevronUp, DateRange, Lock, Mic, Send, Trash } from './icons.tsx'
import { Recorder } from './recorder.ts'
import { ScheduleSheet, type Schedule } from './ScheduleSheet.tsx'

/** Finger travel that cancels (left) or locks (up) a held recording, as in WhatsApp. */
const CANCEL_PX = 110
const LOCK_PX = 80
/** A press shorter than this was a tap: on touch it shows the hint instead of sending. */
const MIN_HOLD_MS = 500
export const MAX_RECORDING_MS = 120_000
const BARS = 28

type Voice =
  | { phase: 'recording'; dx: number; dy: number }
  | { phase: 'locked' }

/**
 * Single-line input with the timer and recipe-scan buttons and send. The timer arms green and
 * clears on submit — unlike Android's sticky Claude checkbox, which the web app doesn't have.
 *
 * With nothing typed, send becomes a mic (WhatsApp's gesture): hold to record and let go to send,
 * slide left to throw it away, slide up to lock and keep recording hands-free. A plain tap only
 * shows the hint on touch; with a mouse or keyboard it starts a locked recording, since holding
 * a mouse button for a minute isn't a thing. The mic stays one DOM node through the whole
 * gesture: touch events keep going to the element the finger landed on, so swapping it out
 * mid-hold would lose the release.
 */
export function Composer({ section, onSubmit, onScan, onVoice, onVoiceError }: {
  section: Section; onSubmit: (text: string, schedule: Schedule) => void; onScan: () => void
  onVoice: (audio: Blob) => void; onVoiceError: (message: string) => void
}) {
  const [text, setText] = useState('')
  const [schedule, setSchedule] = useState<Schedule>({ dueAt: null, repeatWeeks: null })
  const [timerOpen, setTimerOpen] = useState(false)
  const [voice, setVoice] = useState<Voice | null>(null)
  const [levels, setLevels] = useState<number[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [hint, setHint] = useState(false)
  /** The microphone is actually recording (not still starting or waiting for permission). */
  const [live, setLive] = useState(false)
  const recorder = useRef<Recorder | null>(null)
  /** The press in progress on the mic: where it started, when, and whether it began in locked mode. */
  const press = useRef<{ x: number; y: number; at: number; wasLocked: boolean } | null>(null)
  const voiceRef = useRef<Voice | null>(null)
  voiceRef.current = voice
  // The timer and visibility handlers outlive renders; they reach the latest callbacks through this.
  const latest = useRef({ onVoice, onVoiceError })
  latest.current = { onVoice, onVoiceError }

  const armed = schedule.dueAt != null || schedule.repeatWeeks != null
  const placeholder = armed ? `Add to ${section.name}, scheduled`
    : hasEmoji(section) ? `Add to ${section.emoji} ${section.name}` : `Add to ${section.name}`
  const showMic = !text.trim() && Recorder.supported()

  function submit(e?: Event) {
    e?.preventDefault()
    const t = text.trim()
    if (!t) return
    onSubmit(t, schedule)
    setText('')
    setSchedule({ dueAt: null, repeatWeeks: null })
  }

  // ── Recording ──

  function reset() {
    recorder.current = null
    press.current = null
    setVoice(null)
    setLevels([])
    setElapsed(0)
    setLive(false)
  }

  function begin(locked: boolean) {
    if (recorder.current) return
    const r = new Recorder()
    recorder.current = r
    setHint(false)
    setVoice(locked ? { phase: 'locked' } : { phase: 'recording', dx: 0, dy: 0 })
    navigator.vibrate?.(10)
    r.start().then(() => { if (recorder.current === r && r.recording) setLive(true) }, (e: unknown) => {
      if (recorder.current !== r) return
      reset()
      latest.current.onVoiceError(e instanceof Error ? e.message : 'Couldn\'t start the microphone.')
    })
  }

  function cancel() {
    recorder.current?.cancel()
    reset()
  }

  async function send() {
    const r = recorder.current
    if (!r) return
    reset()
    // Sent before the microphone was live (say, during the permission prompt): nothing to send.
    const audio = r.recording ? await r.finish() : (r.cancel(), null)
    if (audio) latest.current.onVoice(audio)
    else latest.current.onVoiceError('Nothing was recorded. Try again once the dot turns red.')
  }

  function down(x: number, y: number) {
    const v = voiceRef.current
    press.current = { x, y, at: Date.now(), wasLocked: v?.phase === 'locked' }
    if (!v) begin(false)
  }

  function move(x: number, y: number) {
    const p = press.current
    const v = voiceRef.current
    if (!p || v?.phase !== 'recording') return
    const dx = Math.min(0, x - p.x)
    const dy = Math.min(0, y - p.y)
    if (dx < -CANCEL_PX) { cancel(); return }
    if (dy < -LOCK_PX) { navigator.vibrate?.(10); setVoice({ phase: 'locked' }); return }
    setVoice({ phase: 'recording', dx, dy })
  }

  function up(touch: boolean) {
    const p = press.current
    press.current = null
    const v = voiceRef.current
    if (!p || !v) return
    if (p.wasLocked) { void send(); return } // the mic is the send button while locked
    if (v.phase === 'locked') return // just slid up into the lock
    const tap = Date.now() - p.at < MIN_HOLD_MS || !recorder.current?.recording
    if (!tap) { void send(); return }
    if (touch) { cancel(); setHint(true) } else setVoice({ phase: 'locked' })
  }

  // Timer, level bars and the two-minute cap.
  useEffect(() => {
    if (!voice) return
    const t = setInterval(() => {
      const r = recorder.current
      if (!r?.recording) return
      const ms = Date.now() - r.startedAt
      setElapsed(ms)
      setLevels((prev) => [...prev.slice(1 - BARS), r.level()])
      if (ms >= MAX_RECORDING_MS) void send()
    }, 100)
    return () => clearInterval(t)
  }, [voice !== null])

  // Leaving the app ends the recording: iOS cuts the microphone off in the background anyway, so
  // send what there is rather than lose it. Unmounting (another section) throws it away.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== 'hidden' || !recorder.current) return
      if (recorder.current.recording && Date.now() - recorder.current.startedAt >= MIN_HOLD_MS) void send()
      else cancel()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => { document.removeEventListener('visibilitychange', onHide); recorder.current?.cancel() }
  }, [])

  useEffect(() => {
    if (!hint) return
    const t = setTimeout(() => setHint(false), 2500)
    return () => clearTimeout(t)
  }, [hint])

  // Mouse: follow the pointer outside the button until it's released.
  function mouseDown(e: MouseEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    down(e.clientX, e.clientY)
    const onMove = (m: MouseEvent) => move(m.clientX, m.clientY)
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); up(false) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const time = `${Math.floor(elapsed / 60000)}:${String(Math.floor(elapsed / 1000) % 60).padStart(2, '0')}`
  const locked = voice?.phase === 'locked'
  const dx = voice?.phase === 'recording' ? voice.dx : 0
  const dy = voice?.phase === 'recording' ? voice.dy : 0

  return (
    <form class={voice ? 'composer recording' : text ? 'composer has-text' : 'composer'} onSubmit={submit}>
      <input class="composer-input" value={text} placeholder={placeholder} enterKeyHint="send" autocomplete="off"
        onInput={(e) => setText(e.currentTarget.value)} />
      {voice && (
        <div class="voice-status" aria-live="polite">
          <span class={live ? 'rec-dot live' : 'rec-dot'} />
          <span class="rec-time">{time}</span>
          <span class="rec-levels" aria-hidden="true">
            {Array.from({ length: BARS }, (_, i) => levels[i - (BARS - levels.length)] ?? 0).map((l, i) => (
              <span key={i} style={{ height: `${Math.max(3, Math.round(l * 22))}px` }} />
            ))}
          </span>
        </div>
      )}
      {hint && !voice && <div class="voice-hint" role="status">Hold to record, release to send</div>}
      <div class="composer-tools">
        {voice ? (
          locked ? (
            <button key="trash" type="button" class="tool" aria-label="Delete recording" onClick={cancel}><Trash /></button>
          ) : (
            <span key="slide" class="rec-slide" style={{ transform: `translateX(${dx}px)`, opacity: 1 + dx / CANCEL_PX }}>
              <ChevronLeft /> Slide to cancel
            </span>
          )
        ) : (
          <>
            <button key="timer" type="button" class={armed ? 'tool armed' : 'tool'} aria-label="Timer" aria-pressed={armed}
              onClick={() => setTimerOpen(true)}><DateRange /></button>
            <button key="scan" type="button" class="tool" aria-label="Scan recipe" onClick={onScan}><Camera /></button>
          </>
        )}
        <span key="spacer" class="spacer" />
        {voice || showMic ? (
          <button key="voice" type="button" class={voice && !locked ? 'send mic held' : 'send mic'}
            aria-label={locked ? 'Send recording' : 'Record a voice note'}
            onTouchStart={(e) => { e.preventDefault(); const t = e.touches[0]; down(t.clientX, t.clientY) }}
            onTouchMove={(e) => { e.preventDefault(); const t = e.touches[0]; move(t.clientX, t.clientY) }}
            onTouchEnd={(e) => { e.preventDefault(); up(true) }}
            onTouchCancel={() => { if (voiceRef.current?.phase === 'recording') cancel() }}
            onMouseDown={mouseDown}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              e.preventDefault()
              if (locked) void send(); else if (!voice) begin(true)
            }}>
            {locked ? <Send /> : <Mic />}
          </button>
        ) : (
          <button key="send" class="send" type="submit" disabled={!text.trim()} aria-label="Add"
            // Keep the keyboard up: a mousedown on the button would otherwise blur the input first.
            onMouseDown={(e) => e.preventDefault()}><Send /></button>
        )}
        {voice?.phase === 'recording' && (
          <span key="lock" class="voice-lock" aria-hidden="true" style={{ transform: `translateY(${dy}px)`, opacity: Math.min(1, 0.6 - dy / LOCK_PX) }}>
            <Lock /><ChevronUp />
          </span>
        )}
      </div>
      {timerOpen && <ScheduleSheet initial={schedule} canClear={armed} onClose={() => setTimerOpen(false)} onSet={setSchedule} />}
    </form>
  )
}
