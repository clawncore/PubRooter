import type { CSSProperties } from 'react'

export function coverTile(title: string) {
  const words = title
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['the', 'of', 'and', 'journal', 'for', 'in'].includes(w.toLowerCase()))
  const initials = (words.slice(0, 2).map((w) => w[0]?.toUpperCase()) ?? []).join('') || title.slice(0, 2).toUpperCase()
  let hash = 0
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) >>> 0
  const palettes = [
    ['#1f4e79', '#e8eef5'],
    ['#5b2c6f', '#f3eaf7'],
    ['#0e6655', '#e6f5f1'],
    ['#7b241c', '#fbeae7'],
    ['#1a5276', '#e9f2f8'],
    ['#4a235a', '#f1eaf6'],
    ['#186a3b', '#e9f6ee'],
    ['#784212', '#fbf1e6']
  ]
  const [fg, bg] = palettes[hash % palettes.length]!
  return { initials, fg, bg }
}

export function JournalCover({ title, className = 'jf-cover' }: { title: string; className?: string }) {
  const cover = coverTile(title)
  const style: CSSProperties = { background: cover.bg, color: cover.fg }
  return (
    <div className={className} style={style} aria-hidden="true">
      <span>{cover.initials}</span>
    </div>
  )
}
