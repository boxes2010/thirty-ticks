import test from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../src/ui/input.js';

function keyboard() {
  const target = new EventTarget();
  const send = (type, code, extra = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { code, repeat: false, ...extra });
    target.dispatchEvent(event);
    return event;
  };
  return {
    input: createInput(target),
    down: (code, extra) => send('keydown', code, extra),
    up: (code) => send('keyup', code),
    blur: () => target.dispatchEvent(new Event('blur')),
  };
}

test('a key press is reported once, however long the key stays down', () => {
  const kb = keyboard();
  kb.down('Enter');
  assert.deepEqual([...kb.input.read().pressed], ['confirm']);
  kb.down('Enter', { repeat: true });
  assert.deepEqual([...kb.input.read().pressed], []);
});

test('presses between two reads are all delivered together', () => {
  const kb = keyboard();
  kb.down('ArrowDown');
  kb.up('ArrowDown');
  kb.down('Enter');
  assert.deepEqual([...kb.input.read().pressed].sort(), ['confirm', 'down']);
});

test('arrow keys and WASD both steer, and the direction lasts while held', () => {
  const kb = keyboard();
  kb.down('KeyD');
  assert.equal(kb.input.read().dir, 'right');
  assert.equal(kb.input.read().dir, 'right');
  kb.up('KeyD');
  assert.equal(kb.input.read().dir, null);
  kb.down('ArrowUp');
  assert.equal(kb.input.read().dir, 'up');
});

test('the newest direction wins, and releasing it falls back to the one still held', () => {
  const kb = keyboard();
  kb.down('ArrowRight');
  kb.down('ArrowUp');
  assert.equal(kb.input.read().dir, 'up');
  kb.up('ArrowUp');
  assert.equal(kb.input.read().dir, 'right');
});

test('space confirms once and counts as dash for as long as it is held', () => {
  const kb = keyboard();
  kb.down('Space');
  const first = kb.input.read();
  assert.ok(first.pressed.has('confirm'));
  assert.equal(first.dash, true);
  const second = kb.input.read();
  assert.ok(!second.pressed.has('confirm'));
  assert.equal(second.dash, true);
  kb.up('Space');
  assert.equal(kb.input.read().dash, false);
});

test('X goes back once and counts as flee while held', () => {
  const kb = keyboard();
  kb.down('KeyX');
  const first = kb.input.read();
  assert.ok(first.pressed.has('back'));
  assert.equal(first.flee, true);
  kb.up('KeyX');
  assert.equal(kb.input.read().flee, false);
});

test('escape means both pause and back', () => {
  const kb = keyboard();
  kb.down('Escape');
  assert.deepEqual([...kb.input.read().pressed].sort(), ['back', 'pause']);
});

test('game keys do not scroll the page, and other keys are left alone', () => {
  const kb = keyboard();
  assert.equal(kb.down('Space').defaultPrevented, true);
  assert.equal(kb.down('ArrowDown').defaultPrevented, true);
  assert.equal(kb.down('KeyR').defaultPrevented, false);
  assert.equal(kb.down('F5').defaultPrevented, false);
});

test('losing focus releases everything that was held', () => {
  const kb = keyboard();
  kb.down('ArrowLeft');
  kb.down('Space');
  kb.blur();
  const after = kb.input.read();
  assert.equal(after.dir, null);
  assert.equal(after.dash, false);
});
