// Recipe scan: a photo goes to the scan-recipe Edge Function (supabase/functions), which asks a
// vision model for the ingredient list. Online-only like sharing; the items it yields are added
// locally with notes.addItems and sync like any other.
import { FunctionsFetchError, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'

/** The server call, kept apart so the demo can stand in for it. */
export interface ScanRemote {
  /** A base64 JPEG in, the ingredient lines out (possibly none). */
  scan(jpegBase64: string): Promise<string[]>
}

const OFFLINE = 'You\'re offline. Scanning needs a connection.'

export class SupabaseScan implements ScanRemote {
  private sb: SupabaseClient
  constructor(sb: SupabaseClient) { this.sb = sb }

  async scan(jpegBase64: string): Promise<string[]> {
    const { data, error } = await this.sb.functions.invoke<{ ingredients?: unknown }>('scan-recipe', { body: { image: jpegBase64 } })
    if (error) throw new Error(await describe(error))
    const list = Array.isArray(data?.ingredients) ? data.ingredients : []
    return list.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
  }
}

async function describe(error: unknown): Promise<string> {
  if (error instanceof FunctionsFetchError) return OFFLINE
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response
    if (res.status === 401) return 'Your session expired. Sign in again to scan.'
    const body = await res.json().catch(() => null) as { error?: string } | null
    if (body?.error) return capitalize(body.error)
  }
  return error instanceof Error && /fetch|network/i.test(error.message) ? OFFLINE : 'Scan failed. Try again.'
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? '' : '.')
