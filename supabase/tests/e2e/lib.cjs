const { chromium } = require('playwright')
const BASE = 'http://localhost:5173'
async function login(browser, email) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('  [pageerror]', email, e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/realtime|websocket|WebSocket|ERR_CONNECTION|Failed to load resource/.test(m.text())) console.log('  [console]', email, m.text().slice(0, 200)) })
  await page.goto(BASE + '/accedi')
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill('Palestra2026!')
  await page.getByRole('button', { name: 'Accedi', exact: true }).click()
  await page.waitForURL(/\/(app|staff)/, { timeout: 15000 })
  await page.waitForTimeout(800)
  return page
}
let fails = 0
async function check(label, fn) {
  try { await fn(); console.log('OK', label) } catch (e) { fails++; console.log('FALLITO', label, '→', e.message.split('\n')[0]) }
}
const shot = (page, n) => page.screenshot({ path: `/tmp/claude-0/e2e/${n}.png`, fullPage: true })
module.exports = { chromium, login, check, shot, BASE, done: () => { console.log(fails ? `${fails} FALLITI` : 'TUTTO OK'); return fails } }
