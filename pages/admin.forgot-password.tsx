import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "../components/Form";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Spinner } from "../components/Spinner";
import { AdminAuthLink, AdminAuthShell } from "../components/AdminAuthShell";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import {
  schema as requestSchema,
  postAdminPasswordResetRequest,
} from "../endpoints/admin/password-reset/request_POST.schema";
import styles from "./admin.forgot-password.module.css";

const AdminForgotPasswordPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "" },
    schema: requestSchema,
  });

  const handleSubmit = async (data: z.infer<typeof requestSchema>) => {
    setError(null);
    setIsLoading(true);
    try {
      await postAdminPasswordResetRequest(data);
      setSentTo(data.email.trim());
    } catch (err) {
      setError(parseErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Reset password - Testkart Admin</title>
      </Helmet>
      {sentTo ? (
        <AdminAuthShell
          title="Check your email"
          description={
            <>
              If <strong>{sentTo}</strong> belongs to an admin account, a link to set a new
              password is on its way. It works once and expires in 1 hour.
            </>
          }
        >
          <div className={styles.form}>
            <Button variant="outline" className={styles.submitButton} onClick={() => setSentTo(null)}>
              Use a different email
            </Button>
            <AdminAuthLink to="/admin/login">Back to sign in</AdminAuthLink>
          </div>
        </AdminAuthShell>
      ) : (
        <AdminAuthShell
          title="Reset password"
          description="Enter your admin email and we will send you a link to set a new password."
          notice={error ? { tone: "error", message: error } : null}
        >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className={styles.form}>
              <FormItem name="email">
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter your email"
                    type="email"
                    autoComplete="username"
                    disabled={isLoading}
                    value={form.values.email}
                    onChange={(e) => {
                      form.setValues((prev) => ({ ...prev, email: e.target.value }));
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
                    Sending...
                  </span>
                ) : (
                  "Send reset link"
                )}
              </Button>

              <AdminAuthLink to="/admin/login">Back to sign in</AdminAuthLink>
            </form>
          </Form>
        </AdminAuthShell>
      )}
    </>
  );
};

export default AdminForgotPasswordPage;