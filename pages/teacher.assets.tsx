import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import { Eye, FileText, FolderOpen, Pencil, Trash2, UploadCloud, Video } from "lucide-react";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "../components/ConsoleDialog";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { Input } from "../components/Input";
import { Skeleton } from "../components/Skeleton";
import { Spinner } from "../components/Spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { TeacherPageHeader } from "../components/TeacherPageHeader";
import { TeacherListToolbar, teacherToolbarControlClass } from "../components/TeacherListToolbar";
import { TeacherListEmpty } from "../components/TeacherListEmpty";
import { TeacherAssetUpload } from "../components/TeacherAssetUpload";
import { TeacherAssetPreview } from "../components/TeacherAssetPreview";
import { useTeacherAssetMutations, useTeacherAssetsQuery } from "../helpers/useTeacherAssets";
import {
  ASSET_NAME_MAX,
  formatAssetDuration,
  formatAssetSize,
  type TeacherAsset,
} from "../helpers/teacherAssetFiles";
import styles from "./teacher.assets.module.css";

type KindTab = "all" | "video" | "pdf";
type SortOption = "recent" | "oldest" | "name" | "size";

const TAB_LABELS: Record<KindTab, string> = { all: "All", video: "Videos", pdf: "PDFs" };
const TAB_ORDER: KindTab[] = ["all", "video", "pdf"];

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const usageText = (asset: TeacherAsset) => {
  const parts = [
    asset.lessonCount > 0 ? `${asset.lessonCount} ${asset.lessonCount === 1 ? "lesson" : "lessons"}` : null,
    asset.notesCount > 0 ? `${asset.notesCount} study ${asset.notesCount === 1 ? "note" : "notes"}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? `Used in ${parts.join(" and ")}` : "Not used yet";
};

const TeacherAssetsPage: React.FC = () => {
  const { data, isPending, error, refetch } = useTeacherAssetsQuery();
  const { renameAssetMutation, deleteAssetMutation } = useTeacherAssetMutations();

  const [tab, setTab] = useState<KindTab>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<TeacherAsset | null>(null);
  const [renameTarget, setRenameTarget] = useState<TeacherAsset | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TeacherAsset | null>(null);

  const assets = useMemo(() => data?.assets ?? [], [data]);

  const counts = useMemo(
    () => ({
      all: assets.length,
      video: assets.filter((asset) => asset.kind === "video").length,
      pdf: assets.filter((asset) => asset.kind === "pdf").length,
    }),
    [assets]
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = assets.filter(
      (asset) => (tab === "all" || asset.kind === tab) && (!query || asset.name.toLowerCase().includes(query))
    );
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "name":
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
        case "size":
          return (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0);
        case "recent":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [assets, tab, search, sort]);

  const openRename = (asset: TeacherAsset) => {
    setRenameTarget(asset);
    setRenameValue(asset.name);
  };

  const trimmedRename = renameValue.trim();
  const renameInvalid = trimmedRename.length === 0 || trimmedRename.length > ASSET_NAME_MAX;

  const submitRename = (event: React.FormEvent) => {
    event.preventDefault();
    if (!renameTarget || renameInvalid || renameAssetMutation.isPending) return;
    if (trimmedRename === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    renameAssetMutation.mutate(
      { id: renameTarget.id, name: trimmedRename },
      {
        onSuccess: () => {
          toast.success("File renamed.");
          setRenameTarget(null);
        },
        onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "The file could not be renamed."),
      }
    );
  };

  const requestDelete = (asset: TeacherAsset) => {
    if (asset.lessonCount > 0 || asset.notesCount > 0) {
      toast.error(`${usageText(asset)}. Remove it from there first, then delete it here.`);
      return;
    }
    setDeleteTarget(asset);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteAssetMutation.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          toast.success("File deleted.");
          setDeleteTarget(null);
        },
        onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "The file could not be deleted."),
      }
    );
  };

  const renderContent = () => {
    if (!data && isPending) {
      return (
        <div className={styles.list}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} style={{ height: "4.5rem", borderRadius: "var(--radius-md)" }} />
          ))}
        </div>
      );
    }

    if (error && !data) {
      return (
        <TeacherListEmpty
          tone="error"
          title="Your library could not be loaded"
          description="The list did not come back from the server. Check your connection and try again."
        >
          <Button onClick={() => refetch()}>Try again</Button>
        </TeacherListEmpty>
      );
    }

    if (assets.length === 0) {
      return (
        <TeacherListEmpty
          icon={<FolderOpen size={26} />}
          title="Your library is empty"
          description="Upload your videos and PDFs once, then add them to any course lesson without uploading again."
        >
          <Button onClick={() => setUploadOpen(true)}>
            <UploadCloud size={16} />
            Upload files
          </Button>
        </TeacherListEmpty>
      );
    }

    if (visible.length === 0) {
      return (
        <TeacherListEmpty
          title={search.trim() ? `Nothing matches "${search.trim()}"` : `No ${TAB_LABELS[tab].toLowerCase()} yet`}
          description={search.trim() ? "Try a different word, or check the other tabs." : "The other tabs may have what you are looking for."}
        >
          {search.trim() && (
            <Button variant="outline" onClick={() => setSearch("")}>
              Clear search
            </Button>
          )}
        </TeacherListEmpty>
      );
    }

    return (
      <ul className={styles.list} aria-label="Library files">
        {visible.map((asset) => {
          const meta = [
            asset.kind === "pdf" ? "PDF" : "Video",
            formatAssetDuration(asset.durationSeconds),
            formatAssetSize(asset.sizeBytes),
            `Added ${dateFormatter.format(new Date(asset.createdAt))}`,
          ].filter(Boolean);
          const inUse = asset.lessonCount > 0 || asset.notesCount > 0;
          return (
            <li key={asset.id} className={styles.row}>
              <button
                type="button"
                className={`${styles.thumb} ${asset.kind === "pdf" ? styles.thumbPdf : ""}`}
                onClick={() => setPreviewAsset(asset)}
                aria-label={`Preview ${asset.name}`}
              >
                {asset.kind === "pdf" ? <FileText size={20} /> : <Video size={20} />}
              </button>
              <div className={styles.rowMain}>
                <span className={styles.rowName} title={asset.name}>
                  {asset.name}
                </span>
                <span className={styles.rowMeta}>{meta.join(" · ")}</span>
              </div>
              <span className={`${styles.usage} ${inUse ? styles.usageActive : ""}`}>{usageText(asset)}</span>
              <div className={styles.rowActions}>
                <Button variant="outline" size="sm" onClick={() => setPreviewAsset(asset)}>
                  <Eye size={14} /> Preview
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => openRename(asset)} aria-label={`Rename ${asset.name}`}>
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={styles.deleteButton}
                  onClick={() => requestDelete(asset)}
                  aria-label={`Delete ${asset.name}`}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <>
      <Helmet>
        <title>Asset Library - Testkart for Teachers</title>
        <meta name="description" content="Your uploaded videos and PDFs, ready to add to course lessons." />
      </Helmet>
      <div className={styles.page}>
        <TeacherPageHeader title="Asset Library">
          <Button onClick={() => setUploadOpen(true)}>
            <UploadCloud size={16} />
            Upload files
          </Button>
        </TeacherPageHeader>
        <p className={styles.intro}>
          Every video and PDF you upload lives here. Add them to course lessons from the curriculum builder with "Add from
          Library", without uploading again.
        </p>

        {assets.length > 0 && (
          <TeacherListToolbar
            tabs={TAB_ORDER.map((value) => ({ value, label: TAB_LABELS[value], count: counts[value] }))}
            value={tab}
            onValueChange={(value) => setTab(TAB_ORDER.find((item) => item === value) ?? "all")}
            tabsLabel="Filter by file type"
            search={{ value: search, onChange: setSearch, placeholder: "Search by name", label: "Search your library" }}
          >
            <Select value={sort} onValueChange={(value) => setSort(value as SortOption)}>
              <SelectTrigger className={teacherToolbarControlClass} aria-label="Sort files">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="name">Name A to Z</SelectItem>
                <SelectItem value="size">Largest first</SelectItem>
              </SelectContent>
            </Select>
          </TeacherListToolbar>
        )}

        <main className={styles.content}>{renderContent()}</main>
      </div>

      <TeacherAssetUpload open={isUploadOpen} onOpenChange={setUploadOpen} />
      <TeacherAssetPreview asset={previewAsset} onClose={() => setPreviewAsset(null)} />

      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && !renameAssetMutation.isPending && setRenameTarget(null)}>
        <ConsoleDialogContent size="sm">
          <form onSubmit={submitRename}>
            <ConsoleDialogHeader
              icon={<Pencil size={20} />}
              title="Rename file"
              description="Only the library name changes. Lessons keep their own titles."
            />
            <ConsoleDialogBody>
              <label className={styles.fieldLabel} htmlFor="asset-rename-input">
                Name
              </label>
              <Input
                id="asset-rename-input"
                value={renameValue}
                maxLength={ASSET_NAME_MAX}
                onChange={(event) => setRenameValue(event.target.value)}
                aria-invalid={renameInvalid || undefined}
              />
              {trimmedRename.length === 0 && <span className={styles.fieldError}>Enter a name.</span>}
            </ConsoleDialogBody>
            <ConsoleDialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameTarget(null)} disabled={renameAssetMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={renameInvalid || renameAssetMutation.isPending}>
                {renameAssetMutation.isPending && <Spinner size="sm" />}
                Save name
              </Button>
            </ConsoleDialogFooter>
          </form>
        </ConsoleDialogContent>
      </Dialog>

      <ConsoleConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleteAssetMutation.isPending) setDeleteTarget(null);
        }}
        tone="destructive"
        icon={<Trash2 size={20} />}
        title="Delete this file?"
        description={
          <>
            <strong>{deleteTarget?.name}</strong> is removed from your library and from storage. This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        pendingLabel="Deleting..."
        isPending={deleteAssetMutation.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
};

export default TeacherAssetsPage;