export function createCampaign() {
  return { cleared: {}, gear: {} };
}

export function openStages(campaign, stages) {
  return stages.filter((st) => st.after.every((id) => id in campaign.cleared)).map((st) => st.id);
}

export function recordClear(campaign, stageId, result, gear) {
  const best = campaign.cleared[stageId];
  if (!best || result.elapsed < best.elapsed) campaign.cleared[stageId] = { ...result };
  campaign.gear = { ...gear };
}

export function toSave(campaign) {
  return JSON.stringify(campaign);
}

const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

export function fromSave(text) {
  try {
    const saved = JSON.parse(text);
    if (isRecord(saved) && isRecord(saved.cleared) && isRecord(saved.gear)) {
      return { cleared: saved.cleared, gear: saved.gear };
    }
  } catch {
    // unreadable save: start over
  }
  return createCampaign();
}
