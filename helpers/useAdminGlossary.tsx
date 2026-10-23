import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAdminGlossaryList, InputType as ListInput } from "../endpoints/admin/glossary/list_GET.schema";
import { getAdminGlossaryTerm } from "../endpoints/admin/glossary/get_GET.schema";
import { postAdminGlossarySave, InputType as SaveInput } from "../endpoints/admin/glossary/save_POST.schema";
import { postAdminGlossaryUnpublish } from "../endpoints/admin/glossary/unpublish_POST.schema";
import { postAdminGlossaryDelete } from "../endpoints/admin/glossary/delete_POST.schema";
import { glossaryPublicKeys } from "./useGlossaryPublic";
import { parseErrorMessage } from "./parseErrorMessage";

export const ADMIN_GLOSSARY_QUERY_KEY = ["admin", "glossary"] as const;

const refreshLists = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: [...ADMIN_GLOSSARY_QUERY_KEY, "list"] });
  queryClient.invalidateQueries({ queryKey: glossaryPublicKeys.all });
};

export const useAdminGlossaryList = (input: ListInput, enabled = true) =>
  useQuery({
    queryKey: [...ADMIN_GLOSSARY_QUERY_KEY, "list", input],
    queryFn: () => getAdminGlossaryList(input),
    enabled,
    placeholderData: (previous) => previous,
  });

/** The editor and preview always refetch on mount so they never open on a cached copy. */
export const useAdminGlossaryTerm = (id: number | null) =>
  useQuery({
    queryKey: [...ADMIN_GLOSSARY_QUERY_KEY, "detail", id],
    queryFn: () => getAdminGlossaryTerm({ id: id! }),
    enabled: id !== null,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

/** Errors are left to the editor, which maps validation issues onto fields. */
export const useSaveGlossaryTermMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveInput) => postAdminGlossarySave(data),
    onSuccess: ({ term }) => {
      queryClient.setQueryData([...ADMIN_GLOSSARY_QUERY_KEY, "detail", term.id], { term });
      refreshLists(queryClient);
    },
  });
};

export const useUnpublishGlossaryTermMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => postAdminGlossaryUnpublish({ id }),
    onSuccess: (_result, id) => {
      toast.success("Moved back to draft");
      queryClient.invalidateQueries({ queryKey: [...ADMIN_GLOSSARY_QUERY_KEY, "detail", id] });
      refreshLists(queryClient);
    },
    onError: (error) => toast.error(parseErrorMessage(error) || "Could not unpublish this term"),
  });
};

export const useDeleteGlossaryTermMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => postAdminGlossaryDelete({ id }),
    onSuccess: () => {
      toast.success("Deleted");
      refreshLists(queryClient);
    },
    onError: (error) => toast.error(parseErrorMessage(error) || "Could not delete this term"),
  });
};