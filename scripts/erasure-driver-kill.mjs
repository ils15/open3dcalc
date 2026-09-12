/** SIGKILL self — used by the erasure driver for real crash injection. */
export function processKillSelf() {
  process.kill(process.pid, "SIGKILL");
}
