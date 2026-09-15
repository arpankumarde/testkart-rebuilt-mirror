import React from "react";
import * as z from "zod";
import { 
  useTeacherTeamQuery, 
  useInviteTeamMemberMutation, 
  useRemoveTeamMemberMutation 
} from "../helpers/useTeacherTeam";
import { useAuth } from "../helpers/useAuth";
import { Form, FormItem, FormLabel, FormControl, FormMessage, useForm } from "./Form";
import { schema as inviteSchema } from "../endpoints/teacher/team/invite_POST.schema";
import { Input } from "./Input";
import { Button } from "./Button";
import { PhoneNumberInput } from "./PhoneNumberInput";
import { Avatar, AvatarFallback, AvatarImage } from "./Avatar";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { TrashIcon, UserPlus, ShieldAlert } from "lucide-react";
import styles from "./TeamManagementSection.module.css";

export const TeamManagementSection = () => {
  const { authState } = useAuth();
  const { data, isLoading, error } = useTeacherTeamQuery();
  const inviteMutation = useInviteTeamMemberMutation();
  const removeMutation = useRemoveTeamMemberMutation();

  const form = useForm({
    schema: inviteSchema,
    defaultValues: { displayName: "", phone: "" }
  });

  // Verify that only the actual account owner can access the team section
  const isOwner = authState.type === "authenticated" && authState.user.teacherRole === "owner";

  if (!isOwner) {
    return (
      <div className={styles.container}>
        <div className={styles.unauthorized}>
          <ShieldAlert className={styles.unauthorizedIcon} />
          <h3>Account Owner Only</h3>
          <p>Only the primary account owner can manage team members.</p>
        </div>
      </div>
    );
  }

  const onSubmit = (values: z.infer<typeof inviteSchema>) => {
    inviteMutation.mutate(values, {
      onSuccess: () => {
        form.setValues({ displayName: "", phone: "" });
      }
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Team Management</h2>
        <p className={styles.description}>
          Invite managers to help you manage your tests, courses, and digital products.
        </p>
      </div>

      <div className={styles.inviteSection}>
        <h3 className={styles.sectionTitle}>Invite a Team Member</h3>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
            <div className={styles.formRow}>
              <FormItem name="displayName" className={styles.flexItem}>
                <FormLabel>Display Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="John Doe"
                    value={form.values.displayName}
                    onChange={(e) => form.setValues(prev => ({ ...prev, displayName: e.target.value }))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              <FormItem name="phone" className={styles.flexItem}>
                <FormLabel>Mobile Number</FormLabel>
                <FormControl>
                  <PhoneNumberInput
                    value={form.values.phone}
                    onChange={(val) => form.setValues(prev => ({ ...prev, phone: val }))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              <div className={styles.buttonWrapper}>
                <Button type="submit" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? "Inviting..." : <><UserPlus size={16} /> Invite</>}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </div>

      <div className={styles.listSection}>
        <h3 className={styles.sectionTitle}>Current Team Members</h3>
        {isLoading ? (
          <div className={styles.loadingList}>
            <Skeleton style={{ height: "4.5rem" }} />
            <Skeleton style={{ height: "4.5rem" }} />
          </div>
        ) : error ? (
          <div className={styles.errorState}>Failed to load team members.</div>
        ) : data?.members && data.members.length > 0 ? (
          <div className={styles.memberList}>
            {data.members.map((member) => (
              <div key={member.id} className={styles.memberCard}>
                <div className={styles.memberInfo}>
                  <Avatar>
                    {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt={member.displayName} /> : null}
                    <AvatarFallback>{member.displayName.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className={styles.memberDetails}>
                    <h4 className={styles.memberName}>{member.displayName}</h4>
                    <p className={styles.memberPhone}>+91 {member.invitedPhone}</p>
                  </div>
                </div>
                <div className={styles.memberActions}>
                  <Badge variant={member.status === "active" ? "success" : "outline"}>
                    {member.status === "active" ? "Active" : "Revoked"}
                  </Badge>
                  {member.status === "active" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={styles.removeButton}
                      onClick={() => removeMutation.mutate({ memberUserId: member.memberUserId })}
                      disabled={removeMutation.isPending}
                    >
                      <TrashIcon size={16} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p>No team members invited yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};