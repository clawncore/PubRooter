import { supabase, isCloud } from '../lib/supabase'

const BUCKET = 'pubrooter-manuscripts'

const DB_NAME = 'pubrooter-files'
const STORE = 'manuscripts'

interface FileRow {
  id: string
  name: string
  size: number
  type: string
  data: ArrayBuffer
  storedAt: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'))
  })
}

async function localStore(id: string, file: File): Promise<void> {
  const db = await openDb()
  const row: FileRow = {
    id,
    name: file.name,
    size: file.size,
    type: file.type || 'application/pdf',
    data: await file.arrayBuffer(),
    storedAt: new Date().toISOString()
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(row)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Store failed'))
  })
  db.close()
}

async function localGet(id: string): Promise<File | null> {
  const db = await openDb()
  const row = await new Promise<FileRow | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve((req.result as FileRow) ?? null)
    req.onerror = () => reject(req.error ?? new Error('Read failed'))
  })
  db.close()
  if (!row) return null
  return new File([row.data], row.name, { type: row.type })
}

async function localDelete(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Delete failed'))
  })
  db.close()
}

function storagePath(userId: string, id: string): string {
  return `${userId}/${id}.pdf`
}

export async function storeFile(id: string, file: File): Promise<void> {
  if (!isCloud || !supabase) return localStore(id, file)
  const { data: userData } = await supabase.auth.getUser()
  const uid = userData.user?.id
  if (!uid) throw new Error('Not signed in.')
  const path = storagePath(uid, id)
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'application/pdf',
    upsert: true
  })
  if (error) throw new Error(`Could not store manuscript: ${error.message}`)
}

export async function getFile(id: string): Promise<File | null> {
  if (!isCloud || !supabase) return localGet(id)
  const { data: userData } = await supabase.auth.getUser()
  const uid = userData.user?.id
  if (!uid) return null
  const path = storagePath(uid, id)
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error || !data) return null
  return new File([data], `${id}.pdf`, { type: 'application/pdf' })
}

export async function deleteFile(id: string): Promise<void> {
  if (!isCloud || !supabase) return localDelete(id)
  const { data: userData } = await supabase.auth.getUser()
  const uid = userData.user?.id
  if (!uid) return
  const path = storagePath(uid, id)
  await supabase.storage.from(BUCKET).remove([path])
}
