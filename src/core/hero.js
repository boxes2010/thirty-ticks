export const SLOTS = ['tool', 'coat', 'boots', 'charm'];

export function createHero(data, gear) {
  const hero = { level: 1, exp: 0, gold: 0, hp: 0, gear: {} };
  for (const slot of SLOTS) hero.gear[slot] = gear[slot] ?? null;
  hero.hp = heroStats(hero, data).maxHp;
  return hero;
}

export function heroStats(hero, data) {
  const base = data.balance.hero;
  const up = hero.level - 1;
  const stats = {
    maxHp: base.hp + base.hpPerLevel * up,
    atk: base.atk + base.atkPerLevel * up,
    def: base.def + base.defPerLevel * up,
    pace: base.pace,
  };
  for (const slot of SLOTS) {
    const item = data.items[hero.gear[slot]];
    if (!item) continue;
    stats.maxHp += item.hp ?? 0;
    stats.atk += item.atk ?? 0;
    stats.def += item.def ?? 0;
    stats.pace += item.pace ?? 0;
  }
  return stats;
}

export function expToNext(level, data) {
  const { expBase, expStep } = data.balance.hero;
  return expBase + expStep * (level - 1);
}

export function gainExp(hero, amount, data) {
  let gained = 0;
  hero.exp += amount;
  while (hero.exp >= expToNext(hero.level, data)) {
    hero.exp -= expToNext(hero.level, data);
    hero.level += 1;
    hero.hp += data.balance.hero.hpPerLevel;
    gained += 1;
  }
  return gained;
}

export function equip(hero, itemId, data) {
  const before = heroStats(hero, data).maxHp;
  hero.gear[data.items[itemId].slot] = itemId;
  const after = heroStats(hero, data).maxHp;
  hero.hp = Math.min(after, hero.hp + Math.max(0, after - before));
}
