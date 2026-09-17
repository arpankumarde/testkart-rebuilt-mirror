import React, { useState } from "react";
import { Users } from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import {
  useMyTeamQuery,
  useRespondToTeamInviteMutation,
  useLeaveTeamMutation,
} from "../helpers/useTeacherTeam";
import type { TeamAcademy } from "../endpoints/teacher/team/me_GET.schema";
import { Button } from "./Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import styles from "./TeamStatusBanner.module.css";

const academyLabel = (academy: TeamAcademy) => academy.academyName?.trim() || `${academy.ownerName}'s academy`;

/**
 * A teacher's own place in the team model. An owner sees invitations to accept
 * or decline; a manager sees whose academy they are working in and can leave.
 */
export const TeamStatusBanner = ({ className }: { className?: string }) => {
  const { authState } = useAuth();
  const isTeacher = authState.type === "authenticated" && authState.user.role === "teacher";
  const isManager = isTeacher && authState.user.teacherRole === "manager";
  const { data } = useMyTeamQuery(isTeacher);
  const respond = useRespondToTeamInviteMutation();
  const leave = useLeaveTeamMutation();
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (!data) return null;

  if (isManager) {
    if (!data.membership) return null;
    const name = academyLabel(data.membership);
    return (
      <section className={`${styles.banner} ${className ?? ""}`.trim()} aria-label="Your team">
        <span className={styles.iconTile} aria-hidden="true">
          <Users size={18} />
        </span>
        <div className={styles.body}>
          <p className={styles.title}>You are a manager on {name}</p>
          <p className={styles.text}>
            Everything here belongs to their academy. Earnings, withdrawals, bank details and the public profile stay
            with the owner.
          </p>
        </div>
        <div className={styles.actions}>
          <Button variant="outline" size="sm" onClick={() => setConfirmLeave(true)}>
            Leave team
          </Button>
        </div>

        <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Leave {name}?</DialogTitle>
              <DialogDescription>
                You will stop managing their academy and go back to your own account. The owner has to invite you
                again to bring you back.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setConfirmLeave(false)} disabled={leave.isPending}>
                Stay
              </Button>
              <Button onClick={() => leave.mutate()} disabled={leave.isPending}>
                {leave.isPending ? "Leaving..." : "Leave team"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    );
  }

  if (data.invitations.length === 0) return null;

  return (
    <div className={`${styles.stack} ${className ?? ""}`.trim()}>
      {data.invitations.map((invitation) => {
        const answering = respond.isPending && respond.variables?.invitationId === invitation.id;
        return (
          <section
            key={invitation.id}
            className={styles.banner}
            aria-label={`Team invitation from ${invitation.ownerName}`}
          >
            <span className={styles.iconTile} aria-hidden="true">
              <Users size={18} />
            </span>
            <div className={styles.body}>
              <p className={styles.title}>
                {invitation.ownerName} invited you to manage {academyLabel(invitation)}
              </p>
              <p className={styles.text}>
                If you join, your dashboard switches to their academy. Your own listings stay live, but you will not
                see them, their earnings or withdrawals until you leave the team.
              </p>
            </div>
            <div className={styles.actions}>
              <Button
                variant="outline"
                size="sm"
                disabled={respond.isPending}
                onClick={() => respond.mutate({ invitationId: invitation.id, accept: false })}
              >
                Decline
              </Button>
              <Button
                size="sm"
                disabled={respond.isPending}
                onClick={() => respond.mutate({ invitationId: invitation.id, accept: true })}
              >
                {answering && respond.variables?.accept ? "Joining..." : "Join team"}
              </Button>
            </div>
          </section>
        );
      })}
    </div>
  );
};