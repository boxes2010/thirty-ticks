import test from 'node:test';
import assert from 'node:assert/strict';
import { data, stages } from '../src/data/index.js';
import { SLOTS } from '../src/core/hero.js';
import { createCampaign, openStages } from '../src/core/campaign.js';

const key = ([x, y]) => `${x},${y}`;
const tile = (stage, [x, y]) => data.terrain[stage.map[y]?.[x]];

function conditions(stage) {
  const lines = stage.towns.flatMap((t) => t.stalls.filter((s) => s.kind === 'talk').flatMap((s) => s.lines));
  return { lines, givers: [...stage.spots, ...lines], askers: [...stage.spots, ...lines, stage.tower] };
}

function reachable(stage) {
  const seen = new Set([key(stage.start)]);
  const queue = [stage.start];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const next of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (!tile(stage, next)?.pass || seen.has(key(next))) continue;
      seen.add(key(next));
      queue.push(next);
    }
  }
  return seen;
}

test('there is at least one stage, and a new campaign can start one', () => {
  assert.ok(stages.length > 0);
  assert.ok(openStages(createCampaign(), stages).length > 0);
});

test('stage ids are unique and prerequisites name real stages', () => {
  const ids = stages.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const stage of stages) for (const id of stage.after) assert.ok(ids.includes(id), `${stage.id} needs unknown stage ${id}`);
});

test('every item fits a slot the hero has and carries a price', () => {
  for (const [id, item] of Object.entries(data.items)) {
    assert.ok(SLOTS.includes(item.slot), `${id} has unknown slot ${item.slot}`);
    assert.ok(Number.isFinite(item.price) && item.price >= 0, `${id} has no price`);
  }
});

for (const stage of stages) {
  test(`${stage.id}: the map is a rectangle of known terrain`, () => {
    const width = stage.map[0].length;
    stage.map.forEach((row, y) => {
      assert.equal(row.length, width, `row ${y} is ${row.length} wide, expected ${width}`);
      for (const ch of row) assert.ok(data.terrain[ch], `row ${y} uses unknown terrain "${ch}"`);
    });
  });

  test(`${stage.id}: everything placed on the map stands on walkable ground the hero can reach`, () => {
    const seen = reachable(stage);
    const placed = [
      ['start', stage.start],
      ['tower', stage.tower.at],
      ...stage.towns.map((t) => [`town ${t.id}`, t.at]),
      ...stage.spots.map((s, i) => [`spot ${i}`, s.at]),
      ...stage.gates.map((g, i) => [`gate ${i}`, g.at]),
    ];
    for (const [name, where] of placed) {
      assert.ok(tile(stage, where)?.pass, `${name} at ${where} is not on walkable ground`);
      assert.ok(seen.has(key(where)), `${name} at ${where} cannot be reached from the start`);
    }
    assert.equal(new Set(placed.map(([, where]) => key(where))).size, placed.length, 'two things share a tile');
  });

  test(`${stage.id}: encounters and the boss use known units on terrain that is on the map`, () => {
    const used = new Set(stage.map.join(''));
    for (const [ch, zone] of Object.entries(stage.encounters)) {
      assert.ok(used.has(ch), `encounter zone "${ch}" is not on the map`);
      assert.ok(zone.steps[0] >= 1 && zone.steps[0] <= zone.steps[1], `zone "${ch}" has a bad step range`);
      assert.ok(zone.teams.length > 0);
      for (const team of zone.teams) {
        assert.ok(team.length > 0);
        for (const unit of team) assert.ok(data.units[unit], `unknown unit ${unit}`);
      }
    }
    assert.ok(stage.tower.boss.length > 0);
    for (const unit of stage.tower.boss) assert.ok(data.units[unit], `unknown boss unit ${unit}`);
  });

  test(`${stage.id}: shops stock known items and townsfolk always have something to say`, () => {
    for (const town of stage.towns) {
      for (const stall of town.stalls) {
        assert.ok(['rewind', 'eatery', 'shop', 'talk'].includes(stall.kind), `unknown stall ${stall.kind}`);
        if (stall.kind === 'shop') for (const id of stall.stock) assert.ok(data.items[id], `unknown item ${id}`);
        if (stall.kind === 'talk') {
          const last = stall.lines.at(-1);
          assert.ok(!last.needs?.length && !last.lacks?.length, `${stall.who} in ${town.id} can be left speechless`);
        }
      }
    }
  });

  test(`${stage.id}: every flag something waits for is set somewhere, and gifts are real items`, () => {
    const { givers, askers } = conditions(stage);
    const set = new Set(givers.flatMap((g) => g.sets ?? []));
    const wanted = [...askers.flatMap((a) => a.needs ?? []), ...stage.gates.map((g) => g.until)];
    for (const flag of wanted) assert.ok(set.has(flag), `nothing ever sets "${flag}"`);
    for (const giver of givers) if (giver.item) assert.ok(data.items[giver.item], `unknown gift ${giver.item}`);
  });

  test(`${stage.id}: par times get looser from gold to bronze`, () => {
    const [gold, silver, bronze] = stage.par;
    assert.equal(stage.par.length, 3);
    assert.ok(gold < silver && silver < bronze);
  });
}
