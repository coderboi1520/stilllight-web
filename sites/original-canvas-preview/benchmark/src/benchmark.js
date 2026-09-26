import { BENCHMARK_SCRIPTS } from '../../shared/workload.js';
export { BENCHMARK_SCRIPTS };

const UNAVAILABLE = 'unavailable';

const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const round = (value) => Number.isFinite(value) ? Number(value.toFixed(3)) : UNAVAILABLE;

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

function fpsFromFrameTime(frameMs) {
  return frameMs && frameMs > 0 ? 1000 / frameMs : null;
}

export class BenchmarkStats {
  constructor({ onOverlay, onComplete } = {}) {
    this.onOverlay = onOverlay || (() => {});
    this.onComplete = onComplete || (() => {});
    this.running = false;
    this.longTaskObserver = null;
    this.resetSamples();
  }

  resetSamples() {
    this.mode = '10-glass';
    this.startedAt = 0;
    this.previousFrameAt = null;
    this.lastOverlayAt = -Infinity;
    this.eventIndex = 0;
    this.frameTimes = [];
    this.updateTimes = [];
    this.renderTimes = [];
    this.rafCallbacks = 0;
    this.renderedFrames = 0;
    this.peakAnimatedGlasses = 0;
    this.peakActivePours = 0;
    this.peakActiveStreams = 0;
    this.totalScriptedPours = 0;
    this.totalHintEvents = 0;
    this.totalInvalidEvents = 0;
    this.longTaskCount = UNAVAILABLE;
    this.longTaskDurationMs = UNAVAILABLE;
    this.heapStartBytes = UNAVAILABLE;
    this.heapEndBytes = UNAVAILABLE;
    this.heapDeltaBytes = UNAVAILABLE;
  }

  start(mode = '10-glass', now = performance.now()) {
    if (!BENCHMARK_SCRIPTS[mode]) throw new Error(`Unknown benchmark mode: ${mode}`);
    this.cancel();
    this.resetSamples();
    this.mode = mode;
    this.startedAt = now;
    this.running = true;
    this.heapStartBytes = this.readHeap();
    this.startLongTaskObserver();
  }

  cancel() {
    if (this.longTaskObserver) {
      this.longTaskObserver.disconnect();
      this.longTaskObserver = null;
    }
    this.running = false;
  }

  readHeap() {
    const value = performance.memory?.usedJSHeapSize;
    return Number.isFinite(value) ? value : UNAVAILABLE;
  }

