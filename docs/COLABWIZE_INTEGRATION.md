# Colabwize ↔ PubRooter integration

One account across both products, Scribd/SlideShare style. Both apps point at the **same Supabase project** — same `auth.users`, separate content tables.

## What PubRooter expects from Colabwize

### 1. Shared auth (already works)

Because PubRooter uses the same `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`:

- A user who signs up on **either** app can sign in on the other with the same email + password — no linking step.
- `supabase/migrations/0001_workspace_schema.sql` creates a `profiles` row for every `auth.users` row (existing Colabwize users are backfilled automatically).

### 2. "Continue with Colabwize" button (the Scribd pattern)

PubRooter's sign-in screen has a **Continue with Colabwize** button that navigates to Colabwize's **real sign-in page**:

```
{VITE_COLABWIZE_URL}/login?redirect={encoded PubRooter origin + /?colabwize_auth=1}
```

The user completes the **entire Colabwize login process** — password, Google, Microsoft, 2FA, new-user survey — exactly as on Colabwize itself. Colabwize's auth pages (`LoginPage`, `CallbackPage`, `SignupPage`) call `externalAuthHandback()` before navigating to `/dashboard`:

1. If `redirect` is an absolute external URL, Colabwize fetches the current Supabase session and redirects the browser there with the tokens appended as **URL fragments**:
   ```
   {redirect}#access_token={access_token}&refresh_token={refresh_token}
   ```
   If no session exists, it redirects without tokens (PubRooter then shows its own sign-in).
2. In-app paths (`/dashboard`, `/admin`, checkout) are untouched — `externalAuthHandback()` returns false and the normal flow proceeds.
3. The `?redirect=` param is carried through every branch: OAuth round-trip via `/auth/callback?redirect=…`, 2FA via `/login?…&redirect=…`, new-user survey via `/signup?redirect=…`.
4. PubRooter's `WorkspaceProvider` reads the tokens from the URL, calls `supabase.auth.setSession()`, clears the URL, and loads the workspace — the user lands straight in PubRooter signed in.

Legacy links to `{VITE_COLABWIZE_URL}/auth/pubrooter?redirect_to=…` still work: that page hands back instantly if a session exists, otherwise forwards to `/login?redirect=…`.

> Tokens in a fragment are not sent to servers in the referrer and are consumed once by the SPA. This is the same class of handoff used by auth-widget redirects.

**Supabase dashboard requirement:** none for redirects — verified against the live project's `/auth/v1/authorize` that `https://www.colabwize.com/auth/callback?redirect=…`, plain callback, and `http://localhost:3000/?oauth=1` are all already allowlisted (302 to the provider, not an error).

**Schema:** `supabase/migrations/0001_workspace_schema.sql` has been **applied** to project `xkfyhlqncoyxotyivomp` (tables + RLS + triggers + storage bucket + import RPC + grants). Re-running it is idempotent. Tables are prefixed `pubrooter_` to avoid colliding with Colabwize's Prisma-owned `users`/`projects`.

### 3. Draft import (optional, automatic)

If Colabwize stores drafts in a table `colabwize_drafts` on the same Supabase project with at least:

```sql
id, user_id, title, abstract, updated_at
```

…the SQL function `import_colabwize_drafts()` (in the migration above) copies un-imported drafts into `public.projects` with `source = 'colabwize'`. PubRooter calls it on first sign-in and exposes "Import from Colabwize" in the workspace. If your column names differ, edit the mapping in that function.

If Colabwize's drafts live elsewhere (different table shape), share the schema and the function gets adjusted.

## What Colabwize gets

- New PubRooter signups appear in the same `auth.users` — usable on Colabwize immediately.
- A `profiles` row per user (name/email/affiliation + default research preferences) that Colabwize can read if useful.
- No changes required to Colabwize's existing tables beyond the optional `colabwize_drafts` bridge.
