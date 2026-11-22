import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, appUpdate, SAVE_KEY } from '../src/core/app.js';
import { createCampaign, recordClear, toSave, fromSave } from '../src/core/campaign.js';
import { DT, data, makeStage } from './helpers.js';

const noTown = { towns: [], gates: [] };

function memoryStorage(initial = {}) {
  const kept = new Map(Object.entries(initial));
  return { getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => kept.set(k, String(v)) };
}

function boot({ a = {}, b = {}, saved } = {}) {
  const stages = [
    makeStage({ id: 'a', name: 'First', after: [], intro: 'Go.', ...a }),
    makeStage({ id: 'b', name: 'Second', after: ['a'], intro: 'Go on.', ...b }),
  ];
  const storage = memoryStorage(saved ? { [SAVE_KEY]: saved } : {});
  return { app: createApp({ data, stages, storage, seed: 1 }), storage };
}

const press = (app, ...keys) => appUpdate(app, DT, { pressed: new Set(keys) });
const idle = (app, seconds) => appUpdate(app, seconds, { pressed: new Set() });

function hold(app, input, until) {
  let n = 0;
  while (!until()) {
    appUpdate(app, DT, { pressed: new Set(), ...input });
    assert.ok(++n < 100000, 'never got there');
  }
}

function clearedA() {
  const campaign = createCampaign();
  recordClear(campaign, 'a', { elapsed: 12, rewinds: 0, level: 3, medal: 'silver' }, { tool: 'spanner' });
  return toSave(campaign);
}

function intoStage(app) {
  press(app, 'confirm');
  press(app, 'confirm');
  press(app, 'confirm');
  assert.equal(app.screen, 'stage');
}

function intoTown(app) {
  intoStage(app);
  hold(app, { dir: 'right' }, () => app.session.mode === 'town');
}

// --- title and map ---

test('the title screen leads to the district map', () => {
  const { app } = boot();
  assert.equal(app.screen, 'title');
  press(app, 'confirm');
  assert.equal(app.screen, 'map');
});

test('a district that is still locked cannot be picked', () => {
  const { app } = boot();
  press(app, 'confirm');
  press(app, 'right');
  assert.equal(app.pick, 0);
});

test('the map opens on the first district not yet cleared, and the cursor stops at either end', () => {
  const { app } = boot({ saved: clearedA() });
  press(app, 'confirm');
  assert.equal(app.pick, 1);
  press(app, 'right');
  assert.equal(app.pick, 1);
  press(app, 'left');
  assert.equal(app.pick, 0);
  press(app, 'left');
  assert.equal(app.pick, 0);
});

test('back on the map returns to the title', () => {
  const { app } = boot();
  press(app, 'confirm');
  press(app, 'back');
  assert.equal(app.screen, 'title');
});

// --- briefing ---

test('picking a district shows its briefing, and the clock only starts once it is dismissed', () => {
  const { app } = boot();
  press(app, 'confirm');
  press(app, 'confirm');
  assert.equal(app.screen, 'intro');
  assert.equal(app.session.stage.id, 'a');
  idle(app, 5);
  assert.equal(app.session.clock.left, 30);
  press(app, 'confirm');
  assert.equal(app.screen, 'stage');
  idle(app, 1);
  assert.equal(app.session.clock.left, 29);
});

test('a new run starts with the gear the campaign has banked', () => {
  const { app } = boot({ saved: clearedA() });
  intoStage(app);
  assert.equal(app.session.stage.id, 'b');
  assert.equal(app.session.hero.gear.tool, 'spanner');
});

// --- playing ---

test('held directions walk the hero on the field', () => {
  const { app } = boot();
  intoStage(app);
  hold(app, { dir: 'right' }, () => app.session.pos.x === 1);
  assert.deepEqual(app.session.pos, { x: 1, y: 0 });
});

