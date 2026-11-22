import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, stepBattle } from '../src/core/battle.js';
import { createHero } from '../src/core/hero.js';

// 1/64 is exact in binary, so the step counts below are exact too.
const DT = 1 / 64;
const steady = () => 0.5;

const data = {
  balance: {
    hero: { hp: 30, atk: 5, def: 2, pace: 5, hpPerLevel: 6, atkPerLevel: 2, defPerLevel: 1, expBase: 4, expStep: 3 },
    battle: {
      laneStart: 60, foeStart: 300, foeGap: 70, reach: 24,
      heroSpeed: 240, dashFactor: 2, dashDrain: 0.2, fleeSpeed: 320,
      knockHero: 40, knockFoe: 20, variance: 0.1,
    },
  },
  items: {},
  units: {
    mite: { name: 'Mite', hp: 8, atk: 4, def: 0, speed: 0, exp: 2, gold: 6 },
    runner: { name: 'Runner', hp: 8, atk: 4, def: 0, speed: 60, exp: 2, gold: 6 },
    shell: { name: 'Shell', hp: 3, atk: 4, def: 99, speed: 0, exp: 5, gold: 1 },
    brute: { name: 'Brute', hp: 500, atk: 22, def: 0, speed: 0, exp: 50, gold: 50 },
  },
};

function untilClash(battle, hero, input = {}) {
  const startHp = battle.foes[0].hp;
  let steps = 0;
  while (battle.foes[0].hp === startHp && !battle.outcome) {
    stepBattle(battle, hero, input, DT, data, steady);
    steps += 1;
    assert.ok(steps < 10000, 'battle never reached a clash');
  }
  return steps;
}

function untilOver(battle, hero, input = {}) {
  let steps = 0;
  while (!battle.outcome) {
    stepBattle(battle, hero, input, DT, data, steady);
    steps += 1;
    assert.ok(steps < 100000, 'battle never ended');
  }
  return steps;
}

test('the hero runs at the foe and a clash hurts both sides', () => {
  const hero = createHero(data, {});
  const battle = createBattle(['mite'], data);
  const steps = untilClash(battle, hero);
  assert.equal(steps, 58);
  assert.equal(battle.foes[0].hp, 3);
  assert.equal(hero.hp, 28);
});

test('a clash knocks the two apart', () => {
  const hero = createHero(data, {});
  const battle = createBattle(['mite'], data);
  untilClash(battle, hero);
  assert.equal(battle.foes[0].x - battle.heroX, 82.5);
});

test('foes advance at their own speed, so the clash comes sooner', () => {
  const hero = createHero(data, {});
  const battle = createBattle(['runner'], data);
  assert.equal(untilClash(battle, hero), 47);
});

test('felling every foe wins and banks their exp and gold', () => {
  const hero = createHero(data, {});
  const battle = createBattle(['mite', 'mite'], data);
  untilOver(battle, hero);
  assert.equal(battle.outcome, 'won');
  assert.equal(battle.exp, 4);
  assert.equal(battle.gold, 12);
});

test('a blow always lands for at least 1, even on heavy armour', () => {
  const hero = createHero(data, {});
  const battle = createBattle(['shell'], data);
  untilClash(battle, hero);
  assert.equal(battle.foes[0].hp, 2);
});

test('the hero goes down when health runs out', () => {
  const hero = createHero(data, {});
  const battle = createBattle(['brute'], data);
  untilOver(battle, hero);
  assert.equal(battle.outcome, 'down');
  assert.equal(hero.hp, 0);
  assert.equal(battle.exp, 0);
});

test('holding flee runs the hero off the lane and ends the fight untouched', () => {
  const hero = createHero(data, {});
  const battle = createBattle(['mite'], data);
  const steps = untilOver(battle, hero, { flee: true });
  assert.equal(battle.outcome, 'fled');
  assert.equal(steps, 12);
  assert.equal(battle.foes[0].hp, 8);
  assert.equal(hero.hp, 30);
});

test('dashing halves the run-up and drains health on the way', () => {
  const hero = createHero(data, {});
  const battle = createBattle(['mite'], data);
  const steps = untilClash(battle, hero, { dash: true });
  assert.equal(steps, 29);
  assert.equal(hero.hp, 25.28125);
});

test('dash drain alone cannot fell the hero', () => {
  const hero = createHero(data, {});
  hero.hp = 1.05;
  const battle = createBattle(['mite'], data);
  for (let i = 0; i < 10; i++) stepBattle(battle, hero, { dash: true }, DT, data, steady);
  assert.equal(hero.hp, 1);
  assert.equal(battle.outcome, null);
});

test('blows vary with the dice inside the tuned spread', () => {
  const hero = createHero(data, {});
  hero.level = 24; // attack 51: 45.9 at the low end, just under 56.1 at the high end
  const low = createBattle(['brute'], data);
  const high = createBattle(['brute'], data);
  const lowHero = { ...hero, gear: { ...hero.gear }, hp: 1000 };
  const highHero = { ...hero, gear: { ...hero.gear }, hp: 1000 };
  while (low.foes[0].hp === 500) stepBattle(low, lowHero, {}, DT, data, () => 0);
  while (high.foes[0].hp === 500) stepBattle(high, highHero, {}, DT, data, () => 0.999999);
  assert.equal(500 - low.foes[0].hp, 46);
  assert.equal(500 - high.foes[0].hp, 56);
});
