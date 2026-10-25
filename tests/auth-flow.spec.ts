import { test, expect } from '@playwright/test'

const TEST_EMAIL = 'simbisaichinhema14@gmail.com'

test.describe('PubRooter → Colabwize Google Sign-In Flow', () => {
  test('sign in with Google via Colabwize handoff', async ({ page }) => {
    test.setTimeout(180000)
    await test.step('Setup: Open PubRooter homepage', async () => {
      await page.goto('http://localhost:3000')
      await page.waitForLoadState('networkidle')
    })

    // 2. Navigate to Workspace (this shows the AuthScreen with Colabwize link)
    const workspaceBtn = page.locator('button:has-text("Workspace"), a:has-text("Workspace"), button:has-text("Open workspace")').first()
    if (await workspaceBtn.isVisible({ timeout: 5000 })) {
      await workspaceBtn.click()
    } else {
      const toolCard = page.locator('button:has-text("Open Workspace"), button:has-text("workspace"):visible').first()
      if (await toolCard.isVisible({ timeout: 5000 })) {
        await toolCard.click()
      } else {
        await page.goto('http://localhost:3000/?tool=1')
      }
    }
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // 3. Click "Continue with Colabwize" link
    const colabwizeLink = page.locator('a:has-text("Continue with Colabwize")')
    await expect(colabwizeLink).toBeVisible({ timeout: 10000 })

    // The link navigates to Colabwize login with redirect param
    const href = await colabwizeLink.getAttribute('href')
    console.log('Colabwize handoff URL:', href)
    expect(href).toContain('colabwize.com/login')
    expect(href).toContain('redirect=')
    expect(href).toContain('colabwize_auth')

    await colabwizeLink.click()

    // 4. Wait for redirect to Colabwize login page
    await page.waitForURL(/colabwize\.com\/login/, { timeout: 15000 })
    console.log('On Colabwize login page:', page.url())

    // 5. Click "Continue with Google" on Colabwize
    const googleBtn = page.locator('button:has-text("Google"), a:has-text("Google"), button:has-text("Continue with Google")').first()
    await expect(googleBtn).toBeVisible({ timeout: 15000 })
    await googleBtn.click()

    // 6. Handle Google OAuth consent screen
    await page.waitForURL(/accounts\.google\.com/, { timeout: 15000 })
    console.log('On Google auth page:', page.url())

    // 7. Fill email
    const emailInput = page.locator('input[type="email"], input[name="identifier"]')
    await expect(emailInput).toBeVisible({ timeout: 10000 })
    await emailInput.fill(TEST_EMAIL)
    await page.keyboard.press('Enter')

    // 8. Pause for manual password entry and any 2FA
    console.log('⚠️  PAUSED: Complete Google sign-in in the browser (password, 2FA, etc.)')
    console.log('After successful sign-in, Colabwize should redirect back to PubRooter')
    await page.pause()

    // 9. Wait for redirect back to PubRooter with tokens
    await page.waitForURL(/localhost:3000\/\?colabwize_auth=1/, { timeout: 60000 })
    console.log('Back on PubRooter:', page.url())

    // 10. Verify we're in the workspace (not home page)
    await page.waitForLoadState('networkidle')

    // Check console logs for our debug messages
    const logs = []
    page.on('console', msg => {
      if (msg.text().includes('[PubRooter]')) {
        logs.push(msg.text())
        console.log('BROWSER LOG:', msg.text())
      }
    })

    // Wait a bit for the handoff effect to process
    await page.waitForTimeout(3000)

    // Verify we're not on the auth screen anymore
    const authScreen = page.locator('text="Sign in to PubRooter", text="Create your PubRooter account"')
    const isAuthVisible = await authScreen.isVisible().catch(() => false)

    if (!isAuthVisible) {
      console.log('✅ Successfully signed in - workspace loaded')
    } else {
      console.log('❌ Still on auth screen - handoff may have failed')
    }

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-result.png', fullPage: true })
  })
})