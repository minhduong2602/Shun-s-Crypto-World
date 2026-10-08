export function createSingleFlightPoller(refresh: () => Promise<void>, intervalMs: number) {
  let inFlight = false;
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  const tick = () => {
    if (stopped || inFlight) return;
    inFlight = true;
    void refresh().finally(() => {
      inFlight = false;
    });
  };

  return {
    start() {
      if (stopped || timer) return;
      tick();
      timer = setInterval(tick, intervalMs);
    },
    stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = undefined;
    },
  };
}
