import React from "react";
import { Package } from "lucide-react";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import type { AffectedBundle } from "../helpers/bundleDependencies";
import styles from "./BundleUnpublishDialog.module.css";

interface BundleUnpublishDialogProps {
  open: boolean;
  bundles: AffectedBundle[];
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const SHOWN_BUNDLES = 3;

/*
 * The warning every unpublish entry point shows when the item sits in a
 * published bundle. Cancel changes nothing; Unpublish Anyway runs the caller's
 * own unpublish with the confirmation flag, which takes the bundles down with it.
 */
export const BundleUnpublishDialog: React.FC<BundleUnpublishDialogProps> = ({
  open,
  bundles,
  isPending,
  onConfirm,
  onCancel,
}) => {
  const shown = bundles.slice(0, SHOWN_BUNDLES).map((bundle) => bundle.title);
  const hidden = bundles.length - shown.length;

  return (
    <ConsoleConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isPending) onCancel();
      }}
      tone="destructive"
      icon={<Package size={20} />}
      title="This item is included in a bundle"
      description={
        <>
          This item is part of one or more published bundles. Unpublishing it will also unpublish the associated
          bundle(s). Are you sure you want to continue?
          {shown.length > 0 ? (
            <span className={styles.bundles}>
              Affected: {shown.join(", ")}
              {hidden > 0 ? ` and ${hidden} more` : ""}
            </span>
          ) : null}
        </>
      }
      confirmLabel="Unpublish Anyway"
      pendingLabel="Unpublishing..."
      cancelLabel="Cancel"
      isPending={isPending}
      onConfirm={onConfirm}
    />
  );
};
