const STORAGE_KEY = 'stilllight.haptics.enabled';

export function readHapticsEnabled(): boolean {
  try {
    const value = globalThis.localStorage.getItem(STORAGE_KEY);
    if (value === 'true') return true;
    if (value === 'false') return false;
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
  return true;
}

export function writeHapticsEnabled(enabled: boolean): void {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Keep the in-memory preference usable when persistence is denied.
  }
}
