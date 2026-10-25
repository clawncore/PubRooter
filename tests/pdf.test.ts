import { describe, expect, it } from 'vitest'
import { validatePdfFile, validatePdfMagic, deriveMetadata, formatBytes, MAX_UPLOAD_BYTES } from '../src/workspace/pdf'

function blobOf(bytes: Uint8Array, type = 'application/pdf'): Blob {
  return new Blob([bytes as unknown as BlobPart], { type })
}

const encoder = new TextEncoder()

describe('validatePdfFile', () => {
  it('accepts a normal pdf within limits', () => {
    expect(validatePdfFile({ name: 'paper.pdf', size: 1024, type: 'application/pdf' })).toEqual({ ok: true })
  })

  it('rejects empty files', () => {
    const r = validatePdfFile({ name: 'paper.pdf', size: 0, type: 'application/pdf' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/empty/i)
  })

  it('rejects oversized files', () => {
    const r = validatePdfFile({ name: 'paper.pdf', size: MAX_UPLOAD_BYTES + 1, type: 'application/pdf' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/limit/i)
  })

  it('rejects non-pdf extensions regardless of mime', () => {
    const r = validatePdfFile({ name: 'malware.exe', size: 100, type: 'application/pdf' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/only pdf/i)
  })
})

describe('validatePdfMagic', () => {
  it('accepts a file whose header is %PDF-', async () => {
    expect(await validatePdfMagic(blobOf(encoder.encode('%PDF-1.7 rest of file')))).toEqual({ ok: true })
  })

  it('accepts junk before the header within first 1024 bytes', async () => {
    const junk = new Uint8Array(100).fill(0x41)
    const merged = new Uint8Array([...junk, ...encoder.encode('%PDF-1.4')])
    expect(await validatePdfMagic(blobOf(merged))).toEqual({ ok: true })
  })

  it('rejects content that only looks like a pdf by filename', async () => {
    const r = await validatePdfMagic(blobOf(encoder.encode('MZ\x90\x00 this is an executable')))
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/valid PDF header/i)
  })

  it('rejects empty content', async () => {
    expect((await validatePdfMagic(blobOf(new Uint8Array(0)))).ok).toBe(false)
  })
})

const SAMPLE = `
Deep learning for molecular property prediction in drug discovery

Abstract
We present a graph neural network that predicts molecular properties from SMILES representations.
Our model was trained on 200k compounds and evaluated against clinical trial outcomes. Results show
consistent improvements over fingerprint baselines on three benchmark datasets. The method supports
early screening of candidate compounds in pharmaceutical research.

Keywords: graph neural network, drug discovery, molecular property prediction, SMILES

1. Introduction
Structure-based modeling has become central to computational chemistry. Prior work relied on circular fingerprints.

2. Methods
We used message-passing neural networks with attention pooling. Training used Adam with weight decay.

3. Results
Our approach improved MAE by 12 percent across datasets.

4. Conclusion
The model generalizes across chemical spaces and is released as open source.

References
[1] Smith et al. Molecular graphs. Journal of Chemistry. 2019.
[2] Doe et al. Fingerprint baselines. Chem Inf. 2020.
[3] Lee et al. Clinical outcomes. Nature Med. 2021.
`

describe('deriveMetadata', () => {
  const out = deriveMetadata(SAMPLE, 9)

  it('extracts the title from the first substantial line', () => {
    expect(out.title).toMatch(/Deep learning for molecular property/i)
  })

  it('extracts an abstract bounded by the keywords section', () => {
    expect(out.abstract).toMatch(/graph neural network that predicts/)
    expect(out.abstract).not.toMatch(/Keywords:/)
  })

  it('splits keywords', () => {
    expect(out.keywords).toHaveLength(4)
    expect(out.keywords).toContain('SMILES')
  })

  it('detects sections', () => {
    expect(out.sections).toEqual(expect.arrayContaining(['abstract', 'introduction', 'methods', 'results', 'conclusion']))
  })

  it('counts references', () => {
    expect(out.referenceCount).toBe(3)
  })

  it('derives word and page counts', () => {
    expect(out.wordCount).toBeGreaterThan(60)
    expect(out.pageCount).toBe(9)
  })

  it('identifies a discipline hint', () => {
    expect(out.field.length).toBeGreaterThan(0)
  })

  it('warns on near-empty (scanned) text instead of inventing content', () => {
    const scanned = deriveMetadata('   \n\n  ', 3)
    expect(scanned.extractionWarnings.join(' ')).toMatch(/scanned|image-based/i)
    expect(scanned.abstract).toBe('')
    expect(scanned.keywords).toHaveLength(0)
  })

  it('flags unlabelled abstracts instead of fabricating one', () => {
    const odd = deriveMetadata('Some paper text. '.repeat(60), 1)
    expect(odd.extractionWarnings.length).toBeGreaterThan(0)
  })
})

describe('formatBytes', () => {
  it('formats units', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})
