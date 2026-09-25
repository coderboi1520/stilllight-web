import { performance } from 'node:perf_hooks';

export function makeResult(name, status, startedAt, details = undefined, artifacts = []) {
  return { name, status, durationMs: Math.round(performance.now() - startedAt), ...(details ? { details } : {}), ...(artifacts.length ? { artifacts } : {}) };
}

export function printSummary(results, title = 'Verification') {
  console.log(`\n${title}`);
  for (const result of results) {
    console.log(`${result.status.padEnd(7)} ${result.name} (${result.durationMs}ms)${result.details ? ` — ${result.details}` : ''}`);
    for (const artifact of result.artifacts ?? []) console.log(`        artifact: ${artifact}`);
  }
  return results.every(result => result.status !== 'FAIL');
}

export async function runScenario(name, action) {
  const started = performance.now();
  try {
    const value = await action();
    return makeResult(name, 'PASS', started, value?.details, value?.artifacts);
  } catch (error) {
    return makeResult(name, 'FAIL', started, error instanceof Error ? error.message : String(error), error?.artifacts ?? []);
  }
}
