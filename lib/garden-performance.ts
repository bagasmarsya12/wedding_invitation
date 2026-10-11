type Deadline = { didTimeout: boolean; timeRemaining(): number };
type IdleSchedule = (callback: (deadline: Deadline) => void, timeout: number) => () => void;

/** One pending slot survives scroll events; work chooses the current room when it runs. */
export function createGardenPreparation(schedule: IdleSchedule, prepare: () => boolean, now = () => performance.now()) {
  let cancelPending: (() => void) | null = null;
  let generation = 0;
  let requestedAt: number | null = null;
  function request() {
    if (cancelPending) return;
    requestedAt ??= now();
    const ticket = generation;
    cancelPending = schedule(deadline => {
      if (ticket !== generation) return;
      cancelPending = null;
      if (!deadline.didTimeout && deadline.timeRemaining() < 4 && now() - requestedAt! < 1200) { request(); return; }
      requestedAt = null;
      if (prepare()) request();
    }, Math.max(1, 1200 - (now() - requestedAt)));
  }
  return {
    request,
    cancel() { generation++; cancelPending?.(); cancelPending = null; requestedAt = null; },
  };
}

/** Cap only the animated background. DOM typography, art and exports stay full resolution. */
export function gardenPixelRatio(width: number, height: number, deviceRatio: number, mobile: boolean) {
  const budget = mobile ? 750_000 : 2_000_000;
  return Math.min(deviceRatio || 1, mobile ? 1.25 : 1.5, Math.sqrt(budget / Math.max(1, width * height)));
}

export function gardenFrameDue(now: number, last: number, cadence: number) {
  // A small tolerance prevents floating-point timing from dropping alternate 60 Hz frames.
  return now - last >= cadence - .5;
}
