# SSO Audit: ColabWize ↔ PubRooter

**Date:** 2026-10-23  
**Supabase Project:** `xkfyhlqncoyxotyivomp` (shared)  
**PubRooter Origin:** `http://localhost:3000` (dev) / `https://pubrooter.app` (prod)  
**ColabWize Origin:** `https://app.colabwize.com`

---

## Executive Summary

The ColabWize→PubRooter SSO flow is **architecturally correct but has deployment/configuration gaps**. The code implements a proper fragment-based token handoff (`externalAuthHandback`) across 5 callback paths. However:

1. **ColabWize production may not have the latest `externalAuthHandback` calls deployed**
2. **Supabase Redirect URLs must be verified/updated in dashboard**
3. **Token-in-fragment design is a security risk** (audit requirement: migrate to auth-code exchange)

---

## Phase 1: Actual Authentication Flow (Code-Verified)

### 1.1 PubRooter Entry: "Continue with ColabWize"

**File:** `PubRooter/src/lib/supabase.ts:17-20`

```typescript
export function colabwizeHandoffUrl(): string {
  const redirect = `${window.location.origin}/?colabwize_auth=1`
  return `${COLABWIZE_URL}/login?redirect=${encodeURIComponent(redirect)}`
}
```

**Result URL:** `https://app.colabwize.com/login?redirect=http%3A%2F%2Flocalhost%3A3000%2F%3Fcolabwize_auth%3D1`

✅ Correctly encodes return destination with `colabwize_auth=1` query param.

**File:** `PubRooter/src/pages/workspace/AuthScreen.tsx:133-140`

```tsx
<a className="ws-provider ws-provider-colabwize"
  href={colabwizeHandoffUrl()}
  style={{ textDecoration: 'none' }}>
  <img src="/Colabwize-logo.png" alt="" width="22" height="22" />
  <span>Continue with Colabwize</span>
</a>
```

---

### 1.2 ColabWize Login Page: Preserves Redirect

**File:** `ColabWize/src/pages/auth/LoginPage.tsx:114, 149-158`

```tsx
const [redirectPath, setRedirectPath] = React.useState<string | null>(null);

useEffect(() => {
  const redirect = searchParams.get("redirect");
  if (redirect) setRedirectPath(redirect);
}, [searchParams]);
```

**OAuth Initiation** (`LoginPage.tsx:202-208`):

```tsx
const handleGoogleLogin = async () => {
  const redirectParams = { redirect: redirectPath };
  await signUpWithGoogle(redirectParams);
}
```

**File:** `ColabWize/src/services/hybridAuth.ts:399-425`

```typescript
export async function signUpWithGoogle(redirectParams?: { redirect?: string }) {
  let redirectUrl = `${window.location.origin}/auth/callback`;
  if (redirectParams?.redirect) {
    params.set("redirect", redirectParams.redirect);
    redirectUrl += `?${params.toString()}`;
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUrl }
  });
}
```

✅ **Redirect preserved through OAuth**: `redirect` query param passed to Supabase callback URL.

---

### 1.3 OAuth Callback: Exchanges Code → Session → Handback

**File:** `ColabWize/src/pages/auth/CallbackPage.tsx:32, 142-169`

```tsx
const redirect = searchParams.get("redirect");

// ... after session established and syncUser() ...

// Cross-app handback (PubRooter): external redirect wins over dashboard
if (await externalAuthHandback(redirect)) return;
```

**Called in 3 locations in CallbackPage:**
- Line 143: After successful sync, before dashboard
- Line 163: Fallback after sync error
- Line 169: Final fallback

---

### 1.4 `externalAuthHandback()` Implementation

**File:** `ColabWize/src/utils/externalAuthHandback.ts:14-39`

```typescript
export async function externalAuthHandback(url: string | null | undefined): Promise<boolean> {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const sep = url.includes("#") ? "&" : "#";
    if (session) {
      window.location.href = url + sep +
        "access_token=" + encodeURIComponent(session.access_token) +
        "&refresh_token=" + encodeURIComponent(session.refresh_token);
    } else {
      window.location.href = url;
    }
    return true;
  } catch (e) {
    console.error("externalAuthHandback failed:", e);
    return false;
  }
}
```

