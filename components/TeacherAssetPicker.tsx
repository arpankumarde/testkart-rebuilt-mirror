import React, { useEffect, useMemo, useState } from "react";
import { Eye, ExternalLink, FileText, FolderOpen, Search, Video } from "lucide-react";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "./ConsoleDialog";
import { Button } from "./Button";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";
import { Spinner } from "./Spinner";
import { TeacherAssetPreview } from "./TeacherAssetPreview";
import { useTeacherAssetsQuery } from "../helpers/useTeacherAssets";
import {
  formatAssetDuration,
  formatAssetSize,
  type TeacherAsset,
  type TeacherAssetKindValue,
} from "../helpers/teacherAssetFiles";
import styles from "./TeacherAssetPicker.module.css";

const KIND_LABELS: Record<TeacherAssetKindValue, string> = { video: "Videos", pdf: "PDFs" };

const usageLabel = (asset: TeacherAsset) => {
  if (asset.lessonCount > 0) return `In ${asset.lessonCount} ${asset.lessonCount === 1 ? "lesson" : "lessons"}`;
  if (asset.notesCount > 0) return "In study notes";
  return null;
};

type TeacherAssetPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kinds: TeacherAssetKindValue[];
  multiple?: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel: (count: number) => string;
  isPending?: boolean;
  onConfirm: (assets: TeacherAsset[]) => void;
};

/*
 * Picks files from the teacher's asset library. With multiple, files come back in
 * the order they were ticked, which callers use as the lesson order.
 */
export const TeacherAssetPicker: React.FC<TeacherAssetPickerProps> = ({
  open,
  onOpenChange,
  kinds,
  multiple = false,
  title,
  description,
  confirmLabel,
  isPending = false,
  onConfirm,
}) => {
  const { data, isPending: isLoading, error, refetch } = useTeacherAssetsQuery(open);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<TeacherAssetKindValue | "all">("all");
  const [previewAsset, setPreviewAsset] = useState<TeacherAsset | null>(null);

  useEffect(() => {
    if (open) return;
    setSelectedIds([]);
    setSearch("");
    setKindFilter("all");
    setPreviewAsset(null);
  }, [open]);

  const available = useMemo(
    () => (data?.assets ?? []).filter((asset) => kinds.includes(asset.kind)),
    [data, kinds]
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return available.filter(
      (asset) =>
        (kindFilter === "all" || asset.kind === kindFilter) && (!query || asset.name.toLowerCase().includes(query))
    );
  }, [available, kindFilter, search]);

  const byId = useMemo(() => new Map(available.map((asset) => [asset.id, asset])), [available]);
  const selected = selectedIds.map((id) => byId.get(id)).filter((asset): asset is TeacherAsset => !!asset);

  const toggle = (id: number) => {
    if (isPending) return;
    setSelectedIds((previous) => {
      if (!multiple) return previous[0] === id ? [] : [id];
      return previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id];
    });
  };

  const kindNoun = kinds.length === 1 ? (kinds[0] === "video" ? "videos" : "PDFs") : "videos or PDFs";

  const renderBody = () => {
    if (!data && isLoading) {
      return (
        <div className={styles.list}>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} style={{ height: "3.5rem" }} />
          ))}
        </div>
      );
    }
    if (error && !data) {
      return (
        <div className={styles.empty} role="alert">
          <p className={styles.emptyTitle}>Your library could not be loaded.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      );
    }
    if (available.length === 0) {
      return (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <FolderOpen size={22} />
          </span>
          <p className={styles.emptyTitle}>No {kindNoun} in your library yet</p>
          <p className={styles.emptyText}>Upload them in your Asset Library, then come back to pick them here.</p>
          <Button variant="outline" size="sm" asChild>
            <a href="/teacher/assets" target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Open Asset Library
            </a>
          </Button>
        </div>
      );
    }
    return (
      <>
        <div className={styles.filters}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} aria-hidden="true" />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your library"
              aria-label="Search your library"
              className={styles.searchInput}
            />
          </div>
          {kinds.length > 1 && (
            <div className={styles.kindTabs} role="group" aria-label="File type">
              {(["all", ...kinds] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={`${styles.kindTab} ${kindFilter === kind ? styles.kindTabActive : ""}`}
                  aria-pressed={kindFilter === kind}
                  onClick={() => setKindFilter(kind)}
                >
                  {kind === "all" ? "All" : KIND_LABELS[kind]}
                </button>
              ))}
            </div>
          )}
        </div>

        {visible.length === 0 ? (
          <p className={styles.noMatch}>Nothing in your library matches "{search.trim()}".</p>
        ) : (
          <ul className={styles.list} aria-label="Library files">
            {visible.map((asset) => {
              const position = selectedIds.indexOf(asset.id);
              const isSelected = position !== -1;
              const meta = [
                formatAssetDuration(asset.durationSeconds),
                formatAssetSize(asset.sizeBytes),
                usageLabel(asset),
              ].filter(Boolean);
              return (
                <li key={asset.id} className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}>
                  <label className={styles.rowLabel}>
                    <input
                      type={multiple ? "checkbox" : "radio"}
                      name="teacher-asset-picker"
                      className={styles.control}
                      checked={isSelected}
                      onChange={() => toggle(asset.id)}
                      disabled={isPending}
                    />
                    <span
                      className={`${styles.kindIcon} ${asset.kind === "pdf" ? styles.kindPdf : ""}`}
                      aria-hidden="true"
                    >
                      {asset.kind === "pdf" ? <FileText size={16} /> : <Video size={16} />}
                    </span>
                    <span className={styles.rowText}>
                      <span className={styles.rowName}>{asset.name}</span>
                      <span className={styles.rowMeta}>
                        {asset.kind === "pdf" ? "PDF" : "Video"}
                        {meta.length > 0 ? ` · ${meta.join(" · ")}` : ""}
                      </span>
                    </span>
                    {multiple && isSelected && (
                      <span className={styles.order} aria-label={`Lesson ${position + 1}`}>
                        {position + 1}
                      </span>
                    )}
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setPreviewAsset(asset)}
                    aria-label={`Preview ${asset.name}`}
                  >
                    <Eye size={16} />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <ConsoleDialogContent size="lg">
        <ConsoleDialogHeader icon={<FolderOpen size={20} />} title={title} description={description} hideClose={isPending} />
        <ConsoleDialogBody>{renderBody()}</ConsoleDialogBody>
        <ConsoleDialogFooter>
          {multiple && selected.length > 0 && (
            <p className={styles.footerNote}>
              {selected.length} selected. Lessons are added in the order you picked them.
            </p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(selected)} disabled={selected.length === 0 || isPending}>
            {isPending && <Spinner size="sm" />}
            {confirmLabel(selected.length)}
          </Button>
        </ConsoleDialogFooter>
      </ConsoleDialogContent>
      <TeacherAssetPreview asset={previewAsset} onClose={() => setPreviewAsset(null)} />
    </Dialog>
  );
};