test('held dash and flee reach the fight', () => {
  const { app } = boot({ a: { start: [2, 2], encounters: { '.': { steps: [1, 1], teams: [['mite']] } } } });
  intoStage(app);
  hold(app, { dir: 'right' }, () => app.session.mode === 'battle');
  const hp = app.session.hero.hp;
  appUpdate(app, DT, { pressed: new Set(), dash: true });
  assert.ok(app.session.hero.hp < hp, 'dashing should cost health');
  hold(app, { flee: true }, () => app.session.mode !== 'battle');
  assert.equal(app.session.mode, 'field');
  assert.equal(app.session.hero.gold, 50);
});

// --- town menu ---

test('the town cursor moves through the menu and wraps at both ends', () => {
  const { app } = boot();
  intoTown(app);
  assert.equal(app.cursor, 0);
  press(app, 'up');
  assert.equal(app.cursor, 5);
  press(app, 'down');
  assert.equal(app.cursor, 0);
  press(app, 'down');
  assert.equal(app.cursor, 1);
});

test('confirm performs the highlighted action and shows the reply', () => {
  const { app } = boot();
  intoTown(app);
  press(app, 'up');
  press(app, 'up');
  press(app, 'confirm');
  assert.equal(app.said, 'I lost my coins in the south field.');
  assert.equal(app.session.mode, 'town');
});

test('choosing leave, or pressing back, returns to the field', () => {
  const viaMenu = boot().app;
  intoTown(viaMenu);
  press(viaMenu, 'up');
  press(viaMenu, 'confirm');
  assert.equal(viaMenu.session.mode, 'field');

  const viaBack = boot().app;
  intoTown(viaBack);
  press(viaBack, 'back');
  assert.equal(viaBack.session.mode, 'field');
});

test('coming back to a town starts at the top of the menu with no stale reply', () => {
  const { app } = boot();
  intoTown(app);
  press(app, 'up');
  press(app, 'up');
  press(app, 'confirm');
  press(app, 'back');
  press(app, 'confirm');
  assert.equal(app.session.mode, 'town');
  assert.equal(app.cursor, 0);
  assert.equal(app.said, '');
});

// --- endings ---

function clearStageA(app) {
  intoStage(app);
  hold(app, { dir: 'right' }, () => app.session.mode === 'battle');
  hold(app, {}, () => app.screen !== 'stage');
}

test('clearing a district saves the run and the gear, and opens the next one', () => {
  const { app, storage } = boot({ a: noTown });
  clearStageA(app);
  assert.equal(app.screen, 'cleared');
  const saved = fromSave(storage.getItem(SAVE_KEY));
  assert.equal(saved.cleared.a.medal, 'gold');
  assert.deepEqual(saved.gear, { tool: null, coat: null, boots: null, charm: null });
  press(app, 'confirm');
  assert.equal(app.screen, 'map');
  assert.equal(app.pick, 1);
});

test('when a district unwinds, nothing is saved and confirm retries it from the top', () => {
  const { app, storage } = boot();
  intoTown(app);
  press(app, 'down');
  press(app, 'down');
  press(app, 'confirm');
  assert.equal(app.session.hero.gear.tool, 'spanner');
  press(app, 'back');
  idle(app, 31);
  assert.equal(app.screen, 'unwound');
  assert.equal(storage.getItem(SAVE_KEY), null);
  press(app, 'confirm');
  assert.equal(app.screen, 'intro');
  assert.equal(app.session.clock.left, 30);
  assert.equal(app.session.hero.gear.tool, null);
  assert.deepEqual(app.session.pos, { x: 0, y: 0 });
});

test('back from an unwound district returns to the map', () => {
  const { app } = boot();
  intoStage(app);
  idle(app, 31);
  press(app, 'back');
  assert.equal(app.screen, 'map');
});

// --- pausing ---

test('pausing freezes the clock and resuming restarts it', () => {
  const { app } = boot();
  intoStage(app);
  press(app, 'pause');
  const left = app.session.clock.left;
  idle(app, 5);
  assert.equal(app.session.clock.left, left);
  press(app, 'confirm');
  idle(app, 1);
  assert.equal(app.session.clock.left, left - 1);
});

