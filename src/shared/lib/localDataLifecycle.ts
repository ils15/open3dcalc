let withdrawalPending = false;

/** True while a local-data deletion has not been verified as complete. */
export function isWithdrawalPending(): boolean {
  return withdrawalPending;
}

/** Keep local writes paused until a pending deletion is verified or retried. */
export function setWithdrawalPending(value: boolean): void {
  withdrawalPending = value;
}

export function resetLocalDataLifecycleForTests(): void {
  withdrawalPending = false;
}
