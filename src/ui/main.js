import { data, stages } from '../data/index.js';
import { createApp, appUpdate } from '../core/app.js';
import { createInput } from './input.js';
import { createStepper } from './stepper.js';
import { createAudio } from './audio.js';
import { draw, createFx, absorb, ageFx } from './draw.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fit() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);
}
window.addEventListener('resize', fit);
fit();

const app = createApp({ data, stages, storage: window.localStorage, seed: Date.now() });
const input = createInput(window);
const audio = createAudio();
const fx = createFx();
const advance = createStepper(1 / 60, (dt, frameInput) => appUpdate(app, dt, frameInput));

let last = performance.now();
function frame(now) {
  const elapsed = (now - last) / 1000;
  last = now;
  const frameInput = input.read();
  if (frameInput.pressed.size) audio.unlock();
  if (frameInput.pressed.has('mute')) audio.toggleMute();
  advance(elapsed, frameInput);
  audio.play(app.events);
  absorb(fx, app.events);
  app.events.length = 0;
  ageFx(fx, Math.min(elapsed, 0.1));
  draw(ctx, app, fx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
