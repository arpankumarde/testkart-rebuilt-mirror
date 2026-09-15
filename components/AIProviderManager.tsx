import React, { useState, useEffect } from "react";
import { Brain, AlertTriangle, Loader2 } from "lucide-react";
import {
  useAdminAISettingsQuery,
  useUpdateAIProviderMutation,
} from "../helpers/useAdminAISettings";
import { AIProvider } from "../endpoints/admin/settings/ai-provider_GET.schema";
import { RadioGroup, RadioGroupItem } from "./RadioGroup";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { Badge } from "./Badge";
import styles from "./AIProviderManager.module.css";

export const AIProviderManager = ({ className }: { className?: string }) => {
  const {
    data: settings,
    isLoading: isLoadingSettings,
    isError,
    error,
  } = useAdminAISettingsQuery();

  const { mutate: updateProvider, isPending: isUpdating } =
    useUpdateAIProviderMutation();

  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(
    null
  );

  useEffect(() => {
    if (settings) {
      setSelectedProvider(settings.aiProvider);
    }
  }, [settings]);

  const handleSave = () => {
    if (selectedProvider) {
      updateProvider({ aiProvider: selectedProvider });
    }
  };

  const hasChanged =
    settings && selectedProvider && settings.aiProvider !== selectedProvider;

  const isSelectedProviderConfigured =
    selectedProvider === "openai"
      ? settings?.openaiConfigured
      : selectedProvider === "deepseek"
      ? settings?.deepseekConfigured
      : true;

  if (isLoadingSettings) {
    return <AIProviderManagerSkeleton className={className} />;
  }

  if (isError) {
    return (
      <div className={`${styles.container} ${className || ""}`}>
        <div className={styles.errorState}>
          <AlertTriangle size={24} />
          <h3>Failed to load AI settings</h3>
          <p>
            {error instanceof Error
              ? error.message
              : "An unknown error occurred."}
          </p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return null;
  }

  return (
    <div className={`${styles.container} ${className || ""}`}>
      <div className={styles.header}>
        <Brain className={styles.headerIcon} size={24} />
        <div>
          <h2 className={styles.title}>AI Question Generation Provider</h2>
          <p className={styles.description}>
            Select the service that will be used for AI-powered question
            generation across the platform.
          </p>
        </div>
      </div>

      <RadioGroup
        onValueChange={(value: string) =>
          setSelectedProvider(value as AIProvider)
        }
        value={selectedProvider ?? ""}
        className={styles.radioGroupContainer}
        disabled={isUpdating}
      >
        <label htmlFor="openai-provider" className={styles.radioOption}>
          <div className={styles.radioInputWrapper}>
            <RadioGroupItem value="openai" id="openai-provider" />
          </div>
          <div className={styles.radioDetails}>
            <div className={styles.radioHeader}>
              <span className={styles.radioLabel}>OpenAI (GPT-4o-mini)</span>
              {settings.aiProvider === "openai" && (
                <Badge variant="success">Active</Badge>
              )}
              <Badge
                variant={settings.openaiConfigured ? "secondary" : "warning"}
              >
                {settings.openaiConfigured ? "Configured" : "Not Configured"}
              </Badge>
            </div>
            <p className={styles.radioDescription}>
              High-quality, fast, and reliable generation. Recommended for most
              use cases.
            </p>
          </div>
        </label>

        <label htmlFor="deepseek-provider" className={styles.radioOption}>
          <div className={styles.radioInputWrapper}>
            <RadioGroupItem value="deepseek" id="deepseek-provider" />
          </div>
          <div className={styles.radioDetails}>
            <div className={styles.radioHeader}>
              <span className={styles.radioLabel}>DeepSeek</span>
              {settings.aiProvider === "deepseek" && (
                <Badge variant="success">Active</Badge>
              )}
              <Badge
                variant={settings.deepseekConfigured ? "secondary" : "warning"}
              >
                {settings.deepseekConfigured ? "Configured" : "Not Configured"}
              </Badge>
            </div>
            <p className={styles.radioDescription}>
              A powerful and cost-effective alternative for question generation.
            </p>
          </div>
        </label>
      </RadioGroup>

      {hasChanged && !isSelectedProviderConfigured && (
        <div className={styles.warningBox}>
          <AlertTriangle size={20} className={styles.warningIcon} />
          <p>
            The selected provider's API key is not configured. AI features will
            not work until the key is set up in the backend.
          </p>
        </div>
      )}

      <div className={styles.actions}>
        <Button
          onClick={handleSave}
          disabled={!hasChanged || isUpdating}
        >
          {isUpdating && <Loader2 className={styles.spinner} size={16} />}
          {isUpdating ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};

const AIProviderManagerSkeleton = ({
  className,
}: {
  className?: string;
}) => (
  <div className={`${styles.container} ${className || ""}`}>
    <div className={styles.header}>
      <Skeleton style={{ width: "24px", height: "24px", borderRadius: 'var(--radius-sm)' }} />
      <div style={{ flex: 1 }}>
        <Skeleton style={{ width: "300px", height: "28px" }} />
        <Skeleton style={{ width: "400px", height: "16px", marginTop: 'var(--spacing-2)' }} />
      </div>
    </div>
    <div className={styles.radioGroupContainer}>
      <div className={styles.radioOption}>
        <Skeleton style={{ width: "20px", height: "20px", borderRadius: 'var(--radius-full)' }} />
        <div className={styles.radioDetails}>
          <Skeleton style={{ width: "250px", height: "20px" }} />
          <Skeleton style={{ width: "350px", height: "16px", marginTop: 'var(--spacing-2)' }} />
        </div>
      </div>
      <div className={styles.radioOption}>
        <Skeleton style={{ width: "20px", height: "20px", borderRadius: 'var(--radius-full)' }} />
        <div className={styles.radioDetails}>
          <Skeleton style={{ width: "220px", height: "20px" }} />
          <Skeleton style={{ width: "320px", height: "16px", marginTop: 'var(--spacing-2)' }} />
        </div>
      </div>
    </div>
    <div className={styles.actions}>
      <Skeleton style={{ width: "120px", height: "40px" }} />
    </div>
  </div>
);