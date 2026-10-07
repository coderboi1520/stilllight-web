import './styles.css';
import './shell/gameplay.css';
import { StilllightModel } from './core/model.ts';
import { INITIAL } from './core/constants.ts';
import { isBottleComplete } from './core/rules.ts';
import { StageRenderer } from './render/StageRenderer.ts';
import { ViewportController } from './render/ViewportController.ts';
import { gameplayLayout } from './render/gameplayLayout.ts';
import { FrameGate } from './runtime/FrameGate.ts';
import { GameplayHud } from './shell/gameplayHud.ts';
import { solve } from './session/solver.ts';
import { readSound, readMusic, SOUND_KEY, MUSIC_KEY, EventAudio, type AudioEvent } from './platform/audio.ts';
import { HapticEngine } from './platform/haptics.ts';
import { readHapticsEnabled, writeHapticsEnabled } from './platform/hapticsPreference.ts';
import { readReducedMotion, writeReducedMotion } from './platform/motionPreference.ts';
import { FeedbackCapability } from './platform/feedbackCapability.ts';
import { presentedPourContact } from './platform/presentedFeedback.ts';

// Both modes contain exactly TWO physical vessels. A genuine solvable
// two-vessel completion can demonstrate only one color unless extra space
// or a different capacity/ruleset is added. Keep main's rules unmodified.
const MIXED_BOARD = INITIAL;
const FINISH_BOARD = [[2, 2, 2], [2]];
const mixed = new URLSearchParams(location.search).get('board') === 'mixed';
const startBoard = () => (mixed ? MIXED_BOARD : FINISH_BOARD).map(b => [...b]);

