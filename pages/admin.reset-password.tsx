import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "../components/Form";
import { Button } from "../components/Button";
import { Spinner } from "../components/Spinner";
import { PasswordInput } from "../components/PasswordInput";
import { AdminAuthLink, AdminAuthShell } from "../components/AdminAuthShell";
import { ADMIN_AUTH_QUERY_KEY } from "../helpers/useAdminAuth";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import {
  schema as confirmSchema,
  postAdminPasswordResetConfirm,
} from "../endpoints/admin/password-reset/confirm_POST.schema";
import styles from "./admin.reset-password.module.css";

const formSchema = z
  .object({
    password: confirmSchema.shape.password,
    confirmPassword: z.string().min(1, "Re-enter your new password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const AdminResetPasswordPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = useMemo(
    () => new URLSearchParams(location.hash.replace(/^#/, "")).get("token") ?? "",
    [location.hash]
  );

  const form = useForm({
    defaultValues: { password: "", confirmPassword: "" },
    schema: formSchema,
  });

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    setError(null);
    setIsLoading(true);
    try {
      await postAdminPasswordResetConfirm({ token, password: data.password });
      // The reset signs this account out everywhere, so a cached session must not send sign-in to the dashboard.
      queryClient.removeQueries({ queryKey: ADMIN_AUTH_QUERY_KEY });
      navigate("/admin/login", { replace: true, state: { passwordReset: true } });
    } catch (err) {
      setError(parseErrorMessage(err));
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <>
        <Helmet>
          <title>Reset link incomplete - Testkart Admin</title>
        </Helmet>
        <AdminAuthShell
          title="Link incomplete"
          description="Open the link from your reset email again, or request a new one."
        >
          <Button asChild className={styles.submitButton}>
            <Link to="/admin/forgot-password">Request a new link</Link>
          </Button>
          <AdminAuthLink to="/admin/login">Back to sign in</AdminAuthLink>
        </AdminAuthShell>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Set a new password - Testkart Admin</title>
      </Helmet>
      <AdminAuthShell
        title="Set a new password"
        description="Use at least 8 characters. Saving signs this account out on every device."
        notice={error ? { tone: "error", message: error } : null}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className={styles.form}>
            <FormItem name="password">
              <FormLabel>New password</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete="new-password"
                  disabled={isLoading}
                  value={form.values.password}
                  onChange={(e) => {
                    form.setValues((prev) => ({ ...prev, password: e.target.value }));
                    setError(null);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="confirmPassword">
              <FormLabel>Confirm new password</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete="new-password"
                  disabled={isLoading}
                  value={form.values.confirmPassword}
                  onChange={(e) => {
                    form.setValues((prev) => ({ ...prev, confirmPassword: e.target.value }));
                    setError(null);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <Button type="submit" disabled={isLoading} className={styles.submitButton}>
              {isLoading ? (
                <span className={styles.loadingText}>
                  <Spinner size="sm" />
                  Saving...
                </span>
              ) : (
                "Save new password"
              )}
            </Button>

            <AdminAuthLink to="/admin/forgot-password">Request a new link</AdminAuthLink>
          </form>
        </Form>
      </AdminAuthShell>
    </>
  );
};

export default AdminResetPasswordPage;