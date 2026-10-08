import React, { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getTeacherBundlesContaining,
  type InputType as ContainingInput,
} from "../endpoints/teacher/bundles/containing_GET.schema";
import type { AffectedBundle } from "./bundleDependencies";
import { BundleUnpublishDialog } from "../components/BundleUnpublishDialog";

/*
 * Runs before any teacher unpublish. It asks which published bundles hold the
 * items; when there are none, proceed(false) is the screen's normal flow. When
 * there are some, nothing happens until the teacher accepts the warning dialog,
 * and then proceed(true) runs the same unpublish with confirmBundleUnpublish.
 * Cancelling never calls proceed, so no status changes.
 *
 * proceed may return a promise. The dialog stays open, showing its pending
 * state, until it settles. Failures are the caller's to report (every unpublish
 * mutation toasts its own), so they are swallowed here.
 *
 * If the check itself fails, the unpublish is attempted anyway: the endpoints
 * refuse to unpublish an item held by a published bundle without confirmation.
 */
type Proceed = (confirmedBundleUnpublish: boolean) => unknown;

export const useBundleUnpublishGuard = () => {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<{ bundles: AffectedBundle[]; proceed: Proceed } | null>(null);
  const [isRunning, setRunning] = useState(false);
  const busy = useRef(false);

  const run = useCallback(async (proceed: Proceed, confirmed: boolean) => {
    try {
      await proceed(confirmed);
    } catch {
      // Reported by the caller's mutation.
    }
  }, []);

  const requestUnpublish = useCallback(
    async (target: ContainingInput, proceed: Proceed) => {
      if (busy.current) return;
      busy.current = true;
      try {
        let bundles: AffectedBundle[] = [];
        try {
          const result = await queryClient.fetchQuery({
            queryKey: ["teacher", "bundles", "containing", target.itemType, target.ids],
            queryFn: () => getTeacherBundlesContaining(target),
            staleTime: 0,
            gcTime: 0,
          });
          bundles = result.bundles;
        } catch (error) {
          console.error("Bundle check failed, relying on the server check:", error);
        }

        if (bundles.length === 0) {
          await run(proceed, false);
          return;
        }
        setPending({ bundles, proceed });
      } finally {
        busy.current = false;
      }
    },
    [queryClient, run]
  );

  const confirm = async () => {
    if (!pending || busy.current) return;
    busy.current = true;
    setRunning(true);
    try {
      await run(pending.proceed, true);
    } finally {
      busy.current = false;
      setRunning(false);
      setPending(null);
    }
  };

  const bundleUnpublishDialog = (
    <BundleUnpublishDialog
      open={pending !== null}
      bundles={pending?.bundles ?? []}
      isPending={isRunning}
      onConfirm={confirm}
      onCancel={() => setPending(null)}
    />
  );

  return { requestUnpublish, bundleUnpublishDialog };
};
