// Explicit test entry: browser-only Identity stubs plus real loopback Delivery.
// Never imported by app routes or normal builds. Requires Playwright and Chrome.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? 'playwright'
);
const origin = new URL(
  process.env.COURIER_BROWSER_ORIGIN ?? 'http://127.0.0.1:5173',
);
assert.equal(origin.hostname, '127.0.0.1');
const fixture = await (
  await fetch('http://127.0.0.1:5088/__test/booking-context')
).json();
assert(fixture.roles.includes('Courier'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const screenshots = new URL(
  '../../swiftdrop-backend/artifacts/courier-phase7-browser/',
  import.meta.url,
);
await mkdir(screenshots, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/v1/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/csrf'))
      return route.fulfill({
        json: { csrfToken: 'TESTDATA-csrf', googleNonce: 'TESTDATA-nonce' },
      });
    if (path.endsWith('/refresh'))
      return route.fulfill({
        json: {
          accessToken: 'TESTDATA-browser-only',
          tokenType: 'Bearer',
          expiresInSeconds: 900,
          user: {
            id: fixture.actorId,
            email: 'courier@example.test',
            fullName: 'TESTDATA Courier',
            phoneNumber: null,
            address: null,
            roles: fixture.roles,
            isActive: true,
          },
        },
      });
    return route.fulfill({ status: 401, json: { code: 'unauthorized' } });
  });
  await page.goto(new URL('/courier', origin).href);
  try {
    await page
      .getByRole('heading', { name: 'Assigned deliveries' })
      .waitFor({ timeout: 10000 });
  } catch {
    throw new Error(
      `Courier screen did not load: ${await page.locator('body').innerText()}; page errors: ${errors.join('; ')}`,
    );
  }
  const links = page.locator('.parcels a');
  await links.first().waitFor();
  assert(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.innerWidth,
    ),
  );
  await page.screenshot({
    path: fileURLToPath(new URL('manifest-mobile.png', screenshots)),
    fullPage: true,
  });
  // Read private details without consuming either client's remaining test parcel.
  const all = await (
    await fetch('http://127.0.0.1:5088/api/v1/couriers/me/assignments')
  ).json();
  const proofParcel = all.items.find((p) => p.status === 'OutForDelivery');
  assert(proofParcel);
  await page.goto(new URL(`/courier/parcels/${proofParcel.id}`, origin).href);
  await page
    .getByRole('button', { name: 'Submit proof and complete delivery' })
    .waitFor();
  await page
    .getByRole('button', { name: 'Submit proof and complete delivery' })
    .click();
  await page.getByRole('alert').waitFor();
  const canvas = page.getByLabel('Draw recipient signature');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  assert(box);
  await page.mouse.move(box.x + 20, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 70, { steps: 8 });
  await page.mouse.up();
  await page
    .getByRole('button', { name: 'Use signature', exact: true })
    .click();
  await page.getByText('Signature selected.', { exact: true }).waitFor();
  assert(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.innerWidth,
    ),
  );
  await page.screenshot({
    path: fileURLToPath(new URL('proof-mobile.png', screenshots)),
    fullPage: true,
  });
  await page
    .getByRole('link', { name: 'Delivery history', exact: true })
    .click();
  await page.getByRole('heading', { name: 'Delivery history' }).waitFor();
  await page.locator('.parcels li').first().waitFor();
  assert.equal(await page.locator('.parcels a').count(), 0);
  await page.screenshot({
    path: fileURLToPath(new URL('history-mobile.png', screenshots)),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    'PASS Chrome 390px: real manifest/detail/history, proof validation, no horizontal overflow, no page errors. Identity is a browser-only stub; Delivery uses the owned fixture.',
  );
} finally {
  await browser.close();
}
