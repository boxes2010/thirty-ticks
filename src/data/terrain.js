export const terrain = {
  '.': { name: 'meadow', pass: true, pace: 1 },
  ',': { name: 'scrub', pass: true, pace: 1 },
  f: { name: 'thicket', pass: true, pace: 0.7 },
  '=': { name: 'road', pass: true, pace: 1.25 },
  '#': { name: 'bridge', pass: true, pace: 1.25 },
  '~': { name: 'water', pass: false },
  '^': { name: 'crag', pass: false },
};
