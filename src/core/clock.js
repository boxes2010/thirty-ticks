export function createClock(data) {
  return { left: data.balance.clock.seconds, elapsed: 0, rewinds: 0 };
}

export function tickClock(clock, dt) {
  const used = Math.min(dt, clock.left);
  clock.left -= used;
  clock.elapsed += used;
  return clock.left <= 0;
}

export function rewindPrice(clock, data) {
  const { rewindBase, rewindGrowth } = data.balance.clock;
  return Math.round(rewindBase * rewindGrowth ** clock.rewinds);
}

export function rewind(clock, purse, data) {
  const price = rewindPrice(clock, data);
  if (purse.gold < price) return false;
  purse.gold -= price;
  clock.left = data.balance.clock.seconds;
  clock.rewinds += 1;
  return true;
}