  startLongTaskObserver() {
    const supported = typeof PerformanceObserver !== 'undefined'
      && PerformanceObserver.supportedEntryTypes?.includes('longtask');
    if (!supported) return;

    this.longTaskCount = 0;
    this.longTaskDurationMs = 0;
    try {
      this.longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.longTaskCount += 1;
          this.longTaskDurationMs += entry.duration;
        }
      });
      this.longTaskObserver.observe({ type: 'longtask', buffered: true });
    } catch {
      this.longTaskObserver = null;
      this.longTaskCount = UNAVAILABLE;
      this.longTaskDurationMs = UNAVAILABLE;
    }
  }

  beginFrame(now) {
    if (!this.running) return;
    this.rafCallbacks += 1;
    if (this.previousFrameAt !== null) {
      const delta = now - this.previousFrameAt;
      if (delta > 0) this.frameTimes.push(delta);
    }
    this.previousFrameAt = now;
  }

  consumeEvents(now) {
    if (!this.running) return [];
    const script = BENCHMARK_SCRIPTS[this.mode];
    const elapsed = now - this.startedAt;
    const due = [];
    while (this.eventIndex < script.events.length && script.events[this.eventIndex].at <= elapsed) {
      due.push(script.events[this.eventIndex]);
      this.eventIndex += 1;
    }
    return due;
  }

  recordUpdate(ms) {
    if (this.running && Number.isFinite(ms)) this.updateTimes.push(ms);
  }

  recordRender(ms) {
    if (this.running && Number.isFinite(ms)) this.renderTimes.push(ms);
  }

  markRendered() {
    if (this.running) this.renderedFrames += 1;
  }

  noteScriptedPours(count) {
    if (this.running) this.totalScriptedPours += count;
  }

  noteHint() {
    if (this.running) this.totalHintEvents += 1;
  }

  noteInvalid() {
    if (this.running) this.totalInvalidEvents += 1;
  }

  sampleActivity(activity) {
    if (!this.running) return;
    this.peakAnimatedGlasses = Math.max(this.peakAnimatedGlasses, activity.activeGlasses);
    this.peakActivePours = Math.max(this.peakActivePours, activity.activePours);
    this.peakActiveStreams = Math.max(this.peakActiveStreams, activity.activeStreams);
  }

  updateOverlay(now, activity) {
    if (!this.running || now - this.lastOverlayAt < 150) return;
    this.lastOverlayAt = now;
    const recent = this.frameTimes.slice(-120);
    const frameMs = recent.length ? recent.at(-1) : null;
    const liveFrame = average(recent);
    this.onOverlay({
      mode: this.mode,
      elapsedMs: now - this.startedAt,
      fps: fpsFromFrameTime(liveFrame),
      frameMs,
      activeGlasses: activity.activeGlasses,
      activePours: activity.activePours,
    });
  }

  shouldFinish(now) {
    return this.running && now - this.startedAt >= BENCHMARK_SCRIPTS[this.mode].durationMs;
  }

  complete(now = performance.now()) {
    if (!this.running) return null;

    if (this.longTaskObserver) {
      for (const entry of this.longTaskObserver.takeRecords()) {
        this.longTaskCount += 1;
        this.longTaskDurationMs += entry.duration;
      }
      this.longTaskObserver.disconnect();
      this.longTaskObserver = null;
    }

    this.heapEndBytes = this.readHeap();
    if (this.heapStartBytes !== UNAVAILABLE && this.heapEndBytes !== UNAVAILABLE) {
      this.heapDeltaBytes = this.heapEndBytes - this.heapStartBytes;
    }

    const durationMs = now - this.startedAt;
    const avgFrame = average(this.frameTimes);
    const worstFrame = this.frameTimes.length ? Math.max(...this.frameTimes) : null;
    const bestFrame = this.frameTimes.length ? Math.min(...this.frameTimes) : null;
    const slowestCount = this.frameTimes.length >= 100
      ? Math.max(1, Math.ceil(this.frameTimes.length * 0.01))
      : 0;
    const slowestFrameTimes = slowestCount
      ? [...this.frameTimes].sort((a, b) => b - a).slice(0, slowestCount)
      : [];
    const onePercentLow = slowestFrameTimes.length ? fpsFromFrameTime(average(slowestFrameTimes)) : null;
    const averageFPS = durationMs > 0 ? this.renderedFrames / (durationMs / 1000) : null;
    const minimumFPS = fpsFromFrameTime(worstFrame);
    const maximumFPS = fpsFromFrameTime(bestFrame);

    const result = {
      mode: this.mode,
      scheduler: window.__STILLLIGHT_BENCHMARK_SCHEDULER__?.mode || 'native-requestAnimationFrame',
      fpsMeaning: 'render-loop-throughput',
      totalDurationMs: round(durationMs),
      totalFrameCallbacks: this.rafCallbacks,
      totalRAFCallbacks: this.rafCallbacks,
      renderedFrameCount: this.renderedFrames,
      minimumFPS: round(minimumFPS),
      averageFPS: round(averageFPS),
      maximumFPS: round(maximumFPS),
      minimumSampleFPS: round(minimumFPS),
      onePercentLowFPS: onePercentLow === null ? UNAVAILABLE : round(onePercentLow),
      averageFrameTimeMs: round(avgFrame),
      p95FrameTimeMs: round(percentile(this.frameTimes, 0.95)),
      p99FrameTimeMs: round(percentile(this.frameTimes, 0.99)),
      bestFrameTimeMs: round(bestFrame),
      worstFrameTimeMs: round(worstFrame),
      framesOver16_67Ms: this.frameTimes.filter((value) => value > 16.67).length,
      framesOver8_33Ms: this.frameTimes.filter((value) => value > 8.33).length,
      averageUpdateSimulationCpuTimeMs: round(average(this.updateTimes)),
      averageRenderCpuTimeMs: round(average(this.renderTimes)),
      p95RenderCpuTimeMs: round(percentile(this.renderTimes, 0.95)),
      peakSimultaneouslyAnimatedGlasses: this.peakAnimatedGlasses,
      peakSimultaneousActivePours: this.peakActivePours,
      peakSimultaneousActiveStreams: this.peakActiveStreams,
      totalScriptedPours: this.totalScriptedPours,
      totalHintEvents: this.totalHintEvents,
      totalInvalidEvents: this.totalInvalidEvents,
      jsHeapStartBytes: this.heapStartBytes,
      jsHeapEndBytes: this.heapEndBytes,
      jsHeapDeltaBytes: this.heapDeltaBytes,
      longTaskCount: this.longTaskCount === UNAVAILABLE ? UNAVAILABLE : this.longTaskCount,
      longTaskDurationMs: this.longTaskDurationMs === UNAVAILABLE ? UNAVAILABLE : round(this.longTaskDurationMs),
    };

    this.running = false;
    this.onComplete(result);
    console.log(`STILLLIGHT_BENCHMARK_RESULT ${JSON.stringify(result)}`);
    window.dispatchEvent(new CustomEvent('stilllight-benchmark-complete', { detail: result }));
    return result;
  }
}
