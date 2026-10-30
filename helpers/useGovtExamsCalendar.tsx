import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getGovtExamsCalendarPage } from "../endpoints/govt-exams-calendar/page_GET.schema";
import type { GecPublicPayload } from "./gecModel";
import { buildGecView } from "./gecView";

/* Must match the key helpers/gecPrefetch fills during SSR. */
export const GEC_PUBLIC_QUERY_KEY = ["govtExamsCalendar", "public"] as const;

export const useGovtExamsCalendar = () =>
  useQuery({
    queryKey: GEC_PUBLIC_QUERY_KEY,
    queryFn: () => getGovtExamsCalendarPage(),
    staleTime: 60_000,
  });

/** The view for a payload, built once per payload. Uses the payload's own day so SSR and hydration agree. */
export const useGecView = (payload: GecPublicPayload | undefined) =>
  useMemo(() => (payload ? buildGecView(payload.snapshot, payload.today, payload.lastUpdated) : null), [payload]);