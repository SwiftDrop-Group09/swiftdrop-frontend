import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const scriptSelector = 'script[src="https://accounts.google.com/gsi/client"]';
function script() {
  const element =
    document.head.querySelector<HTMLScriptElement>(scriptSelector);
  if (!element) throw new Error('Expected the Google client script.');
  return element;
}

beforeEach(() => {
  vi.resetModules();
  delete window.google;
});
afterEach(() => {
  if (vi.isFakeTimers()) vi.clearAllTimers();
  vi.useRealTimers();
  delete window.google;
  document.head
    .querySelectorAll(scriptSelector)
    .forEach((element) => element.remove());
});

describe('Google client script loading', () => {
  it('shares a pending load and allows a fresh script after a blocked download', async () => {
    const { loadGoogleSdk } = await import('./google-button');
    const first = loadGoogleSdk();
    expect(loadGoogleSdk()).toBe(first);
    const firstScript = script();
    const rejected = expect(first).rejects.toMatchObject({
      code: 'google_sdk_unavailable',
    });
    firstScript.dispatchEvent(new Event('error'));
    await rejected;
    expect(firstScript.isConnected).toBe(false);
    const retry = loadGoogleSdk();
    expect(script()).not.toBe(firstScript);
    const sdk: NonNullable<Window['google']>['accounts']['id'] = {
      initialize: vi.fn(),
      renderButton: vi.fn(),
      cancel: vi.fn(),
      disableAutoSelect: vi.fn(),
    };
    window.google = { accounts: { id: sdk } };
    script().dispatchEvent(new Event('load'));
    await expect(retry).resolves.toBe(sdk);
  });

  it('times out a stalled script without retaining the failed element', async () => {
    const { loadGoogleSdk } = await import('./google-button');
    vi.useFakeTimers();
    const pending = loadGoogleSdk();
    const rejected = expect(pending).rejects.toMatchObject({
      code: 'google_sdk_unavailable',
    });
    await vi.advanceTimersByTimeAsync(15_000);
    await rejected;
    expect(document.head.querySelector(scriptSelector)).toBeNull();
  });

  it('handles another Google namespace without an Identity SDK and removes an incomplete load', async () => {
    const { loadGoogleSdk } = await import('./google-button');
    Object.defineProperty(window, 'google', {
      value: {},
      writable: true,
      configurable: true,
    });
    const pending = loadGoogleSdk();
    const element = script();
    const rejected = expect(pending).rejects.toMatchObject({
      code: 'google_sdk_unavailable',
    });
    element.dispatchEvent(new Event('load'));
    await rejected;
    expect(element.isConnected).toBe(false);
  });
});
