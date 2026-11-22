// Drives the real game into one named screen and draws a single frame, for visual checks:
//   npm start, then open /test/shots.html?scene=battle
import { data, stages } from '../src/data/index.js';
import { createApp, appUpdate } from '../src/core/app.js';
import { createCampaign, recordClear, toSave } from '../src/core/campaign.js';
import { draw, createFx, absorb, ageFx } from '../src/ui/draw.js';

const fail = (err) => {
  document.getElementById('error').textContent = `${err?.stack ?? err}`;
};
window.addEventListener('error', (e) => fail(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => fail(e.reason));

const scene = new URLSearchParams(location.search).get('scene') ?? 'title';
const cleared = { 'map': 1, 'intro': 1, 'stage2': 1, 'stage3': 2 }[scene] ?? 0;

const campaign = createCampaign();
stages.slice(0, cleared).forEach((st, i) => {
  recordClear(campaign, st.id, { elapsed: 21.4 + i * 30, rewinds: i, level: 6 + i * 9, medal: i ? 'silver' : 'gold' }, { tool: 'spanner' });
});
const saved = toSave(campaign);
const app = createApp({ data, stages, storage: { getItem: () => saved, setItem() {} }, seed: 3 });
const fx = createFx();
const canvas = document.getElementById('game').getContext('2d');

function step(input = {}, dt = 1 / 60) {
  appUpdate(app, dt, { pressed: new Set(), ...input });
  absorb(fx, app.events);
  app.events.length = 0;
  ageFx(fx, Math.min(dt, 1 / 60));
  draw(canvas, app, fx);
}
const press = (...keys) => step({ pressed: new Set(keys) });
function until(input, done) {
  for (let i = 0; i < 60 * 300 && !done(); i++) step(input);
  if (!done()) throw new Error(`scene "${scene}" never reached its target state`);
}
const begin = () => {
  press('confirm');
  press('confirm');
  press('confirm');
};
const toTower = () => {
  const [x, y] = app.session.stage.tower.at;
  app.session.pos = { x, y };
  press('confirm');
};

const scenes = {
  title: () => { for (let i = 0; i < 400; i++) step(); },
  map: () => press('confirm'),
  intro: () => { press('confirm'); press('confirm'); },
  field: () => { begin(); until({ dir: 'right' }, () => app.session.pos.x === 4); step({ dir: 'up' }); for (let i = 0; i < 4; i++) step({ dir: 'up' }); },
  stage2: begin,
  stage3: begin,
  town: () => { begin(); until({ dir: 'right' }, () => app.session.mode === 'town'); press('down'); press('down'); },
  talk: () => { begin(); until({ dir: 'right' }, () => app.session.mode === 'town'); for (let i = 0; i < 4; i++) press('down'); press('confirm'); },
  battle: () => {
    begin();
    until({ dir: 'down' }, () => app.session.pos.y === 6);
    let turn = 0;
    until({}, () => {
      if (app.session.mode === 'battle') return true;
      step({ dir: turn++ % 40 < 20 ? 'left' : 'right' });
      return false;
    });
    until({}, () => app.session.battle?.foes[0].hp < data.units[app.session.battle.foes[0].unit].hp || app.session.mode !== 'battle');
    for (let i = 0; i < 5; i++) step();
  },
  boss: () => { begin(); app.session.hero.level = 7; app.session.hero.hp = 58; toTower(); until({}, () => app.session.battle.foes[0].hp < 60); for (let i = 0; i < 4; i++) step(); },
  low: () => { begin(); step({}, 25.3); for (let i = 0; i < 20; i++) step({ dir: 'right' }); },
  notice: () => { begin(); app.session.pos = { x: 15, y: 1 }; until({ dir: 'right' }, () => app.session.notice); },
  pause: () => { begin(); press('pause'); press('down'); },
  cleared: () => { begin(); app.session.hero.level = 12; app.session.hero.hp = 80; step({}, 17.2); toTower(); until({}, () => app.screen === 'cleared'); for (let i = 0; i < 60; i++) step(); },
  unwound: () => { begin(); step({}, 31); for (let i = 0; i < 60; i++) step(); },
};

try {
  if (!scenes[scene]) throw new Error(`unknown scene "${scene}". Try: ${Object.keys(scenes).join(', ')}`);
  scenes[scene]();
  draw(canvas, app, fx);
  document.title = `ready: ${scene}`;
} catch (err) {
  fail(err);
}
