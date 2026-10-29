import React, { useState } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./Dialog";
import { Form, FormItem, FormLabel, FormControl, FormMessage, useForm } from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { useAuth } from "../helpers/useAuth";
import { isPlaceholderDisplayName } from "../helpers/isPlaceholderDisplayName";
import { useStudentProfileMutations } from "../helpers/useStudentProfileMutations";
import styles from "./RequiredNameDialog.module.css";

const nameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Please enter your full name")
    .max(100, "Name must be 100 characters or less")
    // Stops the generated placeholder being typed straight back in.
    .refine((value) => !isPlaceholderDisplayName(value), {
      message: "Please enter your real full name",
    }),
});

/**
 * Blocking popup for students whose name is still the generated `User_<id>`.
 * It cannot be closed or skipped; saving a real name refreshes the session,
 * which unlocks the dashboard on its own. The only way out is to log out.
 */
export const RequiredNameDialog: React.FC = () => {
  const { logout } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const { useUpdateStudentProfileMutation } = useStudentProfileMutations();
  const updateProfileMutation = useUpdateStudentProfileMutation();
  // Deliberately empty, never seeded from the user: offering the generated
  // name back as a default defeats the ask.
  const nameForm = useForm({ defaultValues: { displayName: "" }, schema: nameSchema });

  const handleSave = (data: { displayName: string }) => {
    setError(null);
    updateProfileMutation.mutate(
      { displayName: data.displayName.trim() },
      { onError: (err) => setError(err.message) }
    );
  };

  const isSaving = updateProfileMutation.isPending;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className={styles.dialogContent}
        hideCloseButton
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Add your name to continue</DialogTitle>
          <DialogDescription>
            Your account is still using an auto-generated name. Enter your full name to open your
            dashboard. It appears on your certificates, leaderboards and receipts.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.container}>
          {error && <div className={styles.errorMessage}>{error}</div>}

          <Form {...nameForm}>
            <form onSubmit={nameForm.handleSubmit(handleSave)} className={styles.form}>
              <FormItem name="displayName">
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter your full name"
                    type="text"
                    autoComplete="name"
                    autoFocus
                    disabled={isSaving}
                    value={nameForm.values.displayName}
                    onChange={(e) => nameForm.setValues({ displayName: e.target.value })}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              <Button type="submit" disabled={isSaving} className={styles.submitButton}>
                {isSaving ? (
                  <span className={styles.loadingText}>
                    <Spinner className={styles.spinner} size="sm" />
                    Saving...
                  </span>
                ) : (
                  "Save and Continue"
                )}
              </Button>
            </form>
          </Form>

          <div className={styles.footer}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => logout()}
              disabled={isSaving}
              className={styles.logoutButton}
            >
              Log out
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};