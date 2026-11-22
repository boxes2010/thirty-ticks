import { heroStats } from './hero.js';

export function createBattle(team, data) {
  const { laneStart, foeStart, foeGap } = data.balance.battle;
  return {
    heroX: laneStart,
    foes: team.map((unit, i) => ({ unit, hp: data.units[unit].hp, x: foeStart + i * foeGap })),
    outcome: null,
    exp: 0,
    gold: 0,
    events: [],
  };
}

function blow(atk, def, variance, rng) {
  return Math.max(1, Math.round(atk * (1 + (rng() * 2 - 1) * variance)) - def);
}

export function stepBattle(battle, hero, input, dt, data, rng) {
  if (battle.outcome) return;
  const knobs = data.balance.battle;
  const stats = heroStats(hero, data);

  if (input.flee) {
    battle.heroX -= knobs.fleeSpeed * dt;
    if (battle.heroX <= 0) battle.outcome = 'fled';
    return;
  }

  battle.heroX += knobs.heroSpeed * (input.dash ? knobs.dashFactor : 1) * dt;
  if (input.dash) hero.hp = Math.max(1, hero.hp - knobs.dashDrain * stats.maxHp * dt);

  const foe = battle.foes.find((f) => f.hp > 0);
  const unit = data.units[foe.unit];
  foe.x -= unit.speed * dt;
  if (foe.x - battle.heroX > knobs.reach) return;

  const dealt = blow(stats.atk, unit.def, knobs.variance, rng);
  const taken = blow(unit.atk, stats.def, knobs.variance, rng);
  foe.hp = Math.max(0, foe.hp - dealt);
  hero.hp = Math.max(0, hero.hp - taken);
  battle.heroX = Math.max(0, battle.heroX - knobs.knockHero);
  foe.x += knobs.knockFoe;
  battle.events.push({ dealt, taken, felled: foe.hp === 0 });

  if (foe.hp === 0) {
    battle.exp += unit.exp;
    battle.gold += unit.gold;
  }
  if (hero.hp === 0) battle.outcome = 'down';
  else if (battle.foes.every((f) => f.hp === 0)) battle.outcome = 'won';
}
