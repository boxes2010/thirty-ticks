import test from 'node:test';
import assert from 'node:assert/strict';
import { createStepper } from '../src/ui/stepper.js';

function recorder(step = 0.25) {
  const calls = [];
  const advance = createStepper(step, (dt, input) => calls.push({ dt, dir: input.dir, pressed: [...input.pressed] }));
  return { calls, advance };
}
const frame = (pressed = [], dir = null) => ({ dir, pressed: new Set(pressed) });

test('time is handed on in fixed steps, with the remainder carried to the next frame', () => {
  const { calls, advance } = recorder();
  advance(0.375, frame());
  assert.equal(calls.length, 1);
  advance(0.125, frame());
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((c) => c.dt), [0.25, 0.25]);
});

test('a press on a frame too short to step is kept for the next step and delivered once', () => {
  const { calls, advance } = recorder();
  advance(0.125, frame(['confirm']));
  assert.equal(calls.length, 0);
  advance(0.125, frame());
  advance(0.25, frame());
  assert.deepEqual(calls.map((c) => c.pressed), [['confirm'], []]);
});

test('when one frame covers several steps, a press reaches only the first', () => {
  const { calls, advance } = recorder();
  advance(0.75, frame(['confirm'], 'left'));
  assert.deepEqual(calls.map((c) => c.pressed), [['confirm'], [], []]);
  assert.deepEqual(calls.map((c) => c.dir), ['left', 'left', 'left']);
});

test('a long stall, such as a hidden tab, is not replayed as a burst of steps', () => {
  const { calls, advance } = recorder();
  advance(60, frame());
  assert.equal(calls.length, 1);
});
