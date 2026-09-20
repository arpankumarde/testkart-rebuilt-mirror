import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTeacherAssetsList, type OutputType as AssetList } from "../endpoints/teacher/assets/list_GET.schema";
import { postTeacherAssetsCreate } from "../endpoints/teacher/assets/create_POST.schema";
import { postTeacherAssetsRename } from "../endpoints/teacher/assets/rename_POST.schema";
import { postTeacherAssetsDelete } from "../endpoints/teacher/assets/delete_POST.schema";
import type { TeacherAsset } from "./teacherAssetFiles";

export const TEACHER_ASSETS_QUERY_KEY = ["teacher", "assets"] as const;

/*
 * refetchOnMount is off app-wide, so the library opts back in: files uploaded
 * through a lesson or study notes join the library on the server's next list.
 */
export const useTeacherAssetsQuery = (enabled = true) =>
  useQuery({
    queryKey: TEACHER_ASSETS_QUERY_KEY,
    queryFn: () => getTeacherAssetsList(),
    enabled,
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });

export const useTeacherAssetMutations = () => {
  const queryClient = useQueryClient();

  const upsert = (asset: TeacherAsset) =>
    queryClient.setQueryData<AssetList>(TEACHER_ASSETS_QUERY_KEY, (previous) => {
      if (!previous) return previous;
      const exists = previous.assets.some((item) => item.id === asset.id);
      return {
        assets: exists
          ? previous.assets.map((item) => (item.id === asset.id ? asset : item))
          : [asset, ...previous.assets],
      };
    });

  const createAssetMutation = useMutation({
    mutationFn: postTeacherAssetsCreate,
    onSuccess: ({ asset }) => upsert(asset),
  });

  const renameAssetMutation = useMutation({
    mutationFn: postTeacherAssetsRename,
    onSuccess: ({ asset }) => upsert(asset),
  });

  const deleteAssetMutation = useMutation({
    mutationFn: postTeacherAssetsDelete,
    onSuccess: (_data, variables) =>
      queryClient.setQueryData<AssetList>(TEACHER_ASSETS_QUERY_KEY, (previous) =>
        previous ? { assets: previous.assets.filter((item) => item.id !== variables.id) } : previous
      ),
  });

  const invalidateAssets = () => queryClient.invalidateQueries({ queryKey: TEACHER_ASSETS_QUERY_KEY });

  return { createAssetMutation, renameAssetMutation, deleteAssetMutation, invalidateAssets };
};