async function start() {
  const root = document.querySelector<HTMLElement>('.atelier')!;
  const boardHost = document.querySelector<HTMLElement>('.board')!;
  const stage = document.querySelector<HTMLElement>('#pixi-host')!;
  const hits = document.querySelector<HTMLElement>('.hit-glasses')!;
  const status = document.querySelector<HTMLElement>('.status')!;
  const result = document.querySelector<HTMLElement>('.result')!;
  const resetButton = document.querySelector<HTMLButtonElement>('#replay-demo')!;
  let model = new StilllightModel(startBoard());
  let completed = false;
  let ready = false;
  let lastTime = performance.now();
  const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let userReduced = readReducedMotion();
  const refreshMotion = () => { model.reducedMotion = userReduced || systemMotion.matches; };
  refreshMotion();

  let soundEnabled = readSound();
  let musicEnabled = readMusic();
  let vibrationEnabled = readHapticsEnabled();
  const audio = new EventAudio(soundEnabled, undefined, musicEnabled);
  const haptics = new HapticEngine(vibrationEnabled);
  const feedback = new FeedbackCapability(audio, haptics);
  const notifiedContacts = new WeakSet<object>();
  const renderer = new StageRenderer(2);
  const sound = (event: AudioEvent, now = performance.now()) => {
    if (!document.hidden) feedback.sound(event, now);
  };
  const notify = (message: string) => { status.textContent = message; };
  const allFinished = () => model.board.every(g => !g.length || isBottleComplete(g));

  function redraw(now = performance.now(), advance = true) {
    if (!ready || document.hidden) return;
    const frame = model.sample(now);
    renderer.render(frame);
    lastTime = now;
    if (advance) {
      for (const flight of model.flights) {
        if (flight.kind !== 'pour' || notifiedContacts.has(flight)) continue;
        if (presentedPourContact(frame, model.reducedMotion, flight.id)) {
          notifiedContacts.add(flight);
          feedback.haptic('pourContact', false, true);
          sound('contact', now);
        }
      }
      const eventsBefore = model.eventCount;
      const changed = model.advanceAfterFrame(now);
      if (model.eventCount > eventsBefore) {
        for (const item of model.events.slice(-(model.eventCount - eventsBefore))) {
          if (item.startsWith('cap-contact:')) feedback.haptic('glassComplete', false, true);
        }
      }
      if (!completed && allFinished() && !model.isAnimating()) {
        completed = true;
        result.hidden = false;
        root.classList.add('completed');
        notify('Demo level complete.');
        sound('complete', now);
        feedback.haptic('levelComplete');
        resetButton.focus({ preventScroll: true });
      }
      hud.update();
      if (model.isAnimating() || changed) gate.schedule();
    }
  }
  const gate = new FrameGate(
    cb => requestAnimationFrame(cb),
    id => cancelAnimationFrame(id),
    time => redraw(time)
  );
  function schedule() { if (!document.hidden && ready) gate.schedule(); }
  function invalidate() {
    if (!ready || document.hidden) return;
    renderer.render(model.sample(lastTime));
  }

  function resetGame() {
    if (!ready) return;
    model.reset();
    model.showResetDip(performance.now());
    completed = false;
    result.hidden = true;
    root.classList.remove('completed');
    notify('Demo board restarted.');
    hud.update();
    schedule();
  }
  function choose(index: number) {
    if (!ready || completed || hud.modalOpen || !model.isVesselAvailable(index)) return;
    void feedback.unlock();
    const oldCount = model.eventCount;
    model.choose(index, performance.now());
    if (model.eventCount > oldCount) {
      const event = model.events.at(-1) ?? '';
      if (event.startsWith('selected:')) {
        feedback.haptic('select');
        sound('select');
        notify('Vessel ' + (index + 1) + ' selected.');
      } else if (event.startsWith('invalid:')) {
        feedback.haptic('reject');
        sound('invalid');
        notify('That pour is not allowed.');
      } else if (event.startsWith('pour-start:')) {
        notify('Pour in progress.');
      } else {
        notify('Selection cleared.');
      }
    }
    hud.update();
    schedule();
  }
  function runAction(name: string) {
    if (!ready || hud.modalOpen) return;
    const now = performance.now();
    if (name === 'hint') {
      const solution = solve(model.board);
      // The optional colorful board is intentionally not a completable level.
      // Its hint shows a legal interaction, never a falsely claimed solution.
      const pair: [number, number] | undefined =
        solution.path[0] ?? (mixed ? [0, 1] : undefined);
      if (pair && model.showHint(pair[0], pair[1], now)) {
        notify(solution.path.length ? 'Hint: highlighted route toward completion.' : 'Demo hint: legal pour only; mixed board is a visual fixture.');
      } else notify('No legal hint available.');
    } else if (name === 'undo') {
      if (model.undo(now)) notify('Previous pour restored.');
    } else if (name === 'restart-confirmed') {
      resetGame();
      return;
    }
    hud.update();
    schedule();
  }
  function setPreference(name: string) {
    if (name === 'sound') {
      soundEnabled = !soundEnabled;
      audio.setEnabled(soundEnabled);
      try { localStorage.setItem(SOUND_KEY, String(soundEnabled)); } catch {}
      if (soundEnabled) void feedback.unlock();
    } else if (name === 'music') {
      musicEnabled = !musicEnabled;
      audio.setMusicEnabled(musicEnabled);
      try { localStorage.setItem(MUSIC_KEY, String(musicEnabled)); } catch {}
      if (musicEnabled) void feedback.unlock();
    } else if (name === 'haptics') {
      vibrationEnabled = !vibrationEnabled;
      haptics.setEnabled(vibrationEnabled);
      writeHapticsEnabled(vibrationEnabled);
      feedback.haptic(vibrationEnabled ? 'toggleOn' : 'toggleOff', true);
    } else if (name === 'motion' && !systemMotion.matches) {
      userReduced = !userReduced;
      writeReducedMotion(userReduced);
      refreshMotion();
      invalidate();
      schedule();
    }
    hud.update();
  }

  const hud = new GameplayHud(root, {
    state: () => ({
      level: 1,
      busy: model.busy || !!model.settleMotion,
      completed,
      canUndo: model.canUndo(performance.now()),
      sound: soundEnabled,
      music: musicEnabled,
      vibration: vibrationEnabled,
      reduced: model.reducedMotion,
      osReduced: systemMotion.matches
    }),
    run: runAction,
    preference: setPreference,
    home: () => {}, // "Resume Game" in this isolated demo closes Settings.
    invalidate,
    settingsOpened: () => { void feedback.unlock(); }
  });

  // Capture-phase feedback also covers Settings open/close and switches.
  // Do not depend on a bubble listener: the HUD stops propagation.
  root.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('.claude-ui button');
    if (!button) return;
    void feedback.unlock();
    sound('ui');
    if (!button.matches('[data-preference="haptics"]')) feedback.haptic('uiClick');
  }, true);

  const buttons = model.board.map((_, index) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.glass = String(index);
    b.addEventListener('click', () => choose(index));
    hits.append(b);
    return b;
  });
  function syncLayout() {
    const layout = gameplayLayout(innerWidth, innerHeight, 2);
    model.setPresentationGeometry(layout.profile);
    renderer.setGameplayLayout(layout);
    buttons.forEach((button, index) => {
      const p = layout.homes[index];
      const width = Math.max(44, layout.glassWidth * p.scale);
      const height = 156 * layout.scale * p.scale + 16;
      Object.assign(button.style, {
        left: (p.x - width / 2) + 'px',
        top: (p.y - 8) + 'px',
        width: width + 'px',
        height: height + 'px'
      });
    });
    hud.layout(layout.homes, layout.glassWidth);
  }
  function updateButtons() {
    buttons.forEach((button, index) => {
      button.disabled = completed || !model.isVesselAvailable(index);
      button.setAttribute('aria-label', 'Vessel ' + (index + 1) + ' with ' + model.board[index].length + ' units');
      button.setAttribute('aria-pressed', String(model.selected === index));
      button.dataset.hintSource = String(model.hintMotion?.source === index);
    });
  }
  // Keep hit areas and hint-source metadata synchronized with analytical frames.
  const originalUpdate = hud.update.bind(hud);
  hud.update = () => { updateButtons(); originalUpdate(); };
  await renderer.init(stage, invalidate);
  renderer.setPresentation('game');
  renderer.setRestoration(0);
  hud.setVisible(true);
  const viewport = new ViewportController(boardHost, metrics => {
    syncLayout();
    renderer.resize(metrics.width, metrics.height, metrics.density);
    invalidate();
  }, invalidate);
  viewport.start();
  window.addEventListener('resize', () => { syncLayout(); viewport.sync(); invalidate(); });
  systemMotion.addEventListener('change', () => { refreshMotion(); hud.update(); invalidate(); schedule(); });
  document.addEventListener('visibilitychange', () => {
    audio.setBackground(document.hidden);
    haptics.setBackground(document.hidden);
    if (!document.hidden) { invalidate(); schedule(); }
  });
  window.addEventListener('pagehide', () => { audio.setBackground(true); haptics.setBackground(true); });
  resetButton.addEventListener('click', () => { void feedback.unlock(); sound('ui'); feedback.haptic('uiClick'); resetGame(); });
  window.addEventListener('keydown', event => {
    if (event.repeat || hud.modalOpen || event.target instanceof HTMLInputElement) return;
    if (event.key === '1' || event.key === '2') choose(Number(event.key) - 1);
    if (event.key.toLowerCase() === 'h') runAction('hint');
    if (event.key.toLowerCase() === 'u' || (event.key.toLowerCase() === 'z' && (event.ctrlKey || event.metaKey))) {
      event.preventDefault();
      runAction('undo');
    }
    if (event.key.toLowerCase() === 'r') hud.requestResetKey();
  });
  ready = true;
  hud.update();
  notify(mixed ? 'Mixed-color visual fixture. Not a solvable level.' : 'Select the larger glass, then the smaller glass to pour.');
  redraw(performance.now(), false);
}
void start();
