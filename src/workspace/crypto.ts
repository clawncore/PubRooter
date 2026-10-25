import type { WorkspaceData } from './types'
import { emptyWorkspace } from './types'

const enc = new TextEncoder()
const dec = new TextDecoder()

const META_KEY = 'pubrooter.workspace.meta.v1'
const DATA_KEY = 'pubrooter.workspace.data.v1'

export interface WorkspaceMeta {
  salt: string
  verifier: string
  email: string
  createdAt: string
  hint: string
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n)
  crypto.getRandomValues(b)
  return b
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function deriveVerifier(passphrase: string, salt: Uint8Array, iterations: number): Promise<string> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    base,
    256
  )
  return toB64(bits)
}

export function loadMeta(): WorkspaceMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY)
    return raw ? (JSON.parse(raw) as WorkspaceMeta) : null
  } catch {
    return null
  }
}

export async function createWorkspace(passphrase: string, profile: { name: string; email: string; affiliation: string }): Promise<void> {
  const salt = randomBytes(16)
  const iterations = 310000
  const verifier = await deriveVerifier(passphrase, salt, iterations)
  const meta: WorkspaceMeta = {
    salt: toB64(salt),
    verifier,
    email: profile.email,
    createdAt: new Date().toISOString(),
    hint: 'Passphrase never leaves this device. If you forget it, the workspace cannot be recovered.'
  }
  localStorage.setItem(META_KEY, JSON.stringify(meta))
  const ws = emptyWorkspace(profile)
  await saveWorkspace(ws, passphrase)
}

export async function verifyPassphrase(passphrase: string): Promise<boolean> {
  const meta = loadMeta()
  if (!meta) return false
  const salt = fromB64(meta.salt)
  const verifier = await deriveVerifier(passphrase, salt, 310000)
  return verifier === meta.verifier
}

export async function saveWorkspace(ws: WorkspaceData, passphrase: string): Promise<void> {
  const meta = loadMeta()
  if (!meta) throw new Error('No workspace found')
  const salt = fromB64(meta.salt)
  const key = await deriveKey(passphrase, salt, 310000)
  const iv = randomBytes(12)
  const plaintext = enc.encode(JSON.stringify(ws))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, plaintext as unknown as BufferSource)
  const payload = { iv: toB64(iv), data: toB64(cipher) }
  localStorage.setItem(DATA_KEY, JSON.stringify(payload))
}

export async function loadWorkspace(passphrase: string): Promise<WorkspaceData> {
  const meta = loadMeta()
  if (!meta) throw new Error('No workspace found')
  const raw = localStorage.getItem(DATA_KEY)
  if (!raw) throw new Error('Workspace data missing')
  const payload = JSON.parse(raw) as { iv: string; data: string }
  const salt = fromB64(meta.salt)
  const key = await deriveKey(passphrase, salt, 310000)
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(payload.iv) as unknown as BufferSource },
      key,
      fromB64(payload.data) as unknown as BufferSource
    )
    const ws = JSON.parse(dec.decode(plain)) as WorkspaceData
    return migrate(ws)
  } catch {
    throw new Error('Incorrect passphrase or corrupted workspace')
  }
}

function migrate(ws: WorkspaceData): WorkspaceData {
  if (ws.version === undefined) ws.version = 1
  if (!ws.projects) ws.projects = []
  if (!ws.savedJournals) ws.savedJournals = []
  if (!ws.activity) ws.activity = []
  if (!ws.defaultPreferences) ws.defaultPreferences = { subjectArea: '', oaPreferred: false, apcMaxUsd: null, articleType: '', preferredPublisher: '', indexingRequired: [], excludedJournals: [] }
  return ws
}

export function workspaceExists(): boolean {
  return loadMeta() !== null
}

export function deleteWorkspace(): void {
  localStorage.removeItem(META_KEY)
  localStorage.removeItem(DATA_KEY)
}
