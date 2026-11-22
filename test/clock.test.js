import test from 'node:test';
import assert from 'node:assert/strict';
import { createClock, tickClock, rewindPrice, rewind } from '../src/core/clock.js';

const data = { balance: { clock: { seconds: 30, rewindBase: 40, rewindGrowth: 1.5 } } };

test('the clock counts down and tracks total time spent', () => {
  const clock = createClock(data);
  const expired = tickClock(clock, 12.5);
  assert.equal(expired, false);
  assert.equal(clock.left, 17.5);
  assert.equal(clock.elapsed, 12.5);
});

test('the clock stops at zero, reports expiry and never counts time past the end', () => {
  const clock = createClock(data);
  assert.equal(tickClock(clock, 29), false);
  assert.equal(tickClock(clock, 5), true);
  assert.equal(clock.left, 0);
  assert.equal(clock.elapsed, 30);
});

test('each rewind makes the next one dearer', () => {
  const clock = createClock(data);
  const purse = { gold: 1000 };
  const prices = [];
  for (let i = 0; i < 3; i++) {
    prices.push(rewindPrice(clock, data));
    rewind(clock, purse, data);
  }
  assert.deepEqual(prices, [40, 60, 90]);
});

test('rewinding restores the full clock, charges the purse and keeps the time already spent', () => {
  const clock = createClock(data);
  const purse = { gold: 100 };
  tickClock(clock, 20);
  assert.equal(rewind(clock, purse, data), true);
  assert.equal(clock.left, 30);
  assert.equal(clock.elapsed, 20);
  assert.equal(clock.rewinds, 1);
  assert.equal(purse.gold, 60);
});

test('a rewind is refused when the purse cannot cover the price', () => {
  const clock = createClock(data);
  const purse = { gold: 39 };
  tickClock(clock, 20);
  assert.equal(rewind(clock, purse, data), false);
  assert.equal(clock.left, 10);
  assert.equal(clock.rewinds, 0);
  assert.equal(purse.gold, 39);
});
