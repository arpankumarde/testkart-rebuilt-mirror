import { useMutation, useQuery } from "@tanstack/react-query";
import { getMasterclasses } from "../endpoints/masterclasses/list_GET.schema";
import { getMasterclass } from "../endpoints/masterclasses/get_GET.schema";
import { postMasterclassRegister } from "../endpoints/masterclasses/register_POST.schema";

export const useMasterclassesListQuery = () =>
  useQuery({
    queryKey: ["masterclasses", "list"],
    queryFn: () => getMasterclasses(),
  });

export const useMasterclassQuery = (slug: string) =>
  useQuery({
    queryKey: ["masterclasses", "detail", slug],
    queryFn: () => getMasterclass({ slug }),
    enabled: !!slug,
  });

export const useRegisterForMasterclassMutation = () =>
  useMutation({
    mutationFn: postMasterclassRegister,
  });
