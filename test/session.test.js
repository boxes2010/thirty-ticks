import test from 'node:test';
import assert from 'node:assert/strict';
import { update } from '../src/core/session.js';
import { heroStats } from '../src/core/hero.js';
import { DT, data, start, walk, fight, act, menuEntry } from './helpers.js';

const noTown = { towns: [], gates: [] };
const wild = (teams, steps = [1, 1]) => ({ encounters: { '.': { steps, teams } } });

function scripted(values) {
  let i = 0;
  return () => (i < values.length ? values[i++] : 0.5);
}

// --- starting out ---

test('a run starts with the stage purse and the gear carried in', () => {
  const s = start({}, { gear: { tool: 'spanner' } });
  assert.equal(s.hero.gold, 50);
  assert.equal(s.hero.gear.tool, 'spanner');
  assert.equal(s.mode, 'field');
});

// --- moving on the field ---

test('the clock runs while the hero stands on the field', () => {
  const s = start();
  update(s, 1, {});
  assert.equal(s.clock.left, 29);
});

test('holding a direction walks one tile at the hero pace', () => {
  const s = start();
  update(s, 0.125, { dir: 'right' });
  assert.deepEqual(s.pos, { x: 0, y: 0 });
  update(s, 0.125, { dir: 'right' });
  assert.deepEqual(s.pos, { x: 1, y: 0 });
});

test('slow terrain takes proportionally longer to cross', () => {
  const plain = start({ start: [2, 2] });
  walk(plain, 'up');
  const thicket = start({ start: [3, 2] });
  walk(thicket, 'up');
  assert.deepEqual(plain.pos, { x: 2, y: 1 });
  assert.deepEqual(thicket.pos, { x: 3, y: 1 });
  assert.equal(plain.clock.elapsed, 0.25);
  assert.equal(thicket.clock.elapsed, 0.5);
});

test('water blocks the way and the hero turns to face it', () => {
  const s = start({ start: [0, 1] });
  walk(s, 'right');
  assert.deepEqual(s.pos, { x: 0, y: 1 });
  assert.equal(s.facing, 'right');
});

test('the map edge blocks the way', () => {
  const s = start();
  walk(s, 'left', 'up');
  assert.deepEqual(s.pos, { x: 0, y: 0 });
});

// --- towns, gates and spots ---

test('walking onto a town enters it and time stands still inside', () => {
  const s = start();
  walk(s, 'right', 'right');
  assert.equal(s.mode, 'town');
  assert.equal(s.town.id, 'inn');
  const left = s.clock.left;
  update(s, 5, {});
  assert.equal(s.clock.left, left);
});

test('leaving town puts the hero back on the field at the town tile', () => {
  const s = start();
  walk(s, 'right', 'right');
  act(s, 'leave');
  assert.equal(s.mode, 'field');
  assert.deepEqual(s.pos, { x: 2, y: 0 });
  update(s, 1, {});
  assert.equal(s.clock.left, 28.5);
});

test('confirm re-enters the town the hero is standing on', () => {
  const s = start();
  walk(s, 'right', 'right');
  act(s, 'leave');
  update(s, DT, { confirm: true });
  assert.equal(s.mode, 'town');
});

test('a gate blocks the way and shows its hint until its flag is set', () => {
  const s = start();
  walk(s, 'right', 'right');
  act(s, 'leave');
  walk(s, 'right');
  assert.deepEqual(s.pos, { x: 2, y: 0 });
  assert.equal(s.notice.text, 'Locked.');
  s.flags.add('gate_open');
  walk(s, 'right');
  assert.deepEqual(s.pos, { x: 3, y: 0 });
});

test('a notice fades after a few seconds', () => {
  const s = start({ start: [2, 0] });
  walk(s, 'right');
  assert.equal(s.notice.text, 'Locked.');
  update(s, 2, {});
  assert.equal(s.notice.text, 'Locked.');
  update(s, 2, {});
  assert.equal(s.notice, null);
});

test('a spot pays out once', () => {
  const s = start({ start: [0, 1] });
  walk(s, 'down');
  assert.equal(s.hero.gold, 75);
  assert.ok(s.flags.has('found'));
  assert.equal(s.notice.text, 'Found coins.');
  walk(s, 'up', 'down');
  assert.equal(s.hero.gold, 75);
});

// --- encounters ---

test('a fight starts after the rolled number of steps on wild terrain', () => {
  const s = start({ start: [2, 2], ...wild([['mite']], [2, 2]) });
  walk(s, 'right');
  assert.equal(s.mode, 'field');
  walk(s, 'right');
  assert.equal(s.mode, 'battle');
  assert.equal(s.battle.foes[0].unit, 'mite');
});

