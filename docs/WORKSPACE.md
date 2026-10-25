# PubRooter Workspace — Full Exploration

Everything inside the PubRooter workspace, one piece at a time: every screen, every button that matters, every engine, and where the data lives.

- Entry point: `src/pages/workspace/WorkspaceApp.tsx` (view `tool` in `App.tsx`)
- Styles: `src/workspace/workspace.css`
- State: `src/workspace/WorkspaceContext.tsx` (mounted once in `main.tsx`)
- Engines: `src/lib/matching.ts`, `src/workspace/readiness.ts`, `src/workspace/pdf.ts`, `src/workspace/pipeline.ts`

---

## 1. Getting in (auth)

The workspace never renders until auth resolves. Two modes:

### Cloud mode (Colabwize shared account — default when Supabase is configured)
| Method | What it does |
|---|---|
| **Continue with Colabwize** | Redirects to Colabwize `/login?redirect=<origin>/?colabwize_auth=1`, comes back with `#access_token=…&refresh_token=…`, the provider in `WorkspaceContext` calls `setSession`, cleans the URL, and opens the workspace directly |
| **Google / Microsoft** | Standard Supabase OAuth providers, same return flow |
| **Email + password** | Sign in / Create account tabs. Same email+password as Colabwize. "Forgot it?" points to Colabwize account settings |
| **Auto-import** | On first load, `importColabwizeDrafts()` pulls any Colabwize drafts into workspace projects (best-effort RPC) |

- One account works across both products; the workspace row set is scoped to the user id by row-level security.
- If a load fails, the screen shows the error and returns to `locked`.

### Local mode (no Supabase — passphrase vault)
- **Create workspace**: name, email, affiliation + passphrase (min 8 chars). Data is encrypted with the passphrase and stored in this browser only (`src/workspace/crypto.ts`).
- **Unlock**: passphrase verification → decrypt → workspace.
- Legacy saved-journal list from localStorage is imported on create.

### Locking
- Sidebar **Lock workspace** clears in-memory state (cloud: session stays, screen returns to auth; local: keeps the encrypted vault locked until passphrase again).

---

## 2. The shell (sidebar + layout)

`WorkspaceApp.tsx → Shell`

```
┌──────────────┬────────────────────────────────────────────┐
│ PR PubRooter │                                            │
│              │              main content (one view)       │
│ 6 nav items  │                                            │
│              │                                            │
│ ──────────── │                                            │
│ name/email   │                                            │
│ Lock workspace                                           │
│ Find Journals↗ → public Journal Finder (outside ws)      │
└──────────────┴────────────────────────────────────────────┘
```

- **Nav** (6 entries, active state + `aria-current="page"`): Overview · My Manuscripts · Readiness Checks · Saved Journals · Reports and Exports · Settings.
- Two views are *not* in the nav and highlight "My Manuscripts" while open: **New manuscript** wizard and **Manuscript detail**.
- **Find Journals ↗** leaves the workspace for the public Finder; the session survives the round trip.
- Responsive: ≤1280px tiles go 3-up; ≤900px the sidebar stacks (logo row → horizontally scrollable nav strip → footer row); ≤600px step strips scroll horizontally. Tables scroll *inside* their cards — the page itself never scrolls sideways (verified at 390px: `scrollWidth = 390`).
- Design language: Inter everywhere in the tool (serif is reserved for the public landing/auth), white cards with 1px borders + subtle shadow on `#f6f6f6`, blue `#0056d6` accent, PubMed-style tables (uppercase micro-headers, heavy header rule, totals row), `color-scheme: light` so dark-mode OS can't tint the UI.

---

## 3. Overview (dashboard)

The default screen. **Every figure is computed from your own workspace records — no estimated, model-generated, or sample numbers** (footnote says so explicitly).

### Six metric tiles (each is a button → jumps to the relevant view)
| Tile | Counts | Accent |
|---|---|---|
| Manuscripts | all projects | blue |
| Analyses completed | status = completed | green |
| Journal matches | Σ matches across completed analyses | violet |
| Saved journals | saved list length | teal |
| Readiness checks run | Σ audits across projects | amber |
| Need attention | projects with errors/attention (0 renders muted gray, not red) | red when > 0 |