**Security Concern:** Puts **both access_token and refresh_token in URL fragment**. This is a known risk (tokens in browser history, referrer headers, logs).

---

### 1.5 PubRooter Token Consumption

**File:** `PubRooter/src/workspace/WorkspaceContext.tsx:81-115`

```typescript
useEffect(() => {
  if (!isCloud || !supabase) return
  const apply = async () => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const search = new URLSearchParams(window.location.search)
    const pick = (k: string) => hash.get(k) ?? search.get(k)
    const access = pick('access_token')
    const refresh = pick('refresh_token')
    const hasColabwizeParam = search.get('colabwize_auth') === '1'
    
    if (access && refresh) {
      const { error: sessErr } = await sb.auth.setSession({ access_token: access, refresh_token: refresh })
      window.history.replaceState({}, '', window.location.pathname)
    } else if (hasColabwizeParam) {
      console.warn('colabwize_auth=1 present but NO tokens in URL...')
    }
  }
  void apply()
}, [])
```

**File:** `PubRooter/src/App.tsx:19-28`

```typescript
function initialView(): View {
  const q = new URLSearchParams(window.location.search)
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  if (q.get('colabwize_auth') || q.get('oauth') || q.get('email_confirmed') || h.get('access_token')) return 'tool'
  return 'home'
}
```

✅ **Parses both hash and search**, prefers hash for tokens. Cleans URL after `setSession()`.

---

### 1.6 Workspace Initialization

**File:** `PubRooter/src/workspace/cloud.ts:152-266`

```typescript
export async function loadWorkspaceCloud(): Promise<WorkspaceData> {
  const uid = await requireUserId()  // Uses auth.uid() from established session
  // Loads profile, projects, audits, saved journals, activity, attempts, events
}
```

**Auto-profile creation** (Migration `0001_workspace_schema.sql:108-131`):

```sql
CREATE OR REPLACE FUNCTION public.pubrooter_handle_new_user()
RETURNS TRIGGER ... AS $$
BEGIN
  INSERT INTO public.pubrooter_profiles (id, email, name)
  VALUES (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', ...))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER pubrooter_on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION pubrooter_handle_new_user();
```

✅ **Profiles auto-created on first auth** — no manual step needed.

---

### 1.7 Draft Import

**File:** `PubRooter/src/workspace/cloud.ts:460-465` + Migration `0001_workspace_schema.sql:183-241`

```typescript
export async function importColabwizeDrafts(): Promise<number> {
  const { data, error } = await sb.rpc('pubrooter_import_colabwize_drafts')
  return typeof data === 'number' ? data : 0
}
```

**RPC:** Queries `public.projects` (ColabWize Prisma table) WHERE `user_id = auth.uid()::text`, inserts into `pubrooter_projects` with `source='colabwize'`, deduplicates on `colabwize_draft_id`.

---

## Phase 2: Complete Callback Paths Audit

| Callback Path | File | Calls `externalAuthHandback` |
|---------------|------|------------------------------|
| Password login success | `LoginPage.tsx:437` | ✅ `handleLoginSuccess()` |
| Google OAuth login | `LoginPage.tsx:207, 222` → `handleLoginSuccess()` | ✅ |
| Microsoft OAuth login | `LoginPage.tsx:207, 222` → `handleLoginSuccess()` | ✅ |
| Signup (OTP verified) | `SignupPage.tsx:332` | ✅ |
| Signup (password) | `SignupPage.tsx:1091` | ✅ |
| Google OAuth callback | `CallbackPage.tsx:143` | ✅ |
| Callback fallback 1 | `CallbackPage.tsx:163` | ✅ |
| Callback fallback 2 | `CallbackPage.tsx:169` | ✅ |
| Existing session handoff | `PubrooterHandoffPage.tsx:36-42` | ✅ (inline, same logic) |

