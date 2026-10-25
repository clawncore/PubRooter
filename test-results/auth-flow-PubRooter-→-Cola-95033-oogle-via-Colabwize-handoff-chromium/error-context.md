# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-flow.spec.ts >> PubRooter → Colabwize Google Sign-In Flow >> sign in with Google via Colabwize handoff
- Location: tests/auth-flow.spec.ts:6:3

# Error details

```
Error: page.waitForURL: Target page, context or browser has been closed
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | const TEST_EMAIL = 'simbisaichinhema14@gmail.com'
  4  | 
  5  | test.describe('PubRooter → Colabwize Google Sign-In Flow', () => {
  6  |   test('sign in with Google via Colabwize handoff', async ({ page }) => {
  7  |     test.setTimeout(180000)
  8  |     await test.step('Setup: Open PubRooter homepage', async () => {
  9  |       await page.goto('http://localhost:3000')
  10 |       await page.waitForLoadState('networkidle')
  11 |     })
  12 | 
  13 |     // 2. Navigate to Workspace (this shows the AuthScreen with Colabwize link)
  14 |     const workspaceBtn = page.locator('button:has-text("Workspace"), a:has-text("Workspace"), button:has-text("Open workspace")').first()
  15 |     if (await workspaceBtn.isVisible({ timeout: 5000 })) {
  16 |       await workspaceBtn.click()
  17 |     } else {
  18 |       const toolCard = page.locator('button:has-text("Open Workspace"), button:has-text("workspace"):visible').first()
  19 |       if (await toolCard.isVisible({ timeout: 5000 })) {
  20 |         await toolCard.click()
  21 |       } else {
  22 |         await page.goto('http://localhost:3000/?tool=1')
  23 |       }
  24 |     }
  25 |     await page.waitForLoadState('networkidle')
  26 |     await page.waitForTimeout(1000)
  27 | 
  28 |     // 3. Click "Continue with Colabwize" link
  29 |     const colabwizeLink = page.locator('a:has-text("Continue with Colabwize")')
  30 |     await expect(colabwizeLink).toBeVisible({ timeout: 10000 })
  31 | 
  32 |     // The link navigates to Colabwize login with redirect param
  33 |     const href = await colabwizeLink.getAttribute('href')
  34 |     console.log('Colabwize handoff URL:', href)
  35 |     expect(href).toContain('colabwize.com/login')
  36 |     expect(href).toContain('redirect=')
  37 |     expect(href).toContain('colabwize_auth')
  38 | 
  39 |     await colabwizeLink.click()
  40 | 
  41 |     // 4. Wait for redirect to Colabwize login page
  42 |     await page.waitForURL(/colabwize\.com\/login/, { timeout: 15000 })
  43 |     console.log('On Colabwize login page:', page.url())
  44 | 
  45 |     // 5. Click "Continue with Google" on Colabwize
  46 |     const googleBtn = page.locator('button:has-text("Google"), a:has-text("Google"), button:has-text("Continue with Google")').first()
  47 |     await expect(googleBtn).toBeVisible({ timeout: 15000 })
  48 |     await googleBtn.click()
  49 | 
  50 |     // 6. Handle Google OAuth consent screen
  51 |     await page.waitForURL(/accounts\.google\.com/, { timeout: 15000 })
  52 |     console.log('On Google auth page:', page.url())
  53 | 
  54 |     // 7. Fill email
  55 |     const emailInput = page.locator('input[type="email"], input[name="identifier"]')
  56 |     await expect(emailInput).toBeVisible({ timeout: 10000 })
  57 |     await emailInput.fill(TEST_EMAIL)
  58 |     await page.keyboard.press('Enter')
  59 | 
  60 |     // 8. Pause for manual password entry and any 2FA
  61 |     console.log('⚠️  PAUSED: Complete Google sign-in in the browser (password, 2FA, etc.)')
  62 |     console.log('After successful sign-in, Colabwize should redirect back to PubRooter')
  63 |     await page.pause()
  64 | 
  65 |     // 9. Wait for redirect back to PubRooter with tokens
> 66 |     await page.waitForURL(/localhost:3000\/\?colabwize_auth=1/, { timeout: 60000 })
     |                ^ Error: page.waitForURL: Target page, context or browser has been closed
  67 |     console.log('Back on PubRooter:', page.url())
  68 | 
  69 |     // 10. Verify we're in the workspace (not home page)
  70 |     await page.waitForLoadState('networkidle')
  71 | 
  72 |     // Check console logs for our debug messages
  73 |     const logs = []
  74 |     page.on('console', msg => {
  75 |       if (msg.text().includes('[PubRooter]')) {
  76 |         logs.push(msg.text())
  77 |         console.log('BROWSER LOG:', msg.text())
  78 |       }
  79 |     })
  80 | 
  81 |     // Wait a bit for the handoff effect to process
  82 |     await page.waitForTimeout(3000)
  83 | 
  84 |     // Verify we're not on the auth screen anymore
  85 |     const authScreen = page.locator('text="Sign in to PubRooter", text="Create your PubRooter account"')
  86 |     const isAuthVisible = await authScreen.isVisible().catch(() => false)
  87 | 
  88 |     if (!isAuthVisible) {
  89 |       console.log('✅ Successfully signed in - workspace loaded')
  90 |     } else {
  91 |       console.log('❌ Still on auth screen - handoff may have failed')
  92 |     }
  93 | 
  94 |     // Take screenshot for debugging
  95 |     await page.screenshot({ path: 'test-result.png', fullPage: true })
  96 |   })
  97 | })
```