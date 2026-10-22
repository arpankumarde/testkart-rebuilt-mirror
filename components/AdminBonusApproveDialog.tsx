import React from "react";
import { CheckCircle, Gift } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./Dialog";
import { Button } from "./Button";
import { formatRupees } from "../helpers/teacherCampaignRules";
import styles from "./AdminBonusApproveDialog.module.css";

interface AdminBonusApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentTitle: string;
  teacherName: string;
  amount: number;
  bonusTitle: string;
  isPending: boolean;
  /** creditBonus true credits the claimed bonus along with the approval. */
  onApprove: (creditBonus: boolean) => void;
}

/*
 * Approve step for a submission that carries a bonus claim. Approval
 * puts the content live; crediting the bonus is a separate quality call, so the
 * two buttons stay side by side and approving alone leaves the claim open.
 */
export const AdminBonusApproveDialog: React.FC<AdminBonusApproveDialogProps> = ({
  open,
  onOpenChange,
  contentTitle,
  teacherName,
  amount,
  bonusTitle,
  isPending,
  onApprove,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className={styles.content}>
      <DialogHeader>
        <div className={styles.header}>
          <span className={styles.icon} aria-hidden="true">
            <CheckCircle size={20} />
          </span>
          <div>
            <DialogTitle className={styles.title}>Approve this content?</DialogTitle>
            <DialogDescription className={styles.description}>
              "{contentTitle}" by {teacherName} goes live on the site and students can buy it.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className={styles.bonus}>
        <span className={styles.bonusIcon} aria-hidden="true">
          <Gift size={18} />
        </span>
        <div>
          <p className={styles.bonusTitle}>The teacher claimed the {formatRupees(amount)} {bonusTitle}</p>
          <p className={styles.bonusText}>
            Credit it only if this is high quality work. Approving alone keeps the claim open, so you can credit or
            decline it later from Bonus claims.
          </p>
        </div>
      </div>

      <DialogFooter className={styles.footer}>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
          Cancel
        </Button>
        <Button type="button" variant="outline" onClick={() => onApprove(false)} disabled={isPending}>
          Approve only
        </Button>
        <Button type="button" variant="primary" onClick={() => onApprove(true)} disabled={isPending}>
          {isPending ? "Saving..." : `Approve and credit ${formatRupees(amount)}`}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);