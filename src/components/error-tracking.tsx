"use client";

import { useEffect } from "react";

/**
 * Global error tracking for unhandled client-side errors
 */
export function useErrorTracking() {
  useEffect(() => {
    // Track unhandled errors
    const handleError = (event: ErrorEvent) => {
      event.preventDefault();

      fetch("/api/errors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: event.message,
          stack: event.error?.stack,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
          metadata: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
          },
        }),
      }).catch((err) => {
        console.error("Failed to log error:", err);
      });
    };

    // Track unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();

      const error = event.reason;
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      fetch("/api/errors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Unhandled Promise Rejection: ${message}`,
          stack,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
          metadata: {
            type: "unhandledRejection",
          },
        }),
      }).catch((err) => {
        console.error("Failed to log promise rejection:", err);
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
    };
  }, []);
}

/**
 * Error Tracking Provider Component
 */
export function ErrorTrackingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useErrorTracking();
  return <>{children}</>;
}
