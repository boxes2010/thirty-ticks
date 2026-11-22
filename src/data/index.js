import { balance } from './balance.js';
import { terrain } from './terrain.js';
import { units } from './units.js';
import { items } from './items.js';
import lowfield from './stages/lowfield.js';
import slackBridge from './stages/slack-bridge.js';
import sootHollow from './stages/soot-hollow.js';

export const data = { balance, terrain, units, items };
export const stages = [lowfield, slackBridge, sootHollow];
