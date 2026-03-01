"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        background: "#000",
        color: "#fff",
        padding: "24px",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: "20px",
          color: "#EF4444",
        }}
      >
        Application error
      </h2>
      <p
        style={{
          margin: 0,
          fontFamily: "'Inter', sans-serif",
          color: "#A0A0A0",
          fontSize: "13px",
          textAlign: "center",
          maxWidth: "520px",
        }}
      >
        Something went wrong while rendering this page.
      </p>
      <button
        onClick={reset}
        style={{
          background: "rgba(134,239,172,0.12)",
          color: "#86EFAC",
          border: "1px solid rgba(134,239,172,0.35)",
          borderRadius: "8px",
          padding: "8px 12px",
          fontSize: "12px",
          fontFamily: "'Inter', sans-serif",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}
