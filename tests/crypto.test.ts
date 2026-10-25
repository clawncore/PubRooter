import { beforeAll, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()

beforeAll(() => {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k)
  })
})

describe('workspace encryption', () => {
  it('creates, saves, loads, and rejects a wrong passphrase', async () => {
    const { createWorkspace, loadWorkspace, verifyPassphrase, workspaceExists, deleteWorkspace } = await import('../src/workspace/crypto')

    deleteWorkspace()
    expect(workspaceExists()).toBe(false)

    await createWorkspace('correct horse battery staple', { name: 'Ada', email: 'ada@inst.edu', affiliation: 'Lab' })
    expect(workspaceExists()).toBe(true)

    expect(await verifyPassphrase('correct horse battery staple')).toBe(true)
    expect(await verifyPassphrase('wrong passphrase!')).toBe(false)

    const ws = await loadWorkspace('correct horse battery staple')
    expect(ws.profile.email).toBe('ada@inst.edu')
    expect(ws.projects).toEqual([])
    expect(ws.version).toBeGreaterThanOrEqual(1)

    await expect(loadWorkspace('wrong passphrase!')).rejects.toThrow(/incorrect passphrase/i)
  })

  it('persists workspace mutations across save/load', async () => {
    const { loadWorkspace, saveWorkspace } = await import('../src/workspace/crypto')
    const pass = 'correct horse battery staple'
    const ws = await loadWorkspace(pass)
    ws.projects.push({
      id: 'p1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: 'Test project',
      fileName: null,
      fileSize: null,
      hasStoredFile: false,
      status: 'draft',
      error: null,
      extracted: null,
      edited: null,
      preferences: { subjectArea: '', oaPreferred: false, apcMaxUsd: null, articleType: '', preferredPublisher: '', indexingRequired: [], excludedJournals: [] },
      analysis: null,
      audits: [],
      selectedJournalId: null,
      comparedJournalIds: [],
      actionsCompleted: []
    })
    await saveWorkspace(ws, pass)
    const reloaded = await loadWorkspace(pass)
    expect(reloaded.projects).toHaveLength(1)
    expect(reloaded.projects[0]!.name).toBe('Test project')
  })
})
