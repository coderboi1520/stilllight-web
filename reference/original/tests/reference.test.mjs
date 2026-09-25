import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { movingPose, selectedPose, invalidPose, tiltForUnits } from '../src/geometry.js';
import { pour } from '../src/puzzle.js';

const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('reference contains exactly two interactive glasses', () => {
  assert.equal((html.match(/data-glass=/g) ?? []).length, 2);
});

test('original animation constants are preserved', () => {
  for (const token of [
    'const POUR_MS = 1040',
    'const SELECT_MS = 300',
    'const INVALID_MS = 420',
    'const SETTLE_MS = 440',
    'const HINT_ATTENTION_MS = 680',
    'const TRANSFER_START = 0.30',
    'const TRANSFER_END = 0.69',
    'ctx.lineWidth = 5.8',
    'ctx.shadowBlur = 10',
  ]) assert.ok(main.includes(token), `missing original token: ${token}`);
});

test('original dynamic tilt remains volume-dependent', () => {
  assert.ok(tiltForUnits(0) > tiltForUnits(3));
  assert.equal(tiltForUnits(0), 1.565);
});

test('selection and invalid motion remain nontrivial', () => {
  const selected = selectedPose(0, 0.6);
  const invalid = invalidPose(0, 0.28, 1);
  assert.notEqual(selected.y, 130);
  assert.notEqual(invalid.x, 80);
  assert.notEqual(invalid.angle, 0);
});

test('valid reference pour transfers the original matching top run', () => {
  const board = [[2, 0, 3], [3]];
  const result = pour(board, 0, 1);
  assert.ok(result);
  assert.equal(result.amount, 1);
  assert.deepEqual(result.board, [[2, 0], [3, 3]]);
});

test('same-row moving pose uses original choreography', () => {
  const pose = movingPose(0, 1, 0.5, 3);
  assert.ok(pose.x > 80);
  assert.ok(pose.y < 130);
  assert.ok(pose.angle > 0);
});


test('invisible hit buttons cannot show the browser native focus outline', () => {
  assert.match(css, /\.hit-glasses button:focus[\s\S]*?outline:\s*none/);
  assert.match(css, /\.hit-glasses button:focus-visible[\s\S]*?outline:\s*none/);
});
