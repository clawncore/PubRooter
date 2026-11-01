import { supabase } from './supabase'
import { authTrace } from './auth-trace'

/**
 * Session-recovery layer.
 *
 * Session-related failures (expired/refresh-dead tokens, 401s) must attempt
 * recovery before the app declares the session gone. Recovery here means
 * restoring a *live* Supabase session. Silently refreshing it when the
 * refresh token still works, or performing a fresh sign-in when credentials
 * can be obtained. Nothing in this module wipes state or signs the user out;
 * only when recovery is impossible or fails does the caller get an
 * actionable error message back.
 */

const SIGNED_IN_KEY = 'pubrooter.auth.signed-in.v1'
const EMAIL_KEY = 'pubrooter.auth.email.v1'

const ACTIONABLE_EXPIRED = 'Your session expired. Sign in again to continue.'
const ACTIONABLE_REFRESH = 'Your session could not be refreshed. Sign in again to continue.'

let knownEmail: string | null = null

/* ------------------------- session-state markers ------------------------- */

// Best-effort storage: guarded so this works in workers / private mode too.
function remember(key: string, value: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

function recall(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Remember who is signed in so a later expiry can be recovered. */
export function setKnownAuthEmail(email: string | null): void {
  knownEmail = email
  remember(EMAIL_KEY, email)
}

/** True when this browser had a live session earlier (cleared on manual sign-out). */
export function wasSignedIn(): boolean {
  return recall(SIGNED_IN_KEY) === '1'
}

export function markSignedIn(email?: string | null): void {
  remember(SIGNED_IN_KEY, '1')
  if (email) setKnownAuthEmail(email)
}

export function markSignedOut(): void {
  remember(SIGNED_IN_KEY, null)
}

/* ---------------------------- error classification ---------------------------- */

/** Does this failure mean "the session is gone/expired", as opposed to a
 *  network, validation, or permissions problem? */
export function isSessionRelatedError(e: unknown): boolean {
  const code = (e as { code?: unknown; status?: unknown } | null)?.code
  const status = (e as { status?: unknown } | null)?.status
  if (code === 401 || code === '401' || status === 401) return true
  if (code === 'PGRST301' || code === 'PGRST302') return true
  const msg = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase()
  if (!msg) return false
  return [
    'jwt expired',
    'refresh token',
    'session expired',
    'session not found',
    'not signed in',
    'auth session missing',
    'no active session',
    'token has been revoked',
    'invalid refresh token'
  ].some((p) => msg.includes(p))
}

/* --------------------------------- recovery --------------------------------- */

/** Password prompt for a fresh sign-in. Returns null when no prompt-capable
 *  window exists (workers, tests) or the prompt is cancelled/unavailable. */
export async function promptForPassword(): Promise<string | null> {
  try {
    if (typeof window === 'undefined' || typeof window.prompt !== 'function') return null
    const pw = window.prompt('Your session needs to be reconfirmed. Enter your password to continue:')
    return typeof pw === 'string' && pw.length > 0 ? pw : null
  } catch {
    return null
  }
}

/**
 * Attempt to restore a live session without destroying anything:
 *  1. silent path. GetSession()/getUser() transparently refresh an expired
 *     access token when the refresh token is still valid;
 *  2. fresh sign-in - when a prompt-capable window exists, ask for the
 *     password and sign in again.
 * Never throws; returns true only when a valid session exists afterwards.
 * Concurrent callers share one attempt (so an expiry event and a failing
 * save never stack two password prompts).
 */
let reauthInFlight: Promise<boolean> | null = null

export function tryReauth(): Promise<boolean> {
  if (reauthInFlight) return reauthInFlight
  reauthInFlight = doReauth().finally(() => {
    reauthInFlight = null
  })
  return reauthInFlight
}

async function doReauth(): Promise<boolean> {
  if (!supabase) {
    authTrace('reauth-skipped', 'no supabase client')
    return false
  }
  try {
    // 1. Silent refresh of the existing session, if any.
    const { data: boot } = await supabase.auth.getSession()
    const email = boot.session?.user.email ?? knownEmail ?? recall(EMAIL_KEY)
    if (boot.session) {
      const { data, error } = await supabase.auth.getUser()
      if (data.user && !error) {
        authTrace('reauth-recovered', 'silent session refresh')
        return true
      }
      authTrace('reauth-silent-failed', error?.message ?? 'getUser rejected the session')
    } else {
      authTrace('reauth-silent-failed', 'no session to refresh')
    }

    // 2. Fresh sign-in with the known account.
    if (!email) {
      authTrace('reauth-failed', 'no known email for a fresh sign-in')
      return false
    }
    const password = await promptForPassword()
    if (password === null) {
      authTrace('reauth-failed', 'password prompt unavailable or cancelled')
      return false
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.session) {
      authTrace('reauth-failed', error?.message ?? 'no session after sign-in')
      return false
    }
    markSignedIn(email)
    authTrace('reauth-recovered', 'fresh sign-in')
    return true
  } catch (e) {
    authTrace('reauth-error', e instanceof Error ? e.message : String(e))
    return false
  }
}

/**
 * Classify a persistence/load failure. Session-related errors attempt
 * recovery first:
 *   - recovery succeeded → returns null (caller must clear its error state
 *     and may retry the operation. The session is live again);
 *   - recovery impossible or failed → returns an actionable message.
 * Non-session errors pass through unchanged. Never throws.
 */
export async function handleAuthError(e: unknown): Promise<string | null> {
  const msg = e instanceof Error ? e.message : String(e ?? '')
  if (!isSessionRelatedError(e)) {
    authTrace('error-pass-through', msg || 'unknown error')
    return msg || 'Something went wrong. Please try again.'
  }
  authTrace('session-error', msg)
  if (await tryReauth()) {
    authTrace('recovery-ok', 'error suppressed. Session restored')
    return null
  }
  const actionable = /refresh|revoked/i.test(msg) ? ACTIONABLE_REFRESH : ACTIONABLE_EXPIRED
  authTrace('recovery-failed', actionable)
  return actionable
}
