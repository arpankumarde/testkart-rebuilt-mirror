import { useQuery } from "@tanstack/react-query";
import { getSpinWinMyCoupons } from "../endpoints/spin-win/my-coupons_GET.schema";
import type { SpinCategory } from "./spinWinRules";

export const SPIN_WIN_KEYS = {
  myCoupons: ["spinWin", "myCoupons"] as const,
};

/** The student's coupons; the server links this browser's guest spin to the account first. */
export const useMySpinCoupons = (enabled = true) =>
  useQuery({ queryKey: SPIN_WIN_KEYS.myCoupons, queryFn: () => getSpinWinMyCoupons(), enabled });

export const SHOP_PATHS: Record<SpinCategory, { href: string; label: string }> = {
  test_series: { href: "/mock-test", label: "Test series" },
  courses: { href: "/course", label: "Courses" },
  study_notes: { href: "/study-notes", label: "Study notes" },
};

export const shopPathFor = (categories: string[]): string =>
  SHOP_PATHS[(categories.find((c) => c in SHOP_PATHS) as SpinCategory | undefined) ?? "test_series"].href;