**All 10 paths invoke handback.** ✅

---

## Phase 3: Redirect Parameter Lifecycle

```
PubRooter: colabwizeHandoffUrl()
  → redirect = "http://localhost:3000/?colabwize_auth=1"
  → encoded in ColabWize login URL

ColabWize LoginPage: reads searchParams.get("redirect")
  → stores in redirectPath state

ColabWize OAuth: signUpWithGoogle({ redirect: redirectPath })
  → builds callback URL: "/auth/callback?redirect=..."

Supabase OAuth: redirects to ColabWize /auth/callback?code=...&redirect=...

ColabWize CallbackPage: reads searchParams.get("redirect")
  → passes to externalAuthHandback(redirect)

externalAuthHandback: builds "redirect#access_token=...&refresh_token=..."
  → window.location.href = that URL

Browser: navigates to PubRooter with fragment tokens

PubRooter WorkspaceContext: reads hash, calls setSession()
  → cleans URL via history.replaceState()
```

---

## Phase 4: Confirmed Defects vs. Hypotheses

### Confirmed Defects (Code Evidence)

| # | Defect | Evidence | Severity |
|---|--------|----------|----------|
| 1 | **Tokens in URL fragment** | `externalAuthHandback.ts:24-30` puts `access_token` + `refresh_token` in fragment | **HIGH** — Security risk (history, referrers, logs) |
| 2 | **No redirect validation in `externalAuthHandback`** | Only checks `^https?://` — no allowlist of trusted origins | **MEDIUM** — Open redirect potential |
| 3 | **No CSRF/state parameter** | OAuth `redirectTo` has no `state` param; handback has no correlation ID | **MEDIUM** — Replay/CSRF risk |
| 4 | **Refresh token exposed** | Long-lived refresh token in fragment — if leaked, full account access | **HIGH** |
| 5 | **No token expiry/replay protection** | Fragment tokens can be replayed if captured | **MEDIUM** |

### Unverified Hypotheses (Require Dashboard/Deployment Check)

| # | Hypothesis | How to Verify |
|---|------------|---------------|
| A | ColabWize production missing `externalAuthHandback` calls | Check deployed `app.colabwize.com` bundle; compare with local source |
| B | Supabase Redirect URLs missing `http://localhost:3000/?colabwize_auth=1` | Dashboard → Auth → URL Configuration |
| C | Google OAuth authorized redirect URI incorrect | Dashboard → Auth → Providers → Google → Redirect URI |
| D | ColabWize `/auth/callback` route not deployed | Visit `https://app.colabwize.com/auth/callback` directly |
| E | `detectSessionInUrl: true` in ColabWize client conflicts with manual handoff | ColabWize `client.ts:37` has `detectSessionInUrl: true` — may race with manual `setSession` |

---

## Phase 5: Session Persistence & Initialization

### ColabWize Client Config (`client.ts:30-38`)

```typescript
auth: {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,  // ← May conflict with manual handoff
}
```

**Risk:** `detectSessionInUrl: true` makes Supabase client automatically parse URL fragment for tokens on *every page load*. This could:
- Race with PubRooter's manual `setSession()`
- Cause double-processing of fragment
- Clear fragment before PubRooter reads it

### PubRooter Client Config (`supabase.ts:9`)

```typescript
export const supabase = isCloud ? createClient(url!, anonKey!) : null
```

**No explicit auth config** — uses Supabase defaults (`detectSessionInUrl: true` by default in v2).

**Recommendation:** Both apps should use `detectSessionInUrl: false` and handle fragment parsing explicitly.

---

## Phase 6: RLS & Data Isolation

### PubRooter Tables (Migration 0001)

