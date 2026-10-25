import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const colabwizeUrl = (import.meta.env.VITE_COLABWIZE_URL as string | undefined) ?? 'https://colabwize.com'

export const isCloud = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isCloud ? createClient(url!, anonKey!) : null

export const COLABWIZE_URL = colabwizeUrl.replace(/\/$/, '')

/** Colabwize's real sign-in page, carrying our landing URL through the
 * whole login process (password / Google / Microsoft / 2FA / survey).
 * Colabwize calls externalAuthHandback() on success and sends the browser
 * back to this origin with session tokens in the URL fragment. */
export function colabwizeHandoffUrl(): string {
  const redirect = `${window.location.origin}/?colabwize_auth=1`
  return `${COLABWIZE_URL}/login?redirect=${encodeURIComponent(redirect)}`
}
