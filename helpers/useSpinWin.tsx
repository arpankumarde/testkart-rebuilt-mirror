import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSpinWinActive } from "../endpoints/spin-win/active_GET.schema";
import { postSpinWinSpin } from "../endpoints/spin-win/spin_POST.schema";
import { postSpinWinClaim } from "../endpoints/spin-win/claim_POST.schema";
import { getSpinWinMyCoupons } from "../endpoints/spin-win/my-coupons_GET.schema";
import type { SpinCategory } from "./spinWinRules";

export const SPIN_WIN_KEYS = {
  active: ["spinWin", "active"] as const,
  myCoupons: ["spinWin", "myCoupons"] as const,
};

/** The live campaign as this visitor sees it, or null for teachers and admins. Fetching it signed in links this browser's guest spin to the account. */
export const useActiveSpinCampaign = (enabled = true) =>
  useQuery({
    queryKey: SPIN_WIN_KEYS.active,
    queryFn: () => getSpinWinActive(),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

/** The student's coupons; the server links this browser's guest spin to the account first. */
export const useMySpinCoupons = (enabled = true) =>
  useQuery({ queryKey: SPIN_WIN_KEYS.myCoupons, queryFn: () => getSpinWinMyCoupons(), enabled });

function useRefreshSpinData() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: SPIN_WIN_KEYS.active });
    queryClient.invalidateQueries({ queryKey: SPIN_WIN_KEYS.myCoupons });
  };
}

export function useSpinWheel() {
  const refresh = useRefreshSpinData();
  return useMutation({ mutationFn: (slug: string) => postSpinWinSpin({ slug }), onSettled: refresh });
}

export function useClaimSpinReward() {
  const refresh = useRefreshSpinData();
  return useMutation({ mutationFn: (slug: string) => postSpinWinClaim({ slug }), onSettled: refresh });
}

export const SHOP_PATHS: Record<SpinCategory, { href: string; label: string }> = {
  test_series: { href: "/mock-test", label: "Test series" },
  courses: { href: "/course", label: "Courses" },
  study_notes: { href: "/study-notes", label: "Study notes" },
};

export const shopPathFor = (categories: string[]): string =>
  SHOP_PATHS[(categories.find((c) => c in SHOP_PATHS) as SpinCategory | undefined) ?? "test_series"].href;

/** Turns API failures into the wording students see; network errors never show raw. */
export function friendlySpinError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (!message || /fetch|network|Failed to|load failed|JSON/i.test(message)) {
    return "We couldn't reach Testkart just now. Check your connection and try again; you won't lose your spin.";
  }
  return message;
}
