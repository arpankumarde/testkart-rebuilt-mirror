import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { chunkLoadRecovery } from "../helpers/chunkLoadRecovery";
import styles from "./RouteErrorBoundary.module.css";

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
}

interface RouteErrorBoundaryState {
  error: Error | null;
}

/**
 * Keeps a page that fails to load or render from leaving a blank screen. A missing page script
 * triggers one automatic reload first (see helpers/chunkLoadRecovery); if that does not clear it,
 * the visitor gets a reload button instead of white.
 */
export class RouteErrorBoundary extends React.Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Page failed to render", error);
    if (chunkLoadRecovery.isChunkLoadError(error)) chunkLoadRecovery.reloadOnce();
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isLoadFailure = chunkLoadRecovery.isChunkLoadError(error);

    return (
      <div className={styles.container} role="alert">
        <div className={styles.card}>
          <AlertTriangle className={styles.icon} size={48} aria-hidden="true" />
          <h1 className={styles.title}>
            {isLoadFailure ? "This page could not be loaded" : "Something went wrong"}
          </h1>
          <p className={styles.message}>
            {isLoadFailure
              ? "Testkart was updated while this tab was open, or your connection dropped. Reload to get the latest version."
              : "This page hit an unexpected problem. Reloading usually fixes it."}
          </p>
          <div className={styles.actions}>
            <Button size="lg" onClick={() => window.location.reload()}>
              Reload page
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="/">Go to home</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
