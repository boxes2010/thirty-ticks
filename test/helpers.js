import assert from 'node:assert/strict';
import { createSession, update, townMenu, townAct } from '../src/core/session.js';

// 1/64 is exact in binary, so tile and battle timings in the tests are exact.
export const DT = 1 / 64;
export const steady = () => 0.5;

export const data = {
  balance: {
    clock: { seconds: 30, rewindBase: 40, rewindGrowth: 1.5 },
    hero: { hp: 30, atk: 5, def: 2, pace: 4, hpPerLevel: 6, atkPerLevel: 2, defPerLevel: 1, expBase: 4, expStep: 3 },
    battle: {
      laneStart: 60, foeStart: 300, foeGap: 70, reach: 24,
      heroSpeed: 240, dashFactor: 2, dashDrain: 0.2, fleeSpeed: 320,
      knockHero: 40, knockFoe: 20, variance: 0.1,
    },
    field: { downPenalty: 3, downHeal: 0.5, noticeSeconds: 3 },
  },
  terrain: {
    '=': { pass: true, pace: 1 },
    '.': { pass: true, pace: 1 },
    f: { pass: true, pace: 0.5 },
    '~': { pass: false },
  },
  items: {
    spanner: { name: 'Spanner', slot: 'tool', atk: 3, price: 40 },
    apron: { name: 'Apron', slot: 'coat', def: 2, hp: 10, price: 30 },
  },
  units: {
    mite: { name: 'Mite', hp: 8, atk: 4, def: 0, speed: 0, exp: 2, gold: 6 },
    brute: { name: 'Brute', hp: 500, atk: 22, def: 0, speed: 0, exp: 50, gold: 50 },
    boss: { name: 'Boss', hp: 10, atk: 4, def: 0, speed: 0, exp: 0, gold: 0 },
  },
};

export function makeStage(overrides = {}) {
  return {
    id: 'test',
    name: 'Test',
    purse: 50,
    par: [10, 20, 30],
    map: [
      '=====',
      '.~.f.',
      '.....',
    ],
    start: [0, 0],
    encounters: {},
    towns: [{
      id: 'inn',
      name: 'Inn',
      at: [2, 0],
      stalls: [
        { kind: 'rewind', who: 'Broker' },
        { kind: 'eatery', name: 'Stew', price: 10 },
        { kind: 'shop', stock: ['spanner', 'apron'] },
        {
          kind: 'talk',
          who: 'Smith',
          lines: [
            { needs: ['found'], lacks: ['thanked'], sets: ['thanked', 'gate_open'], gold: 5, text: 'You found it! The gate is open.' },
            { needs: ['thanked'], text: 'Safe travels.' },
            { text: 'I lost my coins in the south field.' },
          ],
        },
      ],
    }],
    gates: [{ at: [3, 0], until: 'gate_open', hint: 'Locked.' }],
    spots: [{ at: [0, 2], lacks: ['found'], sets: ['found'], gold: 25, text: 'Found coins.' }],
    tower: { at: [4, 0], name: 'Tower', boss: ['boss'], needs: [], hint: 'Sealed.' },
    ...overrides,
  };
}

export function start(overrides = {}, { gear = {}, rng = steady } = {}) {
  return createSession({ stage: makeStage(overrides), data, gear, rng });
}

// Hold a direction until the hero stops on a tile, is blocked, or leaves the field.
export function walk(session, ...dirs) {
  for (const dir of dirs) {
    let n = 0;
    do {
      update(session, DT, { dir });
      assert.ok(++n < 10000, 'walk never finished');
    } while (session.mode === 'field' && session.move);
  }
}

export function fight(session, input = {}) {
  let steps = 0;
  while (session.mode === 'battle') {
    update(session, DT, input);
    assert.ok(++steps < 100000, 'battle never ended');
  }
  return steps;
}

export function menuEntry(session, kind, item) {
  const menu = townMenu(session);
  const index = menu.findIndex((e) => e.kind === kind && (item === undefined || e.item === item));
  assert.notEqual(index, -1, `no ${kind} ${item ?? ''} in the town menu`);
  return { index, entry: menu[index] };
}

export function act(session, kind, item) {
  return townAct(session, menuEntry(session, kind, item).index);
}