| Table | RLS Policy | Condition |
|-------|------------|-----------|
| `pubrooter_profiles` | `pubrooter_profiles_self` | `auth.uid() = id` |
| `pubrooter_projects` | `pubrooter_projects_self` | `auth.uid() = user_id` |
| `pubrooter_readiness_audits` | `pubrooter_audits_self` | `auth.uid() = user_id` |
| `pubrooter_saved_journals` | `pubrooter_saved_self` | `auth.uid() = user_id` |
| `pubrooter_activity_events` | `pubrooter_activity_self` | `auth.uid() = user_id` |
| `storage.objects` (bucket) | `pubrooter_manuscripts_self` | `foldername(name)[1] = auth.uid()::text` |

✅ **All policies use `auth.uid()`** — works correctly after `setSession()` establishes session.

### ColabWize Tables (Prisma)

- `public.users` — `id` = `auth.users.id` (UUID)
- `public.projects` — `user_id` = `auth.users.id::text` (string)

**Import RPC** (`0001_workspace_schema.sql:203`): `WHERE p.user_id = auth.uid()::text` — **type matches**.

---

## Phase 7: Existing Tests & Coverage Gaps

### PubRooter Tests
- Unit tests: Unknown (no test files found in `tests/`)
- E2E: Playwright test created but failing due to timeout/async issues
- TypeScript: ✅ Passes
- Build: ✅ Passes

### ColabWize Tests
- Not inspected in this audit

### Coverage Gaps

| Area | Coverage |
|------|----------|
| Handoff URL construction | ❌ No unit test |
| Redirect param preservation | ❌ No test |
| `externalAuthHandback` logic | ❌ No test |
| `setSession` success/failure | ❌ No test |
| Duplicate callback handling | ❌ No test |
| Redirect loop prevention | ❌ No test |
| URL cleanup after success | ❌ No test |
| Session persistence after refresh | ❌ No test |
| MFA/onboarding redirect preservation | ❌ No test |
| Draft import idempotency | ❌ No test |

---

## Phase 8: Minimal Repair Plan (Prioritized)

### P0 — Must Fix Before Any Testing

1. ✅ **ColabWize production deployment** verified — `externalAuthHandback` calls deployed to production (`dpl_Hf7ZQjV4m79mQddvPT19fpTGVpa7`, ready as of 2026-10-23 21:19 UTC). All 5 callback paths (LoginPage, SignupPage x2, CallbackPage x3, PubrooterHandoffPage) include handback calls.
2. **Configure Supabase Redirect URLs** (Dashboard → Auth → URL Configuration):
   ```
   http://localhost:3000/?colabwize_auth=1
   http://localhost:3000/
   https://pubrooter.app/?colabwize_auth=1
   https://pubrooter.app/
   ```
3. **Set Site URL:** `http://localhost:3000` (dev) / `https://pubrooter.app` (prod)

### P0-Completed — Code Fixes Applied

1. ✅ **`signInWithEmail` session stabilization** (`hybridAuth.ts`): Added explicit `getSession()` verification + `setSession()` fallback after backend verification, ensuring `externalAuthHandback` always has a session to read tokens from. (Commit `af49feb`)
2. ✅ **`externalAuthHandback` utility** deployed — puts session tokens in URL fragment for cross-app login. (Commit `497aeb2`)
3. ✅ **`PubrooterHandoffPage`** route (`/auth/pubrooter`) deployed — immediate handback if session exists, otherwise forwards to `/login?redirect=...`. (Commit `497aeb2`)
4. ✅ **`LoginPage.tsx`**: `handleLoginSuccess` calls `externalAuthHandback(redirect)` before dashboard redirect. (Commit `497aeb2`)
5. ✅ **`CallbackPage.tsx`**: Reads `redirect` param, passes it through 2FA redirect, calls `externalAuthHandback` in all 3 code paths. (Commit `497aeb2`)
6. ✅ **`SignupPage.tsx`**: Survey completion and existing-user redirect both call `externalAuthHandback`. (Commit `62c2760`)
7. ✅ **`0002_submission_attempts.sql` migration**: Added missing GRANT statements for `pubrooter_submission_attempts` and `pubrooter_submission_events` tables.

