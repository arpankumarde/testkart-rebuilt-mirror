import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { Skeleton } from "../components/Skeleton";
import { PasswordInput } from "../components/PasswordInput";
import { AdminAuthLink, AdminAuthShell } from "../components/AdminAuthShell";
import { useAdminAuth } from "../helpers/useAdminAuth";
import {
  schema as loginSchema,
  postAdminLogin,
} from "../endpoints/admin/login_POST.schema";
import styles from "./admin.login.module.css";

type AdminLoginFormData = z.infer<typeof loginSchema>;

const AdminLoginPage: React.FC = () => {
  const { authState, onLogin } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordWasReset =
    (location.state as { passwordReset?: boolean } | null)?.passwordReset === true;

  useEffect(() => {
    if (authState.type === "authenticated") {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [authState, navigate]);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    schema: loginSchema,
  });

  const handleSubmit = async (data: AdminLoginFormData) => {
    setError(null);
    setIsLoading(true);
    try {
      const result = await postAdminLogin(data);
      onLogin(result.admin);
      navigate("/admin/dashboard");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Could not sign you in. Try again in a moment.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (authState.type === "authenticated") {
    return null; // Render nothing while redirecting
  }

  const notice = error
    ? { tone: "error" as const, message: error }
    : passwordWasReset
      ? { tone: "success" as const, message: "Password updated. Sign in with your new password." }
      : null;

  return (
    <>
      <Helmet>
        <title>Sign in - Testkart Admin</title>
        <meta name="description" content="Sign in to the Testkart admin console." />
      </Helmet>
      <AdminAuthShell title="Sign in" notice={notice} busy={authState.type === "loading"}>
        {authState.type === "loading" ? (
          <div className={styles.form}>
            <Skeleton style={{ height: "4rem", width: "100%" }} />
            <Skeleton style={{ height: "4rem", width: "100%" }} />
            <Skeleton style={{ height: "2.5rem", width: "100%" }} />
          </div>
        ) : (
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

              <FormItem name="password">
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput
                    placeholder="Enter your password"
                    autoComplete="current-password"
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

              <div className={styles.forgotRow}>
                <AdminAuthLink to="/admin/forgot-password">Forgot password?</AdminAuthLink>
              </div>

              <Button type="submit" disabled={isLoading} className={styles.submitButton}>
                {isLoading ? (
                  <span className={styles.loadingText}>
                    <Spinner size="sm" />
                    Signing in...
                  </span>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </Form>
        )}
      </AdminAuthShell>
    </>
  );
};

export default AdminLoginPage;