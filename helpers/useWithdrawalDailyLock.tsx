import { useEffect, useState } from "react";
import { type WithdrawalDailyLimit } from "./withdrawalDailyLimit";

/**
 * Whether the user has used today's withdrawal request, from the list
 * endpoint's dailyLimit. Unlocks by itself at 12:00 AM IST without a reload;
 * the request endpoint enforces the same rule on the server.
 */
export function useWithdrawalDailyLock(dailyLimit: WithdrawalDailyLimit | undefined) {
  const nextAvailableAt = dailyLimit?.nextAvailableAt ? new Date(dailyLimit.nextAvailableAt) : null;
  const unlockAtMs = nextAvailableAt?.getTime() ?? null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (unlockAtMs === null) return;
    const delay = unlockAtMs - Date.now();
    if (delay <= 0) return;
    const timer = window.setTimeout(() => setNow(Date.now()), delay + 1000);
    return () => window.clearTimeout(timer);
  }, [unlockAtMs]);

  const isLocked = unlockAtMs !== null && now < unlockAtMs;
  return {
    isLocked,
    lastRequestedAt: isLocked && dailyLimit?.lastRequestedAt ? new Date(dailyLimit.lastRequestedAt) : null,
  };
}
