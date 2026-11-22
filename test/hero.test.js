import test from 'node:test';
import assert from 'node:assert/strict';
import { createHero, heroStats, gainExp, equip } from '../src/core/hero.js';

const data = {
  balance: {
    hero: { hp: 30, atk: 5, def: 2, pace: 5, hpPerLevel: 6, atkPerLevel: 2, defPerLevel: 1, expBase: 4, expStep: 3 },
  },
  items: {
    spanner: { name: 'Spanner', slot: 'tool', atk: 3 },
    apron: { name: 'Apron', slot: 'coat', def: 2, hp: 10 },
    rag: { name: 'Rag', slot: 'coat', def: 1 },
    clogs: { name: 'Clogs', slot: 'boots', pace: 1 },
  },
};

test('a new hero starts at level 1 with full health', () => {
  const hero = createHero(data, {});
  assert.equal(hero.level, 1);
  assert.equal(hero.exp, 0);
  assert.equal(hero.hp, 30);
});

test('gear adds to the base stats', () => {
  const hero = createHero(data, { tool: 'spanner', coat: 'apron', boots: 'clogs' });
  assert.deepEqual(heroStats(hero, data), { maxHp: 40, atk: 8, def: 4, pace: 6 });
  assert.equal(hero.hp, 40);
});

test('enough experience raises the level and carries the remainder', () => {
  const hero = createHero(data, {});
  const gained = gainExp(hero, 5, data);
  assert.equal(gained, 1);
  assert.equal(hero.level, 2);
  assert.equal(hero.exp, 1);
});

test('one large reward can raise several levels, each needing more than the last', () => {
  const hero = createHero(data, {});
  const gained = gainExp(hero, 12, data);
  assert.equal(gained, 2);
  assert.equal(hero.level, 3);
  assert.equal(hero.exp, 1);
});

test('levelling up raises stats and heals by the health gained', () => {
  const hero = createHero(data, {});
  hero.hp = 10;
  gainExp(hero, 4, data);
  assert.deepEqual(heroStats(hero, data), { maxHp: 36, atk: 7, def: 3, pace: 5 });
  assert.equal(hero.hp, 16);
});

test('equipping sturdier gear adds the extra health', () => {
  const hero = createHero(data, {});
  hero.hp = 12;
  equip(hero, 'apron', data);
  assert.equal(hero.gear.coat, 'apron');
  assert.equal(hero.hp, 22);
});

test('swapping to flimsier gear never leaves health above the new maximum', () => {
  const hero = createHero(data, { coat: 'apron' });
  equip(hero, 'rag', data);
  assert.equal(hero.gear.coat, 'rag');
  assert.equal(hero.hp, 30);
});