test('roads never start a fight', () => {
  const s = start({ ...noTown, tower: { at: [4, 2], boss: ['boss'], needs: [] }, encounters: { '.': { steps: [1, 1], teams: [['mite']] } } });
  walk(s, 'right', 'right', 'right', 'right');
  assert.deepEqual(s.pos, { x: 4, y: 0 });
  assert.equal(s.mode, 'field');
});

test('the dice choose both the wait and the team', () => {
  const s = start(
    { start: [1, 2], ...wild([['mite'], ['brute']], [1, 3]) },
    { rng: scripted([0.99, 0.6]) },
  );
  walk(s, 'right', 'right');
  assert.equal(s.mode, 'field');
  walk(s, 'right');
  assert.equal(s.mode, 'battle');
  assert.equal(s.battle.foes[0].unit, 'brute');
});

// --- fights ---

test('winning a fight pays out and returns the hero to the field', () => {
  const s = start({ start: [2, 2], ...wild([['mite']]) });
  walk(s, 'right');
  fight(s);
  assert.equal(s.mode, 'field');
  assert.equal(s.hero.gold, 56);
  assert.equal(s.hero.exp, 2);
  assert.equal(s.battle, null);
});

test('the clock keeps running during a fight', () => {
  const s = start({ start: [2, 2], ...wild([['mite']]) });
  walk(s, 'right');
  assert.equal(s.clock.left, 29.75);
  assert.equal(fight(s), 74);
  assert.equal(s.clock.left, 28.59375);
});

test('going down sends the hero to the last town at half health and burns extra time', () => {
  const s = start(wild([['brute']]));
  walk(s, 'right', 'right');
  act(s, 'leave');
  walk(s, 'down');
  assert.equal(s.mode, 'battle');
  fight(s);
  assert.equal(s.mode, 'field');
  assert.deepEqual(s.pos, { x: 2, y: 0 });
  assert.equal(s.hero.hp, 15);
  assert.equal(s.clock.left, 25.09375);
});

test('with no town visited, going down returns the hero to the start', () => {
  const s = start({ start: [2, 2], ...wild([['brute']]) });
  walk(s, 'right');
  fight(s);
  assert.deepEqual(s.pos, { x: 2, y: 2 });
  assert.equal(s.mode, 'field');
});

test('fleeing leaves the fight with nothing gained', () => {
  const s = start({ start: [2, 2], ...wild([['mite']]) });
  walk(s, 'right');
  fight(s, { flee: true });
  assert.equal(s.mode, 'field');
  assert.equal(s.hero.gold, 50);
  assert.equal(s.hero.exp, 0);
});

test('foes already felled still pay out when the hero flees', () => {
  const s = start({ start: [2, 2], ...wild([['mite', 'brute']]) });
  walk(s, 'right');
  while (s.battle.foes[0].hp > 0) update(s, DT, {});
  fight(s, { flee: true });
  assert.equal(s.hero.gold, 56);
  assert.equal(s.hero.exp, 2);
});

// --- the tower ---

test('walking onto the tower starts the boss fight', () => {
  const s = start(noTown);
  walk(s, 'right', 'right', 'right', 'right');
  assert.equal(s.mode, 'battle');
  assert.equal(s.battle.foes[0].unit, 'boss');
});

test('beating the boss clears the stage and reports the run', () => {
  const s = start(noTown);
  walk(s, 'right', 'right', 'right', 'right');
  fight(s);
  assert.equal(s.mode, 'cleared');
  assert.deepEqual(s.result, { elapsed: 2.15625, rewinds: 0, level: 1, medal: 'gold' });
});

for (const [par, medal] of [
  [[10, 20, 30], 'gold'],
  [[1, 3, 5], 'silver'],
  [[1, 2, 3], 'bronze'],
  [[1, 1.5, 2], 'none'],
]) {
  test(`a 2.2 second run against par ${par.join('/')} earns ${medal}`, () => {
    const s = start({ ...noTown, par });
    walk(s, 'right', 'right', 'right', 'right');
    fight(s);
    assert.equal(s.result.medal, medal);
  });
}

test('the tower stays shut, with its hint, while a required flag is missing', () => {
  const s = start({ ...noTown, tower: { at: [4, 0], boss: ['boss'], needs: ['key'], hint: 'Sealed.' } });
  walk(s, 'right', 'right', 'right', 'right');
  assert.equal(s.mode, 'field');
  assert.deepEqual(s.pos, { x: 4, y: 0 });
  assert.equal(s.notice.text, 'Sealed.');
  s.flags.add('key');
  update(s, DT, { confirm: true });
  assert.equal(s.mode, 'battle');
});

