import { useMutation, useQuery, useQueryClient, type Query } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ContentType } from "./schema";
import { getTeacherContentExpiryStatus } from "../endpoints/teacher/content-expiry/status_GET.schema";
import {
  postTeacherContentExpiryUpdate,
  type InputType as UpdateInput,
} from "../endpoints/teacher/content-expiry/update_POST.schema";
import {
  postTeacherContentExpiryRelist,
  type InputType as RelistInput,
} from "../endpoints/teacher/content-expiry/relist_POST.schema";
import { formatExpiryDay } from "./contentExpiry";
import { parseErrorMessage } from "./parseErrorMessage";

export const CONTENT_EXPIRY_QUERY_KEY = ["teacher", "contentExpiry"] as const;

// Every teacher console query key starts with "teacher"; lists carry the expiry badge too.
const isTeacherQuery = (query: Query) =>
  typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("teacher");

export function useContentExpiryStatus(contentType: ContentType, contentId: number | null | undefined) {
  const active = typeof contentId === "number" && Number.isInteger(contentId) && contentId > 0;
  return useQuery({
    queryKey: [...CONTENT_EXPIRY_QUERY_KEY, contentType, contentId],
    queryFn: () => getTeacherContentExpiryStatus({ contentType, contentId: contentId as number }),
    enabled: active,
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
}

function useRefreshTeacherQueries() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.removeQueries({ predicate: isTeacherQuery, type: "inactive" });
    return queryClient.invalidateQueries({ predicate: isTeacherQuery });
  };
}

export function useUpdateContentExpiry() {
  const refresh = useRefreshTeacherQueries();
  return useMutation({
    mutationFn: (input: UpdateInput) => postTeacherContentExpiryUpdate(input),
    onSuccess: (data, input) => {
      if (input.expiryDay === null) {
        toast.success("Expiry date removed");
      } else if (data.expired) {
        toast.success("Expiry date updated", {
          description: `Expires after ${formatExpiryDay(input.expiryDay)}. It stays unlisted until you relist it.`,
        });
      } else {
        toast.success("Expiry date saved", {
          description: `On sale until the end of ${formatExpiryDay(input.expiryDay)} (IST), then unlisted automatically.`,
        });
      }
      return refresh();
    },
    onError: (error: unknown) => {
      toast.error("Could not save the expiry date", { description: parseErrorMessage(error) });
    },
  });
}

export function useRelistContent() {
  const refresh = useRefreshTeacherQueries();
  return useMutation({
    mutationFn: (input: RelistInput) => postTeacherContentExpiryRelist(input),
    onSuccess: (data) => {
      toast.success("Relisted", {
        description:
          data.visibility === "public"
            ? "It is back on sale and listed in search, categories and your profile."
            : "It is back on sale as unlisted, open to anyone with its link.",
      });
      return refresh();
    },
    onError: (error: unknown) => {
      toast.error("Could not relist", { description: parseErrorMessage(error) });
    },
  });
}