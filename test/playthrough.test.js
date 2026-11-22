import test from 'node:test';
import assert from 'node:assert/strict';
import { data, stages } from '../src/data/index.js';
import { createCampaign, openStages, recordClear } from '../src/core/campaign.js';
import { createSession, update } from '../src/core/session.js';
import { createRng } from '../src/core/rng.js';
import { playStage } from './bot.js';

for (const seed of [1, 2, 3, 4, 5, 6]) {
  test(`a careful player clears the whole campaign in order (dice seed ${seed})`, (t) => {
    const campaign = createCampaign();
    for (const stage of stages) {
      assert.ok(openStages(campaign, stages).includes(stage.id), `${stage.id} never opened`);
      const { session, log } = playStage(stage, data, campaign.gear, seed);
      const { clock, hero } = session;
      t.diagnostic(`${stage.id}: ${session.mode} after ${clock.elapsed.toFixed(1)}s, ${clock.rewinds} rewinds, level ${hero.level}, gear ${Object.values(hero.gear).filter(Boolean).join('+') || 'none'}`);
      assert.equal(session.mode, 'cleared', `${stage.id} ended ${session.mode} at level ${hero.level}:\n${log.join('\n')}`);
      recordClear(campaign, stage.id, session.result, hero.gear);
    }
  });
}

for (const stage of stages) {
  test(`${stage.id}: the boss cannot be beaten by a fresh level 1 hero`, () => {
    const s = createSession({ stage: { ...stage, start: stage.tower.at, tower: { ...stage.tower, needs: [] } }, data, gear: {}, rng: createRng(1) });
    update(s, 1 / 60, { confirm: true });
    assert.equal(s.mode, 'battle');
    while (s.mode === 'battle') update(s, 1 / 60, {});
    assert.notEqual(s.mode, 'cleared');
  });
}
