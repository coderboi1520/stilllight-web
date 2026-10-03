import test from 'node:test';
import assert from 'node:assert/strict';
import {readHapticsEnabled, writeHapticsEnabled} from '../src/platform/hapticsPreference.ts';

function withStorage(storage: Storage | undefined, run: () => void) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  if (storage === undefined) Object.defineProperty(globalThis, 'localStorage', {configurable: true, get() { throw new Error('access denied'); }});
  else Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: storage});
  try { run(); }
  finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set('stilllight.haptics.enabled', initial);
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  } as unknown as Storage & {values: Map<string, string>};
}

test('defaults enabled when the preference is absent and persists explicit false across reloads', () => {
  const storage = memoryStorage();
  withStorage(storage, () => {
    assert.equal(readHapticsEnabled(), true);
    writeHapticsEnabled(false);
  });
  withStorage(storage, () => assert.equal(readHapticsEnabled(), false));
});

test('reads explicit true and writes under the fixed preference key', () => {
  const storage = memoryStorage('true');
  withStorage(storage, () => {
    assert.equal(readHapticsEnabled(), true);
    writeHapticsEnabled(false);
  });
  assert.equal(storage.values.get('stilllight.haptics.enabled'), 'false');
});

test('defaults enabled for corrupt data and tolerates denied or unavailable storage', () => {
  const corrupt = memoryStorage('{bad json');
  withStorage(corrupt, () => {
    assert.equal(readHapticsEnabled(), true);
    assert.doesNotThrow(() => writeHapticsEnabled(false));
  });
  withStorage(undefined, () => {
    assert.equal(readHapticsEnabled(), true);
    assert.doesNotThrow(() => writeHapticsEnabled(false));
  });
});

test('tolerates storage methods that throw', () => {
  const storage = {getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }} as unknown as Storage;
  withStorage(storage, () => {
    assert.equal(readHapticsEnabled(), true);
    assert.doesNotThrow(() => writeHapticsEnabled(false));
  });
});
