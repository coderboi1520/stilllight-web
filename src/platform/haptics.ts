export type HapticKind =
  | 'select'
  | 'uiClick'
  | 'pourContact'
  | 'reject'
  | 'glassComplete'
  | 'levelComplete'
  | 'toggleOn'
  | 'toggleOff' | 'undo' | 'hint' | 'resetTick' | 'resetConfirm';

export interface HapticBackend {
  perform(kind: HapticKind): void | Promise<void>;
  cancel?(): void | Promise<void>;
}

const THROTTLE_MS: Record<HapticKind, number> = {
  select: 26,
  uiClick: 36,
  pourContact: 90,
  reject: 800,
  glassComplete: 140,
  levelComplete: 360,
  toggleOn: 80,
  toggleOff: 80,
  undo:80,hint:120,resetTick:60,resetConfirm:200,
};

// Vibration API patterns are brief semantic approximations; browser devices
// expose no control equivalent to Android's actuator capability ladder.
const BROWSER_PATTERNS: Record<HapticKind, number[]> = {
  select: [8],
  uiClick: [12],
  pourContact: [16, 14, 10],
  reject: [22, 18, 22],
  glassComplete: [10, 18, 22],
  levelComplete: [12, 20, 28, 24, 10],
  toggleOn: [12, 20, 14],
  toggleOff: [20, 14],
  undo:[12],hint:[10],resetTick:[8],resetConfirm:[24],
};

const browserBackend: HapticBackend = {
  cancel() { if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(0); },
  perform(kind) {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(BROWSER_PATTERNS[kind]);
  },
};

export class HapticEngine {
  private enabled: boolean;
  private background = false;
  private readonly backend: HapticBackend;
  private readonly lastAt = new Map<HapticKind, number>();
  private activeUntil = -Infinity;

  constructor(enabled: boolean, backend?: HapticBackend) {
    this.enabled = enabled;
    this.backend = backend ?? browserBackend;
  }

  setEnabled(enabled: boolean): void {
    if (!enabled) this.cancel();
    this.enabled = enabled;
  }

  setBackground(background: boolean): void { this.background = background; if (background) this.cancel(); }
  private cancel(): void { const now=typeof performance!=='undefined'?performance.now():Date.now();if(now>=this.activeUntil)return;this.activeUntil=-Infinity;try { void Promise.resolve(this.backend.cancel?.()).catch(() => undefined); } catch {} }

  // The presenter deduplicates transaction/cap events; a shared time throttle
  // must not discard a different vessel's concurrent contact.
  trigger(kind: HapticKind, force = false, deduplicated = false): void {
    if (this.background || !this.enabled) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const last = this.lastAt.get(kind) ?? -Infinity;
    if (!deduplicated && now - last < THROTTLE_MS[kind]) return;
    this.lastAt.set(kind, now);
    this.activeUntil=now+BROWSER_PATTERNS[kind].reduce((sum,part)=>sum+part,0);
    try {
      void Promise.resolve(this.backend.perform(kind)).catch(() => undefined);
    } catch {
      // Haptics are optional feedback and must never interrupt gameplay.
    }
  }
}
