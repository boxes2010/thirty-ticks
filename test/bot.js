// A competent, cautious player: follows quest flags, levels on the richest ground it can
// survive, shops and rewinds in town, and climbs the tower once the boss looks beatable.
import { createSession, update, townMenu, townAct } from '../src/core/session.js';
import { heroStats } from '../src/core/hero.js';
import { rewindPrice } from '../src/core/clock.js';
import { createRng } from '../src/core/rng.js';

const DT = 1 / 60;
const STEPS = [['right', 1, 0], ['left', -1, 0], ['down', 0, 1], ['up', 0, -1]];
const key = (x, y) => `${x},${y}`;
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

function blocked(s, x, y, goal) {
  const stage = s.stage;
  if (!s.data.terrain[stage.map[y]?.[x]]?.pass) return true;
  if (stage.gates.some((g) => same(g.at, [x, y]) && !s.flags.has(g.until))) return true;
  if (goal && same(goal, [x, y])) return false;
  return same(stage.tower.at, [x, y]) || stage.towns.some((t) => same(t.at, [x, y]));
}

// Breadth-first search from the hero. Stops at `goal`, or at the first tile `wanted` accepts.
// Returns the list of directions to get there, or null when nothing is reachable.
function route(s, goal, wanted) {
  const from = [s.pos.x, s.pos.y];
  const prev = new Map([[key(...from), null]]);
  const queue = [from];
  while (queue.length) {
    const [x, y] = queue.shift();
    const here = prev.get(key(x, y));
    if (goal ? same([x, y], goal) : here && wanted(x, y)) {
      const dirs = [];
      for (let k = key(x, y); prev.get(k); k = prev.get(k).from) dirs.unshift(prev.get(k).dir);
      return dirs;
    }
    for (const [dir, dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (prev.has(key(nx, ny)) || blocked(s, nx, ny, goal)) continue;
      prev.set(key(nx, ny), { from: key(x, y), dir });
      queue.push([nx, ny]);
    }
  }
  return null;
}

// Worst-case result of fighting a team: health lost and clashes needed.
function forecast(s, team) {
  const stats = heroStats(s.hero, s.data);
  const spread = 1 + s.data.balance.battle.variance;
  let lost = 0;
  let clashes = 0;
  for (const id of team) {
    const unit = s.data.units[id];
    const n = Math.ceil(unit.hp / Math.max(1, Math.floor(stats.atk / spread) - unit.def));
    clashes += n;
    lost += n * Math.max(1, Math.ceil(unit.atk * spread) - stats.def);
  }
  return { lost, clashes };
}

function nearestTown(s, want) {
  let best = null;
  for (const town of s.stage.towns) {
    const stall = town.stalls.find((st) => st.kind === want);
    if (!stall) continue;
    const path = route(s, town.at);
    if (path && (!best || path.length < best.path.length)) best = { town, path, stall };
  }
  return best;
}

// What has to happen next for a missing flag to get set: visit a spot, or talk in a town.
function questStep(s, flag, depth = 0) {
  if (depth > 8) return null;
  const sources = [
    ...s.stage.spots.map((spot) => ({ cond: spot, goal: spot.at })),
    ...s.stage.towns.flatMap((town) => town.stalls
      .filter((st) => st.kind === 'talk')
      .flatMap((st) => st.lines.map((line) => ({ cond: line, goal: town.at })))),
  ].filter((src) => (src.cond.sets ?? []).includes(flag));
  for (const src of sources) {
    const missing = (src.cond.needs ?? []).find((f) => !s.flags.has(f));
    if (missing) {
      const step = questStep(s, missing, depth + 1);
      if (step) return step;
    } else if (route(s, src.goal)) {
      return src;
    }
  }
  return null;
}

function nextQuest(s) {
  const waiting = [...(s.stage.tower.needs ?? []), ...s.stage.gates.map((g) => g.until)].filter((f) => !s.flags.has(f));
  for (const flag of waiting) {
    const step = questStep(s, flag);
    if (step) return step;
  }
  return null;
}

// Wild terrain to level on: the richest whose every team the hero survives with health to
// spare. With `desperate`, settle for the least dangerous ground instead.
function huntingGround(s, desperate) {
  let best = null;
  for (const [ch, zone] of Object.entries(s.stage.encounters)) {
    const worst = Math.max(...zone.teams.map((team) => forecast(s, team).lost));
    if (!desperate && worst >= s.hero.hp * 0.85) continue;
    const exp = zone.teams.reduce((sum, team) => sum + team.reduce((n, id) => n + s.data.units[id].exp, 0), 0) / zone.teams.length;
    const worth = desperate ? -worst : exp;
    if (!best || worth > best.worth) best = { ch, worth };
  }
  return best && route(s, null, (x, y) => s.stage.map[y][x] === best.ch);
}

function visitTown(s, log) {
  const note = (entry) => log.push(`${s.clock.elapsed.toFixed(1)}s ${entry.label}${entry.price ? ` (${entry.price}g)` : ''}`);
  const tryAct = (pick) => {
    const menu = townMenu(s);
    const index = menu.findIndex((e) => e.enabled && pick(e));
    if (index === -1) return false;
    note(menu[index]);
    townAct(s, index);
    return true;
  };
  for (let round = 0; round < 3; round++) {
    townMenu(s).forEach((e, i) => e.kind === 'talk' && townAct(s, i));
  }
  if (s.clock.left < 12) tryAct((e) => e.kind === 'rewind');
  if (s.hero.hp < heroStats(s.hero, s.data).maxHp * 0.7 || !huntingGround(s, false)) tryAct((e) => e.kind === 'eatery');
  const score = (it) => (it.atk ?? 0) * 3 + (it.def ?? 0) * 3 + (it.hp ?? 0) / 4 + (it.pace ?? 0) * 2;
  const upgrade = (e) => {
    if (e.kind !== 'buy') return false;
    const item = s.data.items[e.item];
    const worn = s.data.items[s.hero.gear[item.slot]] ?? {};
    const reserve = s.clock.left >= 20 ? 0 : rewindPrice(s.clock, s.data);
    return score(item) > score(worn) && s.hero.gold - e.price >= reserve;
  };
  while (tryAct(upgrade));
  townAct(s, townMenu(s).findIndex((e) => e.kind === 'leave'));
}

function plan(s) {
  const stats = heroStats(s.hero, s.data);
  const perTile = 1 / (stats.pace * 0.7);
  const canRewind = s.hero.gold >= rewindPrice(s.clock, s.data);
  const rewindAt = nearestTown(s, 'rewind');
  const toRewind = rewindAt && canRewind ? { goal: rewindAt.town.at, path: rewindAt.path, why: 'rewind' } : null;

  if (toRewind && s.clock.left < rewindAt.path.length * perTile + 4) return toRewind;

  const food = nearestTown(s, 'eatery');
  if (food && s.hero.hp < stats.maxHp * 0.4 && s.hero.gold >= food.stall.price) {
    return { goal: food.town.at, path: food.path, why: 'eat' };
  }

  const quest = nextQuest(s);
  if (quest) return { goal: quest.goal, path: route(s, quest.goal), why: 'quest' };

  const boss = forecast(s, s.stage.tower.boss);
  const climb = route(s, s.stage.tower.at);
  if (climb && boss.lost < s.hero.hp * 0.8) {
    if (s.clock.left > climb.length * perTile + 1.5 + boss.clashes * 0.3) return { goal: s.stage.tower.at, path: climb, why: 'tower' };
    if (toRewind) return toRewind;
  }

  const hunt = huntingGround(s, false);
  if (hunt) return { path: hunt, why: 'hunt' };
  if (food && s.hero.hp < stats.maxHp && s.hero.gold >= food.stall.price) return { goal: food.town.at, path: food.path, why: 'recover' };
  return { path: huntingGround(s, true), why: 'scrape by' };
}

export function playStage(stage, data, gear, seed, limitSeconds = 900) {
  const s = createSession({ stage, data, gear, rng: createRng(seed) });
  const log = [];
  let ticks = 0;
  while (s.mode !== 'cleared' && s.mode !== 'unwound' && ticks * DT < limitSeconds) {
    ticks += 1;
    if (s.mode === 'town') {
      visitTown(s, log);
    } else if (s.mode === 'battle') {
      const foe = s.battle.foes.find((f) => f.hp > 0);
      const hit = Math.ceil(data.units[foe.unit].atk * (1 + data.balance.battle.variance)) - heroStats(s.hero, data).def;
      update(s, DT, { flee: s.hero.hp <= Math.max(1, hit) });
    } else if (s.move) {
      update(s, DT, {});
    } else {
      const next = plan(s);
      if (next.goal && same(next.goal, [s.pos.x, s.pos.y])) update(s, DT, { confirm: true });
      else update(s, DT, { dir: next.path?.[0] });
    }
  }
  return { session: s, log };
}
