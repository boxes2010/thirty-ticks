const DIR_KEYS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

// pressed: reported once per key-down. held: true for as long as the key stays down.
const ACTION_KEYS = {
  Enter: { pressed: ['confirm'] },
  Space: { pressed: ['confirm'], held: 'dash' },
  KeyZ: { pressed: ['confirm'], held: 'dash' },
  KeyX: { pressed: ['back'], held: 'flee' },
  Backspace: { pressed: ['back'], held: 'flee' },
  Escape: { pressed: ['pause', 'back'] },
  KeyP: { pressed: ['pause'] },
  KeyM: { pressed: ['mute'] },
};

export function createInput(target) {
  const dirCodes = [];
  const down = new Set();
  const pressed = new Set();

  target.addEventListener('keydown', (e) => {
    const dir = DIR_KEYS[e.code];
    const action = ACTION_KEYS[e.code];
    if (!dir && !action) return;
    e.preventDefault();
    if (e.repeat) return;
    down.add(e.code);
    if (dir) {
      pressed.add(dir);
      if (!dirCodes.includes(e.code)) dirCodes.push(e.code);
    }
    for (const name of action?.pressed ?? []) pressed.add(name);
  });

  target.addEventListener('keyup', (e) => {
    down.delete(e.code);
    const i = dirCodes.indexOf(e.code);
    if (i !== -1) dirCodes.splice(i, 1);
  });

  target.addEventListener('blur', () => {
    down.clear();
    dirCodes.length = 0;
  });

  const holding = (name) => [...down].some((code) => ACTION_KEYS[code]?.held === name);

  return {
    // Hands over everything pressed since the last read; held state is live.
    read() {
      const out = { dir: DIR_KEYS[dirCodes.at(-1)] ?? null, dash: holding('dash'), flee: holding('flee'), pressed: new Set(pressed) };
      pressed.clear();
      return out;
    },
  };
}