### Three tables (sortable headers with `aria-sort`, totals row, per-table empty state)
1. **Manuscripts** — title (+keywords, file), created, updated, status badge, matches, latest readiness tally (e.g. `6 pass · 3 attention · 7 unknown`), target journal, actions (`Open` / `View results`). Footer: `1 manuscript · 1 completed · 0 need attention` + total matches.
2. **Readiness checks** — one row per audit: manuscript, journal, run time, pass/attention/warning/unknown counts (colored numerics), engine version, **CSV** download. Footer totals.
3. **Saved journals** — journal (link), publisher, ISSN, score-at-save, saved date, note. Footer: count + snapshot disclaimer.

### Below the tables
- **Recent activity** feed (scroll-capped) — every action logged with date.
- **Recommended next actions** — plain-language guidance ("Nothing urgent…", or reopen a project etc.).
- Honesty footnote about provenance (OpenAlex/Crossref metadata as recorded at analysis/save time).

---

## 4. My Manuscripts

- Table of all projects: project (title + keyword line), file, updated, status badge (+ error line if failed), recommendations count, actions.
- Status badges: `Draft / Uploaded / Extracting / Needs review / Matching journals / Generating results / Completed / Failed` (green/red/blue/gray).
- Actions: **Open / Retry / Continue** (by status) and **Delete** (confirm → project row + stored PDF removed).
- Primary button **New manuscript** → wizard.
- Empty state text differs by mode (private bucket vs this-browser storage).

---

## 5. New manuscript (4-step wizard)

Progress strip: `1 · Upload → 2 · Review extraction → 3 · Constraints → 4 · Analyze`.

1. **Upload**
   - Click-or-drop PDF, 25 MB cap, validated by real header bytes (not just the filename).
   - Privacy line: files are stored privately (browser IndexedDB in local mode, the `pubrooter-manuscripts` storage bucket in cloud mode) and readable only by you; extraction happens **on this device**; scanned/image-only PDFs can't be read — you can type details manually.
   - File row shows name + size + remove.
2. **Review extraction** (client-side pdf.js → `extractFromPdf`)
   - Editable: title, abstract, keywords, field, article type (+ objective/methods hints).
   - Shows extraction warnings (e.g. title-candidate mismatch you can correct), word/page counts.
3. **Constraints** (defaults pre-filled from Settings)
   - Subject area, preferred publisher, max APC (USD), article type, prefer-open-access, indexing required (e.g. Scopus, MEDLINE), excluded journals.
4. **Analyze**
   - Live progress (`extracting → matching → generating`) then lands on the manuscript detail page.
   - Provider failures are retryable; extraction warnings never block analysis.

---

## 6. Manuscript detail (the core working page)

