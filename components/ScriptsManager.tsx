import React, { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Info, AlertTriangle, Loader2 } from "lucide-react";

import {
  useAdminScriptsQuery,
  useAdminScriptsMutation,
} from "../helpers/useAdminScripts";
import { Textarea } from "./Textarea";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import styles from "./ScriptsManager.module.css";

const scriptsSchema = z.object({
  headerScript: z.string().nullable(),
  footerScript: z.string().nullable(),
});

type ScriptsFormData = z.infer<typeof scriptsSchema>;

export const ScriptsManager = ({ className }: { className?: string }) => {
  const {
    data: scripts,
    isLoading: isLoadingScripts,
    isError,
    error,
  } = useAdminScriptsQuery();

  const { mutate: updateScripts, isPending: isUpdating } =
    useAdminScriptsMutation();

  const { control, handleSubmit, reset } = useForm<ScriptsFormData>({
    resolver: zodResolver(scriptsSchema),
    defaultValues: {
      headerScript: "",
      footerScript: "",
    },
  });

  useEffect(() => {
    if (scripts) {
      reset({
        headerScript: scripts.headerScript ?? "",
        footerScript: scripts.footerScript ?? "",
      });
    }
  }, [scripts, reset]);

  const onSubmit = (data: ScriptsFormData) => {
    toast.promise(
      new Promise((resolve, reject) => {
        updateScripts(data, {
          onSuccess: (result) => resolve(result.message),
          onError: (err) => {
            if (err instanceof Error) {
              reject(err.message);
            } else {
              reject("An unknown error occurred");
            }
          },
        });
      }),
      {
        loading: "Saving scripts...",
        success: (message) => `${message}`,
        error: (errMessage) => `Failed to save: ${errMessage}`,
      }
    );
  };

  if (isLoadingScripts) {
    return <ScriptsManagerSkeleton />;
  }

  if (isError) {
    return (
      <div className={`${styles.container} ${className || ""}`}>
        <div className={styles.errorState}>
          <AlertTriangle size={24} />
          <h3>Failed to load scripts</h3>
          <p>{error instanceof Error ? error.message : "An unknown error occurred."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className || ""}`}>
      <div className={styles.infoBox}>
        <Info size={20} className={styles.infoIcon} />
        <p>
          These scripts will be injected into all pages of the platform. Use
          this for analytics, tracking pixels, etc.
        </p>
      </div>
      <div className={`${styles.warningBox}`}>
        <AlertTriangle size={20} className={styles.warningIcon} />
        <p>
          Make sure to test your scripts before saving. Invalid scripts may
          break the site.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="headerScript">Header Scripts</label>
          <p className={styles.labelDescription}>
            Scripts will be added inside the <code>&lt;head&gt;</code> tag.
          </p>
          <Controller
            name="headerScript"
            control={control}
            render={({ field }) => (
              <Textarea
                id="headerScript"
                className={styles.textarea}
                placeholder="Enter scripts to be added in <head> tag..."
                {...field}
                value={field.value ?? ""}
              />
            )}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="footerScript">Footer Scripts</label>
          <p className={styles.labelDescription}>
            Scripts will be added before the closing <code>&lt;/body&gt;</code> tag.
          </p>
          <Controller
            name="footerScript"
            control={control}
            render={({ field }) => (
              <Textarea
                id="footerScript"
                className={styles.textarea}
                placeholder="Enter scripts to be added before </body> tag..."
                {...field}
                value={field.value ?? ""}
              />
            )}
          />
        </div>

        <div className={styles.actions}>
          <Button type="submit" disabled={isUpdating}>
            {isUpdating && <Loader2 className={styles.spinner} size={16} />}
            {isUpdating ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
};

const ScriptsManagerSkeleton = () => (
  <div className={styles.container}>
    <Skeleton className={styles.infoBoxSkeleton} />
    <div className={styles.form}>
      <div className={styles.formGroup}>
        <Skeleton style={{ width: "150px", height: "24px", marginBottom: 'var(--spacing-2)' }} />
        <Skeleton style={{ width: "250px", height: "16px", marginBottom: 'var(--spacing-2)' }} />
        <Skeleton className={styles.textareaSkeleton} />
      </div>
      <div className={styles.formGroup}>
        <Skeleton style={{ width: "150px", height: "24px", marginBottom: 'var(--spacing-2)' }} />
        <Skeleton style={{ width: "280px", height: "16px", marginBottom: 'var(--spacing-2)' }} />
        <Skeleton className={styles.textareaSkeleton} />
      </div>
      <div className={styles.actions}>
        <Skeleton style={{ width: "120px", height: "40px" }} />
      </div>
    </div>
  </div>
);