test('fleeing the boss leaves the hero at the tower door, free to try again', () => {
  const s = start(noTown);
  walk(s, 'right', 'right', 'right', 'right');
  while (s.battle.foes[0].hp === 10) update(s, DT, {});
  fight(s, { flee: true });
  assert.equal(s.mode, 'field');
  assert.deepEqual(s.pos, { x: 4, y: 0 });
  update(s, DT, { confirm: true });
  assert.equal(s.mode, 'battle');
  assert.equal(s.battle.foes[0].hp, 10);
});

// --- unwinding ---

test('the stage unwinds when the clock runs out on the field', () => {
  const s = start();
  update(s, 31, {});
  assert.equal(s.mode, 'unwound');
});

test('the stage unwinds when the clock runs out mid-fight', () => {
  const s = start({ start: [2, 2], ...wild([['mite']]) });
  update(s, 29, {});
  walk(s, 'right');
  assert.equal(s.mode, 'battle');
  fight(s);
  assert.equal(s.mode, 'unwound');
});

test('the time lost by going down can itself unwind the stage', () => {
  const s = start({ start: [2, 2], ...wild([['brute']]) });
  update(s, 26, {});
  walk(s, 'right');
  fight(s);
  assert.equal(s.mode, 'unwound');
});

// --- in town ---

test('rewinding in town restores the clock for the current price, and the next costs more', () => {
  const s = start();
  update(s, 10, {});
  walk(s, 'right', 'right');
  assert.deepEqual(
    { price: menuEntry(s, 'rewind').entry.price, enabled: menuEntry(s, 'rewind').entry.enabled },
    { price: 40, enabled: true },
  );
  assert.equal(act(s, 'rewind').ok, true);
  assert.equal(s.clock.left, 30);
  assert.equal(s.hero.gold, 10);
  assert.deepEqual(
    { price: menuEntry(s, 'rewind').entry.price, enabled: menuEntry(s, 'rewind').entry.enabled },
    { price: 60, enabled: false },
  );
  assert.equal(act(s, 'rewind').ok, false);
  assert.equal(s.hero.gold, 10);
});

test('a meal restores full health for its price', () => {
  const s = start();
  walk(s, 'right', 'right');
  s.hero.hp = 5;
  assert.equal(act(s, 'eatery').ok, true);
  assert.equal(s.hero.hp, 30);
  assert.equal(s.hero.gold, 40);
});

test('the eatery turns away a hero who is already at full health', () => {
  const s = start();
  walk(s, 'right', 'right');
  assert.equal(menuEntry(s, 'eatery').entry.enabled, false);
  assert.equal(act(s, 'eatery').ok, false);
  assert.equal(s.hero.gold, 50);
});

test('buying gear equips it and takes the gold', () => {
  const s = start();
  walk(s, 'right', 'right');
  assert.equal(act(s, 'buy', 'spanner').ok, true);
  assert.equal(s.hero.gear.tool, 'spanner');
  assert.equal(s.hero.gold, 10);
  assert.equal(heroStats(s.hero, data).atk, 8);
});

test('the shop will not sell what the purse cannot cover', () => {
  const s = start({ purse: 35 });
  walk(s, 'right', 'right');
  assert.equal(menuEntry(s, 'buy', 'spanner').entry.enabled, false);
  assert.equal(act(s, 'buy', 'spanner').ok, false);
  assert.equal(s.hero.gear.tool, null);
  assert.equal(s.hero.gold, 35);
});

test('the shop will not sell what is already equipped', () => {
  const s = start();
  walk(s, 'right', 'right');
  act(s, 'buy', 'apron');
  assert.equal(menuEntry(s, 'buy', 'apron').entry.enabled, false);
  assert.equal(act(s, 'buy', 'apron').ok, false);
  assert.equal(s.hero.gold, 20);
});

test('townsfolk say the first line whose conditions hold, and its effects apply once', () => {
  const s = start();
  walk(s, 'right', 'right');
  assert.equal(act(s, 'talk').text, 'I lost my coins in the south field.');
  s.flags.add('found');
  assert.equal(act(s, 'talk').text, 'You found it! The gate is open.');
  assert.ok(s.flags.has('gate_open'));
  assert.equal(s.hero.gold, 55);
  assert.equal(act(s, 'talk').text, 'Safe travels.');
  assert.equal(s.hero.gold, 55);
});
