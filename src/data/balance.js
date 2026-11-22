export const balance = {
  clock: { seconds: 30, rewindBase: 30, rewindGrowth: 1.7 },
  hero: {
    hp: 28, atk: 5, def: 1, pace: 5.5,
    hpPerLevel: 5, atkPerLevel: 2, defPerLevel: 1,
    expBase: 3, expStep: 2,
  },
  battle: {
    laneStart: 70, foeStart: 330, foeGap: 80, reach: 26,
    heroSpeed: 300, dashFactor: 2, dashDrain: 0.18, fleeSpeed: 420,
    knockHero: 44, knockFoe: 22, variance: 0.12,
  },
  field: { downPenalty: 3, downHeal: 0.5, noticeSeconds: 2.5 },
};
