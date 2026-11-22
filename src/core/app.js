import { fromSave, toSave, openStages, recordClear } from './campaign.js';
import { createSession, update, townMenu, townAct, leaveTown } from './session.js';
import { createRng } from './rng.js';

export const SAVE_KEY = 'thirty-ticks/save/v1';
export const PAUSE_MENU = ['Resume', 'Give up on this district'];

export function createApp({ data, stages, storage, seed }) {
  return {
    data,
    stages,
    storage,
    rng: createRng(seed),
    campaign: fromSave(storage.getItem(SAVE_KEY)),
    screen: 'title',
    pick: 0,
    session: null,
    cursor: 0,
    said: '',
    paused: false,
    pauseCursor: 0,
    events: [],
    time: 0,
  };
}

export function appUpdate(app, dt, input) {
  app.time += dt;
  SCREENS[app.screen](app, dt, input);
}

const cue = (app, type, detail) => app.events.push({ type, ...detail });

function openMap(app) {
  const open = openStages(app.campaign, app.stages);
  const fresh = app.stages.findIndex((st) => open.includes(st.id) && !(st.id in app.campaign.cleared));
  app.pick = fresh !== -1 ? fresh : app.stages.findIndex((st) => st.id === open.at(-1));
  app.screen = 'map';
  app.session = null;
  app.paused = false;
}

function startStage(app) {
  app.session = createSession({ stage: app.stages[app.pick], data: app.data, gear: app.campaign.gear, rng: app.rng });
  app.screen = 'intro';
  app.paused = false;
  app.cursor = 0;
  app.said = '';
}

function title(app, dt, { pressed }) {
  if (pressed.has('confirm')) openMap(app);
}

function map(app, dt, { pressed }) {
  const step = pressed.has('right') ? 1 : pressed.has('left') ? -1 : 0;
  if (step) {
    const open = openStages(app.campaign, app.stages);
    let i = app.pick + step;
    while (app.stages[i] && !open.includes(app.stages[i].id)) i += step;
    if (app.stages[i]) {
      app.pick = i;
      cue(app, 'cursor');
    }
  }
  if (pressed.has('confirm')) startStage(app);
  else if (pressed.has('back')) app.screen = 'title';
}

function intro(app, dt, { pressed }) {
  if (pressed.has('confirm')) {
    app.screen = 'stage';
    cue(app, 'start');
  } else if (pressed.has('back')) {
    openMap(app);
  }
}

function pauseMenu(app, pressed) {
  if (pressed.has('up') || pressed.has('down')) {
    app.pauseCursor = 1 - app.pauseCursor;
    cue(app, 'cursor');
  }
  if (pressed.has('pause') || pressed.has('back')) app.paused = false;
  else if (pressed.has('confirm')) {
    if (app.pauseCursor === 0) app.paused = false;
    else openMap(app);
  }
}

function town(app, pressed) {
  const s = app.session;
  const menu = townMenu(s);
  const step = pressed.has('down') ? 1 : pressed.has('up') ? -1 : 0;
  if (step) {
    app.cursor = (app.cursor + step + menu.length) % menu.length;
    cue(app, 'cursor');
  }
  if (pressed.has('back')) {
    leaveTown(s);
    cue(app, 'leave');
  } else if (pressed.has('confirm')) {
    const result = townAct(s, app.cursor);
    app.said = result.text;
    cue(app, result.ok ? menu[app.cursor].kind : 'deny');
  }
}

function stage(app, dt, input) {
  const s = app.session;
  const { pressed } = input;
  if (app.paused) return pauseMenu(app, pressed);
  if (s.mode === 'town') return town(app, pressed);
  if (pressed.has('pause')) {
    app.paused = true;
    app.pauseCursor = 0;
    return;
  }

  const before = { ticks: Math.ceil(s.clock.left), level: s.hero.level, battle: s.battle };
  update(s, dt, { dir: input.dir, dash: input.dash, flee: input.flee, confirm: pressed.has('confirm') });

  if (Math.ceil(s.clock.left) < before.ticks) cue(app, 'tick', { left: Math.ceil(s.clock.left) });
  if (before.battle) {
    for (const clash of before.battle.events.splice(0)) cue(app, 'clash', clash);
    const { outcome, gold } = before.battle;
    if (outcome === 'down') cue(app, 'down');
    else if (outcome === 'fled') cue(app, 'flee');
    if (outcome && outcome !== 'down' && gold > 0) cue(app, 'coin');
  } else if (s.battle) {
    cue(app, 'fight', { boss: s.boss });
  }
  if (s.hero.level > before.level) cue(app, 'level');

  if (s.mode === 'town') {
    app.cursor = 0;
    app.said = '';
    cue(app, 'enter');
  } else if (s.mode === 'cleared') {
    recordClear(app.campaign, s.stage.id, s.result, s.hero.gear);
    app.storage.setItem(SAVE_KEY, toSave(app.campaign));
    app.screen = 'cleared';
    cue(app, 'cleared');
  } else if (s.mode === 'unwound') {
    app.screen = 'unwound';
    cue(app, 'unwound');
  }
}

function cleared(app, dt, { pressed }) {
  if (pressed.has('confirm')) openMap(app);
}

function unwound(app, dt, { pressed }) {
  if (pressed.has('confirm')) startStage(app);
  else if (pressed.has('back')) openMap(app);
}

const SCREENS = { title, map, intro, stage, cleared, unwound };