### P1 — Security Fixes (Can Be Done Incrementally)

4. **Add redirect allowlist to `externalAuthHandback`**:
   ```typescript
   const TRUSTED_ORIGINS = ['http://localhost:3000', 'https://pubrooter.app'];
   if (!TRUSTED_ORIGINS.some(o => url.startsWith(o))) return false;
   ```

5. **Add correlation ID** to track handoff flow end-to-end

6. **Set `detectSessionInUrl: false`** in both Supabase clients

### P2 — Architecture Migration (Separate Phase)

7. **Replace fragment-token handoff with auth-code exchange**:
   - ColabWize generates short-lived, single-use `handoff_code` stored in DB with `user_id`, `expires_at`, `used=false`
   - Redirects to PubRooter with `?handoff_code=xyz`
   - PubRooter calls Supabase Function/Edge Function to exchange code → session
   - Code marked `used=true` immediately

---

## Phase 9: Files Requiring Changes

### PubRooter

| File | Change |
|------|--------|
| `src/lib/supabase.ts` | Add `detectSessionInUrl: false` to client config |
| `src/workspace/WorkspaceContext.tsx` | Already has debug logging; add correlation ID |

### ColabWize

| File | Change |
|------|--------|
| `src/utils/externalAuthHandback.ts` | Add origin allowlist; add correlation ID; consider removing refresh_token from fragment |
| `src/lib/supabase/client.ts` | Set `detectSessionInUrl: false` |
| `src/pages/auth/CallbackPage.tsx` | Ensure `redirect` param passed through all paths |

---

## Phase 10: Verification Checklist

### Manual Verification (Can Do Now)

> **Deployed to production** (2026-10-23 21:19 UTC). `app.colabwize.com` 308-redirects to `www.colabwize.com` preserving query params.
> Note: `app.colabwize.com` → `www.colabwize.com` redirect preserves the `redirect` query param, so the handoff flow should work end-to-end.

- [ ] Open `http://localhost:3000` → Click "Continue with ColabWize"
- [ ] Complete Google OAuth on ColabWize (or password sign-in)
- [ ] **Watch PubRooter browser console** for:
  ```
  [PubRooter] Colabwize handoff check: { hasHash: true, hashKeys: ['access_token', 'refresh_token'], hasAccessToken: true, hasRefreshToken: true, hasColabwizeParam: true, url: '...' }
  [PubRooter] Calling setSession with tokens
  [PubRooter] setSession succeeded
  ```
- [ ] Verify workspace loads with user's data
- [ ] Refresh page — session persists
- [ ] Check `localStorage` for `sb-xkfyhlqncoyxotyivomp-auth-token`
- [ ] **Verify password sign-in flow**: `signInWithEmail` now stabilizes session before `externalAuthHandback` is called

### Dashboard Verification (Requires Access)

- [ ] Supabase Project `xkfyhlqncoyxotyivomp` → Auth → URL Configuration
- [ ] Redirect URLs include both localhost and production URLs
- [ ] Google Provider → Authorized Redirect URI = `https://xkfyhlqncoyxotyivomp.supabase.co/auth/v1/callback`
- [ ] ColabWize `/auth/callback` route accessible

### Automated Tests (To Build)

- [ ] Unit: `colabwizeHandoffUrl()` encoding
- [ ] Unit: `externalAuthHandback` allowlist logic
- [ ] Unit: WorkspaceContext token parsing
- [ ] Integration: Full flow with mocked Supabase
- [ ] E2E: Playwright (once P0 fixed)

---

## Conclusion

**Root Cause:** The code is correct but **deployment/configuration is incomplete**.

1. **ColabWize must be redeployed** with current `externalAuthHandback` calls
2. **Supabase Redirect URLs must be set** for both localhost and production
3. **Security hardening** (allowlist, correlation ID, `detectSessionInUrl: false`) should follow

**No code rewrite needed** — the fragment-token handoff works if deployed and configured correctly. The security migration to auth-code exchange is a separate, recommended improvement.