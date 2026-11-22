const STALL_STEPS = 8;

// Turns uneven frame times into fixed simulation steps.
export function createStepper(step, onStep) {
  let owed = 0;
  let pending = new Set();
  return (elapsed, input) => {
    owed += elapsed > step * STALL_STEPS ? step : elapsed;
    for (const name of input.pressed) pending.add(name);
    while (owed >= step) {
      onStep(step, { ...input, pressed: pending });
      pending = new Set();
      owed -= step;
    }
  };
}
