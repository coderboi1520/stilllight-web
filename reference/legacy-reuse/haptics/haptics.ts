import { Capacitor, registerPlugin } from '@capacitor/core';

export type HapticKind =
  | 'select'
  | 'uiClick'
  | 'pourContact'
  | 'reject'
  | 'glassComplete'
  | 'levelComplete'
  | 'toggleOn'
  | 'toggleOff';

type StilllightHapticsPlugin = {
  perform(options: { kind: HapticKind }): Promise<void>;
};

const NativeHaptics = registerPlugin<StilllightHapticsPlugin>('StilllightHaptics');

const THROTTLE_MS: Record<HapticKind, number> = {
  select: 26,
  uiClick: 36,
  pourContact: 90,
  reject: 120,
  glassComplete: 140,
  levelComplete: 360,
  toggleOn: 80,
  toggleOff: 80,
};

/**
 * Thin semantic haptics client. The game only describes intent; Android owns
 * actuator-specific timing/intensity and gracefully falls back by API/device.
 */
export class HapticEngine {
  private enabled: boolean;
  private lastAt = new Map<HapticKind, number>();

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  trigger(kind: HapticKind, force = false) {
    if ((!this.enabled && !force) || Capacitor.getPlatform() !== 'android') return;
    const now = performance.now();
    const last = this.lastAt.get(kind) ?? -Infinity;
    if (now - last < THROTTLE_MS[kind]) return;
    this.lastAt.set(kind, now);
    void NativeHaptics.perform({ kind }).catch(() => undefined);
  }
}
