import { useEffect, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark' | 'device';
const key = 'swiftdrop-theme';
const event = 'swiftdrop-theme-change';
let fallback: Theme = 'device';
let temporary: Theme | undefined;
function preference(): Theme {
  if (temporary) return temporary;
  try {
    const value = localStorage.getItem(key);
    return value === 'light' || value === 'dark' || value === 'device'
      ? value
      : 'device';
  } catch {
    return fallback;
  }
}
function snapshot() {
  const theme = preference();
  return `${theme}:${theme === 'dark' || (theme === 'device' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'}`;
}
function subscribe(notify: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  window.addEventListener(event, notify);
  window.addEventListener('storage', notify);
  media.addEventListener('change', notify);
  return () => {
    window.removeEventListener(event, notify);
    window.removeEventListener('storage', notify);
    media.removeEventListener('change', notify);
  };
}
export function useTheme() {
  const value = useSyncExternalStore(subscribe, snapshot, () => 'device:light');
  return {
    theme: value.split(':')[0] as Theme,
    dark: value.endsWith(':dark'),
    setTheme: (theme: Theme) => {
      fallback = theme;
      try {
        localStorage.setItem(key, theme);
        temporary = undefined;
      } catch {
        temporary = theme;
      }
      window.dispatchEvent(new Event(event));
    },
  };
}
export function ThemeController() {
  const { dark } = useTheme();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('scheme-dark', dark);
    document.documentElement.classList.toggle('scheme-light', !dark);
  }, [dark]);
  return null;
}
