// One voice memo: the microphone through MediaRecorder, plus an analyser for the live level bars.
// AAC in MP4 where the browser can (Safari, recent Chrome), else Opus in WebM; the voice-notes
// function takes both as they are. AAC is asked for by name: Chrome's plain 'audio/mp4' may put
// Opus in the MP4, a pairing the model's audio input isn't documented to read.
// 32 kbps is plenty for speech and keeps two minutes at about half a megabyte.

const TYPES = ['audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']
const BITRATE = 32_000

export class RecorderError extends Error {}

export class Recorder {
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private audio: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private samples: Uint8Array<ArrayBuffer> | null = null
  private stopped = false
  startedAt = 0

  static supported(): boolean {
    return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  }

  /**
   * Asks for the microphone (the first time, iOS shows its prompt here) and starts recording.
   * The AudioContext is made before the await, while we're still inside the tap: iOS only lets
   * one start from a user gesture.
   */
  async start(): Promise<void> {
    if (!Recorder.supported()) throw new RecorderError('Recording isn\'t available in this browser.')
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    this.audio = Ctx ? new Ctx() : null
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
    } catch (e) {
      void this.audio?.close()
      const name = e instanceof DOMException ? e.name : ''
      throw new RecorderError(name === 'NotAllowedError' || name === 'SecurityError'
        ? 'Microphone access is off. Allow it in your browser settings to record.'
        : name === 'NotFoundError' ? 'No microphone found.' : 'Couldn\'t start the microphone.')
    }
    if (this.stopped) { this.release(); return } // let go during the permission prompt

    const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t))
    this.recorder = new MediaRecorder(this.stream, { ...(mimeType && { mimeType }), audioBitsPerSecond: BITRATE })
    this.recorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data) }
    this.recorder.start(250)
    this.startedAt = Date.now()

    if (this.audio) {
      void this.audio.resume()
      this.analyser = this.audio.createAnalyser()
      this.analyser.fftSize = 512
      this.samples = new Uint8Array(new ArrayBuffer(this.analyser.fftSize))
      this.audio.createMediaStreamSource(this.stream).connect(this.analyser)
    }
  }

  get recording(): boolean { return this.recorder?.state === 'recording' }

  /** Loudness right now, 0–1, for the level bars. */
  level(): number {
    if (!this.analyser || !this.samples) return 0
    this.analyser.getByteTimeDomainData(this.samples)
    let sum = 0
    for (const v of this.samples) sum += ((v - 128) / 128) ** 2
    return Math.min(1, Math.sqrt(sum / this.samples.length) * 4)
  }

  /** Stops and hands back the memo; null if nothing was recorded. */
  async finish(): Promise<Blob | null> {
    this.stopped = true
    const recorder = this.recorder
    if (!recorder || recorder.state === 'inactive') { this.release(); return null }
    const done = new Promise<void>((resolve) => { recorder.onstop = () => resolve() })
    recorder.stop()
    await done
    this.release()
    const type = recorder.mimeType || this.chunks[0]?.type || ''
    const blob = new Blob(this.chunks, { type })
    return blob.size > 0 ? blob : null
  }

  /** Stops and throws the memo away. Safe to call at any point, also during start(). */
  cancel(): void {
    this.stopped = true
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.onstop = null
      this.recorder.stop()
    }
    this.chunks = []
    this.release()
  }

  /** Stopping the tracks is what makes the iOS microphone indicator go away. */
  private release(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    if (this.audio && this.audio.state !== 'closed') void this.audio.close()
    this.audio = null
    this.analyser = null
  }
}