test('a key that means both pause and back pauses on the field but simply leaves a town', () => {
  const onField = boot().app;
  intoStage(onField);
  press(onField, 'pause', 'back');
  assert.equal(onField.paused, true);
  press(onField, 'pause', 'back');
  assert.equal(onField.paused, false);

  const inTown = boot().app;
  intoTown(inTown);
  press(inTown, 'pause', 'back');
  assert.equal(inTown.paused, false);
  assert.equal(inTown.session.mode, 'field');
});

test('giving up from the pause menu returns to the map without saving', () => {
  const { app, storage } = boot();
  intoStage(app);
  press(app, 'pause');
  press(app, 'down');
  press(app, 'confirm');
  assert.equal(app.screen, 'map');
  assert.equal(storage.getItem(SAVE_KEY), null);
});

// --- cues for sound and effects ---

const cues = (app) => app.events.splice(0).map((e) => e.type).filter((type) => type !== 'cursor');

function fightOnce(team) {
  const { app } = boot({ a: { start: [2, 2], encounters: { '.': { steps: [1, 1], teams: [team] } } } });
  intoStage(app);
  hold(app, { dir: 'right' }, () => app.session.mode === 'battle');
  app.events.length = 0;
  hold(app, {}, () => app.session.mode !== 'battle');
  return app;
}

test('a won fight reports its payout, and a level-up when one happens', () => {
  const single = cues(fightOnce(['mite']));
  assert.ok(single.includes('coin'));
  assert.ok(!single.includes('level'));
  const pair = cues(fightOnce(['mite', 'mite']));
  assert.ok(pair.includes('coin'));
  assert.ok(pair.includes('level'));
});

test('being knocked out is reported, without a payout', () => {
  const seen = cues(fightOnce(['brute']));
  assert.ok(seen.includes('down'));
  assert.ok(!seen.includes('coin'));
});

test('moving a menu cursor is reported', () => {
  const { app } = boot();
  intoTown(app);
  app.events.length = 0;
  press(app, 'down');
  assert.deepEqual(app.events.map((e) => e.type), ['cursor']);
});

test('each second that runs out is reported as a tick', () => {
  const { app } = boot();
  intoStage(app);
  cues(app);
  idle(app, 0.5);
  assert.deepEqual(cues(app), []);
  idle(app, 0.5);
  assert.deepEqual(cues(app), ['tick']);
});

test('every clash in a fight is reported with its damage, including the last one', () => {
  const { app } = boot({ a: { start: [2, 2], encounters: { '.': { steps: [1, 1], teams: [['mite']] } } } });
  intoStage(app);
  hold(app, { dir: 'right' }, () => app.session.mode === 'battle');
  app.events.length = 0;
  hold(app, {}, () => app.session.mode !== 'battle');
  const clashes = app.events.filter((e) => e.type === 'clash');
  assert.deepEqual(clashes.map((c) => [c.dealt, c.taken, c.felled]), [[5, 2, false], [5, 2, true]]);
});

test('town actions are reported as done or refused', () => {
  const { app } = boot({ a: { purse: 35 } });
  intoTown(app);
  cues(app);
  press(app, 'down');
  press(app, 'down');
  press(app, 'confirm');
  assert.deepEqual(cues(app), ['deny']);
  press(app, 'down');
  press(app, 'confirm');
  assert.deepEqual(cues(app), ['buy']);
});

test('unwinding and clearing are each reported once', () => {
  const lost = boot().app;
  intoStage(lost);
  idle(lost, 31);
  idle(lost, 1);
  assert.equal(lost.events.filter((e) => e.type === 'unwound').length, 1);

  const won = boot({ a: noTown }).app;
  clearStageA(won);
  idle(won, 1);
  assert.equal(won.events.filter((e) => e.type === 'cleared').length, 1);
});
