import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, openStages, recordClear, toSave, fromSave } from '../src/core/campaign.js';
import { createRng } from '../src/core/rng.js';

const stages = [
  { id: 'a', after: [] },
  { id: 'b', after: ['a'] },
  { id: 'c', after: ['a'] },
  { id: 'd', after: ['b', 'c'] },
];
const run = (elapsed, medal = 'silver') => ({ elapsed, rewinds: 1, level: 5, medal });

test('only stages whose prerequisites are all cleared are open', () => {
  const campaign = createCampaign();
  assert.deepEqual(openStages(campaign, stages), ['a']);
  recordClear(campaign, 'a', run(20), {});
  assert.deepEqual(openStages(campaign, stages), ['a', 'b', 'c']);
  recordClear(campaign, 'b', run(20), {});
  assert.deepEqual(openStages(campaign, stages), ['a', 'b', 'c']);
  recordClear(campaign, 'c', run(20), {});
  assert.deepEqual(openStages(campaign, stages), ['a', 'b', 'c', 'd']);
});

test('a slower repeat never replaces the best run', () => {
  const campaign = createCampaign();
  recordClear(campaign, 'a', run(25, 'silver'), {});
  recordClear(campaign, 'a', run(31, 'bronze'), {});
  assert.deepEqual(campaign.cleared.a, { elapsed: 25, rewinds: 1, level: 5, medal: 'silver' });
  recordClear(campaign, 'a', run(19, 'gold'), {});
  assert.deepEqual(campaign.cleared.a, { elapsed: 19, rewinds: 1, level: 5, medal: 'gold' });
});

test('gear carried out of a cleared stage becomes the starting gear', () => {
  const campaign = createCampaign();
  const worn = { tool: 'spanner', coat: null, boots: null, charm: null };
  recordClear(campaign, 'a', run(20), worn);
  worn.tool = 'changed later';
  assert.deepEqual(campaign.gear, { tool: 'spanner', coat: null, boots: null, charm: null });
});

test('a campaign survives a save round trip', () => {
  const campaign = createCampaign();
  recordClear(campaign, 'a', run(20, 'gold'), { tool: 'spanner' });
  const loaded = fromSave(toSave(campaign));
  assert.deepEqual(loaded, campaign);
  assert.deepEqual(openStages(loaded, stages), ['a', 'b', 'c']);
});

for (const [label, text] of [
  ['nothing saved yet', null],
  ['unreadable text', '{not json'],
  ['the wrong shape', '{"cleared":[1,2],"gear":"x"}'],
  ['a bare value', '42'],
]) {
  test(`loading ${label} starts a fresh campaign`, () => {
    assert.deepEqual(fromSave(text), createCampaign());
  });
}

test('the same seed always rolls the same dice, inside [0, 1)', () => {
  const a = createRng(7);
  const b = createRng(7);
  const rolls = Array.from({ length: 200 }, () => a());
  assert.deepEqual(rolls, Array.from({ length: 200 }, () => b()));
  assert.ok(rolls.every((r) => r >= 0 && r < 1));
  assert.ok(new Set(rolls).size > 190);
});

test('different seeds roll different dice', () => {
  const a = createRng(1);
  const b = createRng(2);
  assert.notDeepEqual([a(), a(), a()], [b(), b(), b()]);
});
