import React, { useEffect, useState } from "react";
import { Handshake } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import { Button } from "./Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { useAdminOptionsQuery } from "../helpers/useAdminOptions";
import { useAdminSetTeacherRelationshipManagerMutation } from "../helpers/useAdminSetTeacherRelationshipManager";
import styles from "./AdminTeacherRelationshipManagerDialog.module.css";

export type RelationshipManagerTarget = {
  teacherId: number;
  teacherName: string;
  currentAdminId: number | null;
};

interface AdminTeacherRelationshipManagerDialogProps {
  target: RelationshipManagerTarget | null;
  onClose: () => void;
}

export const AdminTeacherRelationshipManagerDialog: React.FC<AdminTeacherRelationshipManagerDialogProps> = ({
  target,
  onClose,
}) => {
  const [adminId, setAdminId] = useState("");
  const { data, isFetching } = useAdminOptionsQuery();
  const mutation = useAdminSetTeacherRelationshipManagerMutation();
  const activeAdmins = (data?.admins ?? []).filter((admin) => admin.isActive);

  useEffect(() => {
    setAdminId(target?.currentAdminId ? String(target.currentAdminId) : "");
  }, [target]);

  const unchanged = adminId === "" || Number(adminId) === target?.currentAdminId;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!target || unchanged || mutation.isPending) return;
    mutation.mutate(
      { teacherId: target.teacherId, adminId: Number(adminId) },
      { onSuccess: onClose }
    );
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={styles.content}>
        <DialogHeader>
          <div className={styles.header}>
            <span className={styles.icon} aria-hidden="true">
              <Handshake size={20} />
            </span>
            <div className={styles.headings}>
              <DialogTitle className={styles.title}>Change relationship manager</DialogTitle>
              <DialogDescription className={styles.description}>
                {target?.teacherName} sees this admin's name, photo and email in their teacher console.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label} htmlFor="relationship-manager-select">
            Relationship manager
          </label>
          <Select value={adminId} onValueChange={setAdminId}>
            <SelectTrigger id="relationship-manager-select">
              <SelectValue placeholder={isFetching && !data ? "Loading admins..." : "Choose an admin"} />
            </SelectTrigger>
            <SelectContent>
              {activeAdmins.map((admin) => (
                <SelectItem key={admin.id} value={String(admin.id)}>
                  {admin.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={unchanged || mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
