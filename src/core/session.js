import { createClock, tickClock, rewindPrice, rewind } from './clock.js';
import { createHero, heroStats, gainExp, equip } from './hero.js';
import { createBattle, stepBattle } from './battle.js';

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const MEDALS = ['gold', 'silver', 'bronze'];

export function createSession({ stage, data, gear, rng }) {
  const hero = createHero(data, gear);
  hero.gold = stage.purse;
  return {
    stage,
    data,
    rng,
    mode: 'field',
    hero,
    clock: createClock(data),
    pos: { x: stage.start[0], y: stage.start[1] },
    move: null,
    spare: 0,
    facing: 'down',
    flags: new Set(),
    untilFight: null,
    town: null,
    lastTown: null,
    battle: null,
    boss: false,
    notice: null,
    result: null,
  };
}

export function update(s, dt, input) {
  if (s.notice && (s.notice.ttl -= dt) <= 0) s.notice = null;
  if (s.mode === 'field') updateField(s, dt, input);
  else if (s.mode === 'battle') updateBattle(s, dt, input);
}

const at = (thing, x, y) => thing.at[0] === x && thing.at[1] === y;

function holds(s, cond) {
  return (cond.needs ?? []).every((f) => s.flags.has(f)) && !(cond.lacks ?? []).some((f) => s.flags.has(f));
}

function applyEffects(s, effect) {
  for (const flag of effect.sets ?? []) s.flags.add(flag);
  if (effect.gold) s.hero.gold += effect.gold;
  if (effect.item) equip(s.hero, effect.item, s.data);
}

function say(s, text) {
  s.notice = { text, ttl: s.data.balance.field.noticeSeconds };
}

function tileAt(s, x, y) {
  return s.data.terrain[s.stage.map[y]?.[x]];
}

function unwind(s) {
  s.mode = 'unwound';
  s.move = null;
  s.battle = null;
}

function updateField(s, dt, input) {
  if (tickClock(s.clock, dt)) return unwind(s);
  let time = dt;
  if (!s.move) {
    if (input.confirm && enterSite(s)) return;
    if (!input.dir || !startMove(s, input.dir)) {
      s.spare = 0;
      return;
    }
    time += s.spare;
  }
  s.spare = 0;
  s.move.t += time * s.move.pace;
  if (s.move.t < 1) return;
  const spare = (s.move.t - 1) / s.move.pace;
  arrive(s);
  if (s.mode === 'field') s.spare = spare;
}

function startMove(s, dir) {
  s.facing = dir;
  const x = s.pos.x + DIRS[dir][0];
  const y = s.pos.y + DIRS[dir][1];
  const tile = tileAt(s, x, y);
  if (!tile?.pass) return false;
  const gate = s.stage.gates.find((g) => at(g, x, y) && !s.flags.has(g.until));
  if (gate) {
    say(s, gate.hint);
    return false;
  }
  s.move = { from: { ...s.pos }, to: { x, y }, t: 0, pace: heroStats(s.hero, s.data).pace * tile.pace };
  return true;
}

function arrive(s) {
  s.pos = s.move.to;
  s.move = null;
  if (enterSite(s) || at(s.stage.tower, s.pos.x, s.pos.y)) return;
  const spot = s.stage.spots.find((sp) => at(sp, s.pos.x, s.pos.y) && holds(s, sp));
  if (spot) {
    applyEffects(s, spot);
    say(s, spot.text);
    return;
  }
  rollEncounter(s);
}

function enterSite(s) {
  const town = s.stage.towns.find((t) => at(t, s.pos.x, s.pos.y));
  if (town) {
    s.mode = 'town';
    s.town = town;
    s.lastTown = town;
    return true;
  }
  const tower = s.stage.tower;
  if (!at(tower, s.pos.x, s.pos.y)) return false;
  if (!holds(s, tower)) {
    say(s, tower.hint);
    return false;
  }
  startBattle(s, tower.boss, true);
  return true;
}