Header: back link · title · meta (`manuscript.pdf · 41 KB · Created … · Updated …`) · actions:
- **Download PDF** (stored original), **Print / PDF report**, **Export CSV**, **Run new analysis** (when completed).
- **Fix details & retry** / **Review details** (when failed/reviewing) → correction form whose **Save & re-run analysis** *always* re-runs (even with unchanged fields — that's how interrupted runs are resumed).

Banners: provider error (retry-safe), rerun note, stored-file note, and — while busy — the in-progress notice.

Sections when analysis exists:
1. **Analyzed notice** — when it ran, candidate count, engine `pubrooter-rank-v1`, and the disclaimer that scores are *relevance, not acceptance probability*; plus any source notices (e.g. provider partial failure).
2. **Tier 1 / Tier 2 / Tier 3** journal cards. Each card:
   - score `/100` (right-aligned, tabular figures)
   - publisher · ISSN · OA · APC · topic chips
   - **Why it matches** — evidence lines with weights (topic overlap, open access, APC, activity, scope)
   - **Limitations** — what could not be verified
   - actions: **View details** (drawer) · **Compare** (max 3) · **Save** (→ Saved Journals, score frozen at save time) · **Submit to** (marks the submission action)
3. **Compare selected journals** — side-by-side table + **Export comparison CSV** + Clear.
4. **Readiness check** section — target journal (defaults to selected/first match), **Run readiness check**, then the full check list with `pass / attention / warning / unknown` badges, explanations and source links, per-check **Mark resolved**, and CSV/print export.
5. **Journal drawer** (from View details): score with "relevance, not a probability of acceptance", weighted evidence breakdown, metadata definition list (homepage, publisher, ISSN, OA, APC, topic, activity), an indexing caveat (OpenAlex topics ≠ Scopus/MEDLINE/PubMed indexing — verify on the journal site), Save / Compare buttons.

---

## 7. Readiness Checks (dedicated view)

- Intro states the honesty rule: items that cannot be verified — usually because author instructions live behind the journal's site — stay **unknown, never passed**. Engine: `pubrooter-readiness-v1`.
- Per analyzed manuscript: journal `<select>` (options = that analysis's matches) → run a check.
- **Audit table** across the workspace: manuscript, journal, run time, pass / attention / warning / unknown counts, engine version, per-row **CSV**.
- Audits are capped at 20 per project (newest first).
- Empty state → "Analyze a Manuscript".

### What the engine checks (from extracted content + journal metadata)
Title present · Abstract present · Abstract length · Keywords provided · Required manuscript sections · Methods section · Reference list · Funding statement · Conflict-of-interest declaration · Ethics/consent statement · Data availability statement · Manuscript length · Figure and table requirements · Reference style · File-format requirements · Publication charges · Article type compatibility.
Each check carries an explanation, optional source URL, and optional evidence string.

---

## 8. Saved Journals

- Table: journal (external link) · publisher · ISSN · **score recorded at save** · saved date · inline **note** field (saves on blur) · Remove.
- Snapshot disclaimer: metadata changes on the source side — re-run an analysis for fresh figures.
- Saves can come from the detail page, the drawer, or the public Finder.

---

## 9. Reports and Exports

- Per completed manuscript: **Recommendations CSV**, **Readiness CSV** (if audited), **Print / PDF report**.
- **Workspace export**: whole workspace (projects, saved journals, activity) as JSON for backup/migration.
- Comparison export lives on the detail page (needs ≥ 2 compared journals).
- Empty state explains exports unlock after a completed analysis.
- Exports never include full manuscript text — metadata and checklist results only.

---

## 10. Settings

1. **Profile** — name, affiliation (+ email shown), Save profile.
2. **Default research constraints** — preferred subject area, preferred publisher, default max APC, prefer open access, Reset defaults. Applied to new manuscripts; each project can override.
3. **Privacy and data retention** (the actual behavior, not marketing):
   - Workspace rows + PDFs live in your Colabwize Supabase project, scoped to your account (RLS).
   - One account across Colabwize and PubRooter.
   - Manuscript PDFs in a private bucket readable only by your user id.
   - Manuscript text is never written to application logs.
   - OpenAlex/Crossref queries send title/keyword text only — never file contents.
   - Third parties: OpenAlex + Crossref (metadata). **No AI or OCR provider receives your manuscript.**
   - Data lives until you delete it; deleting a project removes its record and its stored PDF.
4. **Workspace actions** — **Lock workspace** and **Delete workspace…** (two-step confirm: "Yes, delete everything" → deletes cloud rows + stored PDFs, or the local vault, and locks the screen).

---

## 11. Engines & honesty rules

| Engine | Version | What it does |
|---|---|---|
| Ranking | `pubrooter-rank-v1` | **Deterministic** token-overlap scoring (`src/lib/matching.ts`). No LLM, no model calls anywhere in the app. Produces score + weighted evidence (topic overlap, OA, APC, activity, scope) + limitations, then three fit tiers. |
| Discovery | — | Works-based: finds where similar papers are actually published (OpenAlex works → sources bulk-fetch; Crossref works → container titles), plus a keyword journal-name leg. Deduped by source id / ISSN. Provider failures surface as notices, never fabricated candidates. |
| Extraction | — | Client-side pdf.js (`src/workspace/pdf.ts`) → title/abstract/keywords/field/article type/sections/entities/counts + warnings. |
| Readiness | `pubrooter-readiness-v1` | Rule-based checklist over your extracted text + journal metadata. Verifiable → pass; likely problem → attention/warning; not verifiable → **unknown** (never "pass"). |

Universal honesty rules:
- No invented metrics: dashboard tiles/tables derive only from workspace rows.
- Scores are relevance, not acceptance probability (stated on-screen).
- Unknown requirements are never shown as passed.
- Saved scores are snapshots from save time.

---

## 12. Data model & storage

### `WorkspaceData` (`src/workspace/types.ts`)
```
version, profile{name,email,affiliation},
projects: ManuscriptProject[]   // file ref, extracted/edited, preferences,
                                // analysis{matches,tiers,notices,engine,candidateCount},
                                // audits[], selectedJournalId, comparedJournalIds,
                                // actionsCompleted, status, error
savedJournals: SavedJournalRecord[]   // journalId, title, publisher, issn, link, score, note
activity: ActivityEvent[]              // kind: project|analysis|readiness|save|report|settings (max 100)
defaultPreferences: ResearchPreferences
```

### Storage paths
| | Cloud mode | Local mode |
|---|---|---|
| Workspace rows | Postgres tables `pubrooter_*` (projects, saved journals, activity, profile) via `cloud.ts`, RLS per user | Encrypted JSON in IndexedDB (`crypto.ts`) |
| Manuscript PDFs | Storage bucket `pubrooter-manuscripts`, path `<userId>/<projectId>.pdf` | IndexedDB (`storage.ts` → local fallback) |
| Session | Supabase auth (shared with Colabwize) | Passphrase |

### Persistence guarantees (important, recently hardened)
- Saves are debounced (250 ms) and **serialized through a single chain**; each save diffs against the **last-synced markers** (not a previous snapshot), so a cancelled debounce can no longer drop changes — analysis results, saves, audits and profile edits all survive reload.
- Activity inserts are **idempotent** (upsert on id) — re-sends never 409.
- **Interrupted-run recovery**: analysis runs only live in memory; if a project is still `extracting/matching/generating` at load time, it is presented as a retryable *failed* with a clear message instead of an eternal progress banner.
- **Wipe** deletes project rows *and* stored PDFs, then locks.

---

## 13. Activity log

Every meaningful action appends an event (`log()` in context): analysis completed/re-run, readiness run, journal saved, report exported, project uploaded/deleted, drafts imported, settings changed. Rendered on Overview with dates; capped at 100 events; synced to the cloud table incrementally (only unseen ids).

---

## 14. Accessibility & UX details

- Keyboard: all controls are real buttons/links, `aria-current` nav, `aria-sort` sortable headers, `aria-label`s on icon-only/standalone inputs, visible `:focus-visible` rings, Escape/backdrop closes the drawer.
- Status is never color-only (text badges), counts use `tabular-nums`.
- `prefers-reduced-motion` disables the analysis progress animation.
- Loading/empty/error states exist for every view; provider failures show retry-safe messages.
- Tables scroll horizontally inside their cards on narrow screens instead of crushing columns.

---

## 15. Source file map

| Area | File |
|---|---|
| Shell / views / routing | `src/pages/workspace/WorkspaceApp.tsx` |
| Overview dashboard | `src/pages/workspace/Overview.tsx` (+ `src/workspace/dashboard.ts` sort/tally helpers) |
| Manuscripts list | `src/pages/workspace/ManuscriptsView.tsx` |
| Upload wizard | `src/pages/workspace/NewManuscript.tsx` |
| Project page | `src/pages/workspace/ManuscriptDetail.tsx` |
| Journal drawer | `src/pages/workspace/JournalDrawer.tsx` |
| Readiness view | `src/pages/workspace/ReadinessView.tsx` |
| Saved journals | `src/pages/workspace/SavedJournalsView.tsx` |
| Reports | `src/pages/workspace/ReportsView.tsx` |
| Settings | `src/pages/workspace/SettingsView.tsx` |
| Auth screen | `src/pages/workspace/AuthScreen.tsx` |
| State/auth/persistence | `src/workspace/WorkspaceContext.tsx` |
| Cloud API | `src/workspace/cloud.ts` · local vault `src/workspace/crypto.ts` |
| PDF storage | `src/workspace/storage.ts` (mode-aware) |
| PDF extraction | `src/workspace/pdf.ts` |
| Analysis pipeline | `src/workspace/pipeline.ts` (OpenAlex + Crossref, all-settled, auto-audit) |
| Ranking | `src/lib/matching.ts` · discovery `src/api/openalex.ts`, `src/api/crossref.ts` |
| Readiness engine | `src/workspace/readiness.ts` |
| Exports | `src/workspace/reports.ts` |
| Activity | `src/workspace/activity.ts` |
| Types/model | `src/workspace/types.ts` |
| Styles | `src/workspace/workspace.css` |

---

## 16. Verification status

- `tsc --noEmit` clean; **68/68 unit tests** (8 files); production build OK.
- Browser E2E (`/tmp/opencode/verify.js`): **13/13 checks, 0 console errors, 0 HTTP ≥400** — covers sign-in handoff, recovery of interrupted runs, live analysis (32 candidates), save, readiness, **reload persistence** (tiles 1/1/32/1/2/0), sorting, CSV export, Finder round trip, and mobile overflow (390 px exact).
- Screenshots of every view: `/tmp/opencode/shots/`.
