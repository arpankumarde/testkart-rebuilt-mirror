import { useQuery } from "@tanstack/react-query";
import type { AiConnectorAudience } from "./aiConnectors";
import { getAdminAiConnections } from "../endpoints/admin/ai-connections_GET.schema";
import { getTeacherAiConnections } from "../endpoints/teacher/ai-connections_GET.schema";

/**
 * Refetches on mount and on window focus, overriding the app-wide defaults: the usual way back to
 * the dashboard after connecting is switching tabs from the AI app, and the card should show the
 * new connection the moment that happens.
 */
export const useAiConnections = (audience: AiConnectorAudience, enabled = true) =>
  useQuery({
    queryKey: ["ai-connections", audience],
    queryFn: () => (audience === "admin" ? getAdminAiConnections() : getTeacherAiConnections()),
    staleTime: 30 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled,
  });