function rollEncounter(s) {
  const zone = s.stage.encounters[s.stage.map[s.pos.y][s.pos.x]];
  if (!zone) return;
  if (s.untilFight === null) {
    const [min, max] = zone.steps;
    s.untilFight = min + Math.floor(s.rng() * (max - min + 1));
  }
  s.untilFight -= 1;
  if (s.untilFight > 0) return;
  s.untilFight = null;
  startBattle(s, zone.teams[Math.floor(s.rng() * zone.teams.length)], false);
}

function startBattle(s, team, boss) {
  s.battle = createBattle(team, s.data);
  s.boss = boss;
  s.mode = 'battle';
}

function updateBattle(s, dt, input) {
  if (tickClock(s.clock, dt)) return unwind(s);
  stepBattle(s.battle, s.hero, input, dt, s.data, s.rng);
  const { outcome, exp, gold } = s.battle;
  if (!outcome) return;
  s.battle = null;
  s.mode = 'field';
  s.hero.gold += gold;
  const levels = gainExp(s.hero, exp, s.data);
  if (exp || gold) say(s, `+${exp} exp  +${gold} gold${levels ? `  Level ${s.hero.level}!` : ''}`);

  if (outcome === 'won' && s.boss) {
    s.mode = 'cleared';
    s.result = {
      elapsed: s.clock.elapsed,
      rewinds: s.clock.rewinds,
      level: s.hero.level,
      medal: MEDALS[s.stage.par.findIndex((limit) => s.clock.elapsed <= limit)] ?? 'none',
    };
  } else if (outcome === 'down') {
    const { downPenalty, downHeal } = s.data.balance.field;
    const [x, y] = s.lastTown ? s.lastTown.at : s.stage.start;
    s.pos = { x, y };
    s.hero.hp = Math.ceil(heroStats(s.hero, s.data).maxHp * downHeal);
    say(s, 'Knocked out! Dragged back to safety.');
    if (tickClock(s.clock, downPenalty)) unwind(s);
  }
}

export function townMenu(s) {
  const { hero, data } = s;
  const menu = [];
  for (const stall of s.town.stalls) {
    if (stall.kind === 'rewind') {
      const price = rewindPrice(s.clock, data);
      menu.push({ kind: 'rewind', label: `${stall.who}: wind the clock back`, price, enabled: hero.gold >= price });
    } else if (stall.kind === 'eatery') {
      const hurt = hero.hp < heroStats(hero, data).maxHp;
      menu.push({ kind: 'eatery', label: `${stall.name}: restore health`, price: stall.price, enabled: hurt && hero.gold >= stall.price });
    } else if (stall.kind === 'shop') {
      for (const id of stall.stock) {
        const item = data.items[id];
        menu.push({ kind: 'buy', item: id, label: `Buy ${item.name}`, price: item.price, enabled: hero.gear[item.slot] !== id && hero.gold >= item.price });
      }
    } else if (stall.kind === 'talk') {
      menu.push({ kind: 'talk', label: `Talk to the ${stall.who}`, stall, enabled: true });
    }
  }
  menu.push({ kind: 'leave', label: 'Leave', enabled: true });
  return menu;
}

export function townAct(s, index) {
  const entry = townMenu(s)[index];
  if (!entry.enabled) return { ok: false, text: 'Not right now.' };
  if (entry.kind === 'rewind') {
    rewind(s.clock, s.hero, s.data);
    return { ok: true, text: 'The hands spin back. A full clock again.' };
  }
  if (entry.kind === 'eatery') {
    s.hero.gold -= entry.price;
    s.hero.hp = heroStats(s.hero, s.data).maxHp;
    return { ok: true, text: 'Good as new.' };
  }
  if (entry.kind === 'buy') {
    s.hero.gold -= entry.price;
    equip(s.hero, entry.item, s.data);
    return { ok: true, text: `${s.data.items[entry.item].name} equipped.` };
  }
  if (entry.kind === 'talk') {
    const line = entry.stall.lines.find((l) => holds(s, l));
    applyEffects(s, line);
    return { ok: true, text: line.text };
  }
  leaveTown(s);
  return { ok: true, text: '' };
}

export function leaveTown(s) {
  s.mode = 'field';
  s.town = null;
}
